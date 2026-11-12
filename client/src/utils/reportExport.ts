import { downloadCsvFile, escapeCsvCell } from "./csv";
import { formatDateDisplay } from "./dates";

/**
 * Exportación reutilizable de reportes.
 *
 * Un mismo documento describe las secciones que se ven en pantalla. El CSV
 * conserva los números sin formato (para poder sumarlos en Excel) y el PDF se
 * genera con una vista imprimible del navegador, desde donde se guarda como
 * PDF. Así no hace falta una librería de PDF en el cliente.
 */

export type ReportCellFormat = "text" | "money" | "number" | "percent" | "date";

export type ReportCell = string | number | null | undefined;

export interface ReportColumn {
  header: string;
  format?: ReportCellFormat;
  align?: "left" | "right" | "center";
}

export interface ReportSection {
  title?: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
  note?: string;
}

export interface ReportMeta {
  label: string;
  value: string;
}

export interface ReportDocument {
  title: string;
  subtitle?: string;
  meta?: ReportMeta[];
  sections: ReportSection[];
  notes?: string[];
}

const moneyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

const asNumber = (value: ReportCell): number | null => {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pdfCell = (value: ReportCell, format: ReportCellFormat = "text"): string => {
  if (value == null) return "";
  if (format === "date") return formatDateDisplay(String(value));
  if (format === "money") {
    const n = asNumber(value);
    return n === null ? String(value) : moneyFmt.format(n);
  }
  if (format === "number") {
    const n = asNumber(value);
    return n === null ? String(value) : numberFmt.format(n);
  }
  if (format === "percent") {
    const n = asNumber(value);
    return n === null ? String(value) : `${n.toFixed(1)} %`;
  }
  return String(value);
};

const csvCell = (value: ReportCell): string => {
  if (value == null) return "";
  return escapeCsvCell(value);
};

const sectionCsvLines = (section: ReportSection): string[] => {
  const lines: string[] = [];
  if (section.title) lines.push(csvCell(section.title));
  lines.push(section.columns.map((c) => escapeCsvCell(c.header)).join(";"));
  for (const row of section.rows) {
    lines.push(row.map(csvCell).join(";"));
  }
  if (section.note) lines.push(csvCell(section.note));
  lines.push("");
  return lines;
};

/** CSV con todas las secciones del reporte, separadas por una línea en blanco. */
export function exportReportCsv(filename: string, doc: ReportDocument) {
  const lines: string[] = [escapeCsvCell(doc.title)];
  if (doc.subtitle) lines.push(csvCell(doc.subtitle));
  for (const item of doc.meta ?? []) {
    lines.push(`${csvCell(item.label)};${csvCell(item.value)}`);
  }
  lines.push("");

  for (const section of doc.sections) {
    lines.push(...sectionCsvLines(section));
  }

  for (const note of doc.notes ?? []) {
    lines.push(csvCell(note));
  }

  downloadCsvFile(filename, lines.join("\r\n"));
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const alignOf = (column: ReportColumn): "left" | "right" | "center" => {
  if (column.align) return column.align;
  if (column.format === "money" || column.format === "number" || column.format === "percent") {
    return "right";
  }
  return "left";
};

const sectionHtml = (section: ReportSection): string => {
  const headers = section.columns
    .map((c) => `<th class="align-${alignOf(c)}">${escapeHtml(c.header)}</th>`)
    .join("");
  const rows = section.rows
    .map(
      (row) =>
        `<tr>${section.columns
          .map((c, index) => {
            const raw = row[index];
            return `<td class="align-${alignOf(c)}">${escapeHtml(pdfCell(raw, c.format))}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  return `
    <section class="section">
      ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ""}
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${section.columns.length}" class="empty">Sin datos</td></tr>`}</tbody>
      </table>
      ${section.note ? `<p class="note">${escapeHtml(section.note)}</p>` : ""}
    </section>`;
};

const reportHtml = (doc: ReportDocument): string => {
  const meta = (doc.meta ?? [])
    .map(
      (item) =>
        `<div class="meta-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(
          item.value
        )}</strong></div>`
    )
    .join("");

  const notes = (doc.notes ?? []).map((n) => `<p class="note">${escapeHtml(n)}</p>`).join("");
  const generated = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif;
      color: #1f1f1f;
      background: #fff;
      font-size: 12px;
    }
    main { max-width: 980px; margin: 0 auto; }
    header { border-bottom: 2px solid #1677ff; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; }
    .subtitle { margin: 6px 0 0; color: #595959; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px 28px; margin-top: 14px; }
    .meta-item { display: flex; flex-direction: column; min-width: 130px; }
    .meta-item span { color: #8c8c8c; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    .meta-item strong { font-size: 13px; margin-top: 2px; }
    .section { margin-top: 20px; break-inside: auto; }
    h2 { font-size: 14px; margin: 0 0 8px; color: #262626; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td { border-bottom: 1px solid #e8e8e8; padding: 6px 8px; vertical-align: top; }
    th { background: #fafafa; color: #595959; font-weight: 600; text-align: left; }
    tbody tr:nth-child(even) { background: #fcfcfc; }
    .align-right { text-align: right; font-variant-numeric: tabular-nums; }
    .align-center { text-align: center; }
    .align-left { text-align: left; }
    .empty { color: #8c8c8c; text-align: center; padding: 14px; }
    .note { color: #8c8c8c; font-size: 10px; margin: 6px 0 0; }
    footer { margin-top: 24px; border-top: 1px solid #f0f0f0; padding-top: 8px; color: #8c8c8c; font-size: 9.5px; }
    @media print {
      body { padding: 0; }
      .hint { display: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(doc.title)}</h1>
      ${doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : ""}
      ${meta ? `<div class="meta">${meta}</div>` : ""}
    </header>
    ${doc.sections.map(sectionHtml).join("")}
    ${notes}
    <footer>
      Generado el ${escapeHtml(generated)} · Usa <strong>Guardar como PDF</strong> en el diálogo de impresión.
    </footer>
  </main>
</body>
</html>`;
};

/**
 * Abre la ventana imprimible de inmediato, dentro del gesto del usuario.
 * Así el navegador no la bloquea aunque los datos se carguen después.
 */
export function openReportWindow(): Window {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    throw new Error("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.");
  }

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><title>Generando reporte…</title></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#595959">
  <p>Generando el reporte…</p>
</body>
</html>`);
  win.document.close();
  return win;
}

/**
 * Escribe el reporte en la ventana imprimible y abre el diálogo de impresión.
 * El usuario elige "Guardar como PDF" en el diálogo del navegador.
 */
export function printReport(doc: ReportDocument, target?: Window | null) {
  const win = target ?? window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    throw new Error("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.");
  }

  win.document.open();
  win.document.write(reportHtml(doc));
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 200);
}
