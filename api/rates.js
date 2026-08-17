// api/rates.js
// Serverless bridge between the SOLIS front-end and the Neon Postgres rate library.
// The browser must NEVER connect to the database directly — every read/write goes through here.
// Connection: reads DATABASE_URL (the variable Vercel/Neon created for the "Solis" database).
// The connection is created LAZILY inside the handler, after the DATABASE_URL check, so a
// missing env var returns a clear 500 instead of crashing the function at module load.
// Neon's sql() resolves to the rows array directly — there is no { rows } wrapper.

import { neon } from '@neondatabase/serverless';

const ALLOWED_ADDED_BY = ['harvest', 'manual', 'reference'];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL is not set on the server.' });
  }

  // Lazy: only constructed once the env var is known to exist.
  const sql = neon(process.env.DATABASE_URL);

  const body = parseBody(req);
  req.parsedBody = body;
  const action = (req.query.action || body.action || '').toString();

  try {
    switch (action) {
      case 'list':    return await listRates(sql, req, res);
      case 'lookup':  return await lookupRate(sql, req, res);
      case 'summary': return await summary(sql, req, res);
      case 'pending': return await pending(sql, req, res);
      case 'append':  return await append(sql, req, res);
      case 'confirm': return await confirm(sql, req, res);
      default:
        return res.status(400).json({
          error: `Unknown or missing action: "${action}". Valid: list, lookup, summary, pending, append, confirm.`,
        });
    }
  } catch (err) {
    console.error('[api/rates] error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

async function listRates(sql, req, res) {
  const { category, source, basis, confirmed } = req.query;
  const clauses = [];
  const vals = [];
  if (category) { vals.push(category); clauses.push(`category = $${vals.length}`); }
  if (source)   { vals.push(source);   clauses.push(`source = $${vals.length}`); }
  if (basis)    { vals.push(basis);    clauses.push(`basis = $${vals.length}`); }
  if (confirmed === 'true' || confirmed === 'false') {
    vals.push(confirmed === 'true');
    clauses.push(`confirmed = $${vals.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  // sql.query() keeps the $N placeholders, which a tagged template cannot do for a
  // clause list of variable length.
  const rows = await sql.query(
    `SELECT * FROM rates ${where} ORDER BY category, item, source`,
    vals,
  );
  return res.status(200).json({ count: rows.length, rates: rows });
}

async function lookupRate(sql, req, res) {
  const { item, category, basis, confirmedOnly } = req.query;
  if (!item) return res.status(400).json({ error: 'lookup requires ?item=' });
  const vals = [`%${item}%`];
  const clauses = ['item ILIKE $1'];
  if (category) { vals.push(category); clauses.push(`category = $${vals.length}`); }
  if (basis)    { vals.push(basis);    clauses.push(`basis = $${vals.length}`); }
  if (confirmedOnly === 'true') clauses.push('confirmed = TRUE');
  const rows = await sql.query(
    `SELECT * FROM rates WHERE ${clauses.join(' AND ')} ORDER BY rate`,
    vals,
  );
  return res.status(200).json({ count: rows.length, rates: rows });
}

async function summary(sql, req, res) {
  const { confirmedOnly } = req.query;
  const where = confirmedOnly === 'false' ? '' : 'WHERE confirmed = TRUE';
  // WHERE is a SQL fragment, not a value, so this stays on sql.query() — interpolating
  // it into a tagged template would turn it into a bound parameter.
  const rows = await sql.query(
    `SELECT category, item, unit,
            count(*)            AS sources,
            round(avg(rate), 2) AS avg_rate,
            min(rate)           AS min_rate,
            max(rate)           AS max_rate
     FROM rates
     ${where}
     GROUP BY category, item, unit
     ORDER BY category, item`,
  );
  return res.status(200).json({ count: rows.length, summary: rows });
}

async function pending(sql, req, res) {
  const rows = await sql`
    SELECT * FROM rates WHERE confirmed = FALSE ORDER BY created_at DESC, category, item`;
  return res.status(200).json({ count: rows.length, rates: rows });
}

async function append(sql, req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'append requires POST' });
  const body = req.parsedBody || {};
  const rates = Array.isArray(body.rates) ? body.rates : (body.rate ? [body.rate] : []);
  if (!rates.length) return res.status(400).json({ error: 'append requires a "rates" array' });

  const addedBy = ALLOWED_ADDED_BY.includes(body.added_by) ? body.added_by : 'harvest';

  const inserted = [];
  for (const r of rates) {
    if (!r || !r.source || !r.item) {
      return res.status(400).json({ error: 'each rate needs at least source and item' });
    }
    // confirmed stays a FALSE literal — every appended rate is quarantined until confirmed.
    const rows = await sql`
      INSERT INTO rates
        (source, building_type, basis, category, item, unit, rate, scope_note, added_by, confirmed)
      VALUES (${r.source}, ${r.building_type ?? null}, ${r.basis ?? null}, ${r.category ?? null},
              ${r.item}, ${r.unit ?? null}, ${r.rate ?? null}, ${r.scope_note ?? null},
              ${addedBy}, FALSE)
      RETURNING *`;
    inserted.push(rows[0]);
  }
  return res.status(200).json({
    inserted: inserted.length,
    rates: inserted,
    note: 'Added as pending (confirmed = FALSE). Approve with the confirm action.',
  });
}

async function confirm(sql, req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'confirm requires POST' });
  const body = req.parsedBody || {};
  const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
  if (!ids.length) return res.status(400).json({ error: 'confirm requires an "ids" array' });
  // Kept on sql.query() to preserve the $1::int[] cast exactly as it was.
  const rows = await sql.query(
    `UPDATE rates SET confirmed = TRUE WHERE id = ANY($1::int[]) RETURNING *`,
    [ids],
  );
  return res.status(200).json({ confirmed: rows.length, rates: rows });
}
