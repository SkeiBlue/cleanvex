// Caractères qui déclenchent une formule dans Excel/LibreOffice/Sheets
// (CSV/formula injection — OWASP). On préfixe d'une apostrophe pour forcer
// une interprétation en texte brut côté tableur.
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/** Génère un CSV à partir d'un tableau d'objets */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    let s = v === null || v === undefined ? '' : String(v);
    if (FORMULA_PREFIXES.some((p) => s.startsWith(p))) {
      s = `'${s}`;
    }
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\r\n');
}
