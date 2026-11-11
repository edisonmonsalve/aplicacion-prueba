import { getBudget, listBudgets } from "./budgets.service.js";
import { getSummary } from "./transactions.service.js";
import { today } from "../../utils/dates.js";

export interface Suggestion {
  tipo: "reasignar" | "subir" | "precio" | "ingresos" | "sin_movimiento";
  severidad: "info" | "warning" | "danger";
  mensaje: string;
  referencia?: { budget_id?: number; line_id?: number; categoria?: string; producto?: string | null };
}

export async function getSuggestions(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const now = today();

  const { data: budgets } = await listBudgets({ page: 1, pageSize: 100, estado: "activo" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = (budgets as any[]).filter((b: any) => b.fecha_inicio <= now && b.fecha_fin >= now);

  for (const b of active) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = (await getBudget(b.id)) as any;
    const r = detail.resumen;
    const start = new Date(`${detail.fecha_inicio}T12:00:00`).getTime();
    const end = new Date(`${detail.fecha_fin}T12:00:00`).getTime();
    const todayMs = new Date(`${now}T12:00:00`).getTime();
    const totalDays = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
    const elapsedDays = Math.max(1, Math.round((todayMs - start) / 86_400_000) + 1);
    const elapsedPct = (elapsedDays / totalDays) * 100;

    for (const line of detail.lineas) {
      if (line.monto_planeado <= 0) continue;
      const exec = line.ejecucion_pct;
      const scope = line.producto
        ? ` · ${line.producto}`
        : line.producto_categoria
          ? ` · Categoría ${line.producto_categoria}`
          : "";
      if (line.estado === "excedido") {
        suggestions.push({
          tipo: "subir",
          severidad: "danger",
          mensaje: `La línea "${line.categoria}${scope}" excedió su monto planeado (${exec.toFixed(0)}%). Considera subir el presupuesto o revisar los gastos.`,
          referencia: { budget_id: detail.id, line_id: line.id, categoria: line.categoria, producto: line.producto ?? line.producto_categoria },
        });
      } else if (exec < 60 && elapsedPct >= 80) {
        suggestions.push({
          tipo: "reasignar",
          severidad: "info",
          mensaje: `La línea "${line.categoria}${scope}" lleva solo ${exec.toFixed(0)}% ejecutado al ${elapsedPct.toFixed(0)}% del periodo. Podrías reasignar parte del monto.`,
          referencia: { budget_id: detail.id, line_id: line.id, categoria: line.categoria, producto: line.producto ?? line.producto_categoria },
        });
      } else if (line.real === 0 && elapsedPct >= 50) {
        suggestions.push({
          tipo: "sin_movimiento",
          severidad: "info",
          mensaje: `La línea "${line.categoria}${scope}" no tiene transacciones al ${elapsedPct.toFixed(0)}% del periodo.`,
          referencia: { budget_id: detail.id, line_id: line.id, categoria: line.categoria, producto: line.producto ?? line.producto_categoria },
        });
      }
    }

    if (detail.ingreso_meta > 0 && r.cumplimiento_ingreso_pct < 80 && elapsedPct >= 80) {
      suggestions.push({
        tipo: "ingresos",
        severidad: "warning",
        mensaje: `Los ingresos reales (${r.cumplimiento_ingreso_pct.toFixed(0)}% de la meta) van por debajo de lo planeado al ${elapsedPct.toFixed(0)}% del periodo.`,
        referencia: { budget_id: detail.id },
      });
    }
  }

  // Margen bruto bajo
  const summary = await getSummary({ desde: `${now.slice(0, 7)}-01`, hasta: now });
  if (summary.ingresos > 0 && summary.margen_bruto_pct < 30) {
    suggestions.push({
      tipo: "precio",
      severidad: "warning",
      mensaje: `El margen bruto del periodo es ${summary.margen_bruto_pct.toFixed(0)}% (menos del 30%). Revisa precios o costos.`,
    });
  }

  return suggestions;
}
