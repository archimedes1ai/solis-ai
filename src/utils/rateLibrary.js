// src/utils/rateLibrary.js
// Client-side helpers for SOLIS's rate library. These call the /api/rates serverless bridge —
// the browser never touches the database directly.

const RATES_ENDPOINT = '/api/rates';

async function callRates(params = {}, { method = 'GET', body } = {}) {
  let url = RATES_ENDPOINT;
  if (method === 'GET') {
    const qs = new URLSearchParams(params).toString();
    url = qs ? `${RATES_ENDPOINT}?${qs}` : RATES_ENDPOINT;
  }
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Rate library request failed (${res.status})`);
  }
  return res.json();
}

export async function listRates(filters = {}) {
  const data = await callRates({ action: 'list', ...filters });
  return data.rates || [];
}

export async function lookupRate(item, opts = {}) {
  const data = await callRates({ action: 'lookup', item, ...opts });
  return data.rates || [];
}

export async function rateSummary(opts = {}) {
  const data = await callRates({ action: 'summary', ...opts });
  return data.summary || [];
}

export async function pendingRates() {
  const data = await callRates({ action: 'pending' });
  return data.rates || [];
}

export async function bestRate(item, opts = {}) {
  const { strategy = 'min', ...lookupOpts } = opts;
  const rates = await lookupRate(item, { confirmedOnly: 'true', ...lookupOpts });
  if (!rates.length) return null;
  if (strategy === 'avg') {
    const nums = rates.map((r) => Number(r.rate)).filter((n) => !Number.isNaN(n));
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return { item, strategy: 'avg', rate: Math.round(avg * 100) / 100, matches: rates.length };
  }
  return { ...rates[0], strategy: 'min', matches: rates.length };
}

export async function appendRates(rates, opts = {}) {
  const list = Array.isArray(rates) ? rates : [rates];
  return callRates(
    {},
    { method: 'POST', body: { action: 'append', rates: list, added_by: opts.added_by || 'harvest' } },
  );
}

export async function confirmRates(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return callRates({}, { method: 'POST', body: { action: 'confirm', ids: list } });
}
