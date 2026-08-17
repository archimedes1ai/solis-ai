// src/utils/parseBoq.js
// Contractor BoQ parser — runs client-side using SheetJS (reads .xls AND .xlsx).
// parseBoq(arrayBuffer) -> { units, lines, flags, skipped }
import * as XLSX from 'xlsx';

function pickSheet(wb) {
  if (wb.SheetNames.includes('Pages')) return 'Pages';
  return wb.SheetNames[0];
}

function cellStr(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  const cell = ws[addr];
  if (!cell || cell.v === undefined || cell.v === null) return '';
  return String(cell.v).trim();
}

function cellNum(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  const cell = ws[addr];
  if (!cell || cell.v === undefined || cell.v === null) return null;
  return typeof cell.v === 'number' ? cell.v : null;
}

export function parseBoq(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[pickSheet(wb)];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxRow = range.e.r + 1;

  const units = [];
  const lines = [];
  const flags = [];
  let currentUnit = null;
  let currentWorktype = null;
  let skipped = 0;

  const isLetterRef = (s) => /^[A-Z]{1,2}$/.test(s);

  for (let r = 2; r <= maxRow; r++) {
    const B = cellStr(ws, r, 2);
    const C = cellStr(ws, r, 3);
    const D = cellNum(ws, r, 4);
    const E = cellStr(ws, r, 5);

    // 1. Unit header row: "Unit 3" in column B with an empty description.
    if (B.startsWith('Unit ') && C === '') {
      currentUnit = B.slice('Unit '.length).trim();
      currentWorktype = null;
      if (currentUnit && !units.includes(currentUnit)) units.push(currentUnit);
      continue;
    }

    // 2. Furniture rows — column headers, page totals, preamble and bill metadata.
    if (
      C === 'Description' ||
      C.startsWith('Page Total') ||
      C.startsWith('As per') ||
      C.includes('Trade Bill') ||
      C.startsWith('Project:') ||
      C.startsWith('From:') ||
      C.startsWith('Trade:')
    ) {
      skipped++;
      continue;
    }

    const refIsLetter = isLetterRef(B);
    const qty = D;

    // 3. Worktype heading — no item reference, no quantity, but a description.
    if (!refIsLetter && qty === null && C && currentUnit) {
      const first = C.split('\n')[0].trim();
      if (first && !first.startsWith('Unit ')) currentWorktype = first;
      continue;
    }

    // 4. Measured item — a letter reference with a quantity against it.
    if (refIsLetter && qty !== null) {
      lines.push({ unit: currentUnit, worktype: currentWorktype, ref: B, desc: C, qty, uom: E });
      if (E && !['item', 'm2', 'nr', 'm', 'sum', 'no', 'each'].includes(E.toLowerCase())) {
        flags.push({
          type: 'data',
          unit: currentUnit,
          ref: B,
          message: `Unit of measure reads '${E}' - confirm intended?`,
        });
      }
      if (C.toLowerCase().includes('identify any additional')) {
        flags.push({
          type: 'catchall',
          unit: currentUnit,
          ref: B,
          message: 'Contractor-identified additional items - provisional sum or exclude?',
        });
      }
      continue;
    }
  }

  return { units, lines, flags, skipped };
}
