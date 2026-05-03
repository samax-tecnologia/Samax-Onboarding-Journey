/**
 * Minimal RFC 4180-ish CSV parser. Handles:
 *  - quoted fields (with `""` escaped quote)
 *  - commas, semicolons, or tabs as delimiters (auto-detected from header)
 *  - CRLF / LF line endings
 *  - leading UTF-8 BOM
 * Returns rows as string arrays. The caller is responsible for header mapping.
 */
export type ParsedCsv = {
  header: string[];
  rows: string[][];
  delimiter: string;
};

export function parseCsv(input: string): ParsedCsv {
  let text = input.replace(/^\uFEFF/, "");
  // Detect delimiter from the first line.
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = pickDelimiter(firstLine);

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // swallow \r if followed by \n; handle as line end either way.
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully empty trailing rows
  while (rows.length > 0) {
    const last = rows[rows.length - 1]!;
    if (last.length === 1 && last[0]!.trim() === "") rows.pop();
    else break;
  }

  if (rows.length === 0) return { header: [], rows: [], delimiter };
  const header = (rows.shift() ?? []).map((h) => h.trim());
  return { header, rows, delimiter };
}

function pickDelimiter(line: string): string {
  const counts: Record<string, number> = {
    ",": (line.match(/,/g) ?? []).length,
    ";": (line.match(/;/g) ?? []).length,
    "\t": (line.match(/\t/g) ?? []).length,
  };
  let best = ",";
  let bestCount = counts[","] ?? 0;
  for (const [d, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}

/** Normalize a period string to "YYYY-MM". Accepts:
 *   "YYYY-MM", "YYYY-MM-DD" (truncates to month), "YYYY/MM", "MM/YYYY", "Jan 2025", etc.
 *  Returns null if it can't be parsed. */
export function normalizePeriodMonth(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const fmt = (y: number, mo: number) =>
    mo >= 1 && mo <= 12 && y >= 1970 && y <= 2999
      ? `${y}-${String(mo).padStart(2, "0")}`
      : null;
  // YYYY-MM or YYYY-MM-DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (m) return fmt(Number(m[1]), Number(m[2]));
  // MM/YYYY or MM-YYYY
  m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return fmt(Number(m[2]), Number(m[1]));
  // Date.parse fallback (handles "Jan 2025" in many locales)
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return fmt(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }
  return null;
}

export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  // Try pt-BR style ("1.234,56") and en-US style ("1,234.56").
  let normalized = s;
  if (/,\d{1,2}$/.test(s) && /\./.test(s)) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/,\d{1,2}$/.test(s) && !/\./.test(s)) {
    normalized = s.replace(",", ".");
  } else {
    normalized = s.replace(/,/g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
