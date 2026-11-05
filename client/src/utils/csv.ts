export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const escape = (v: unknown) => {
  let s = v == null ? "" : String(v);
  // Evita que Excel ejecute fórmulas si el texto empieza con = + - @
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ";" y BOM: Excel en español abre así las columnas y las tildes bien
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]) {
  const lines = [
    columns.map((c) => escape(c.header)).join(";"),
    ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Descarga todas las páginas, no solo la visible
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<{ data: T[]; total: number }>) {
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const r = await fetchPage(page);
    all.push(...r.data);
    if (r.data.length === 0 || all.length >= r.total) return all;
  }
}
