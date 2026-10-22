/** Excel-friendly CSV: UTF-8 BOM so Arabic opens correctly, CRLF rows, and spreadsheet-formula neutralising for text cells. */
function cell(v: string | number): string {
  let s = String(v ?? "");
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop user-entered names being read as formulas
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const body = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
