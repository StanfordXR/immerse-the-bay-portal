/**
 * Build a CSV for the admin exports. Text cells starting with `= + - @` (or a
 * tab/CR) get a leading `'` so Excel and Sheets show them as text instead of
 * running an applicant-typed formula like `=HYPERLINK(...)`.
 */
export function toCsv(header: readonly string[], rows: readonly unknown[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
