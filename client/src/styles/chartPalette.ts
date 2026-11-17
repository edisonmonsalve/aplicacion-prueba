import { signal } from "@/styles/signal";

/**
 * Paleta única de gráficos. Todas las señales vienen de `signal`, que a su vez
 * son `var(--ui-*)`: cambiar un token en tokens.css actualiza Inicio y
 * Tendencias a la vez. `ACCENT` se usa para shapes (barras/áreas) y `INK`
 * para cifras y texto.
 */
export const CHART = {
  income: signal.positiveAccent,
  expense: signal.warningAccent,
  cash: signal.infoAccent,
  profit: signal.violetAccent,
  brand: signal.brand,
  neutral: signal.muted,
  negative: signal.negativeAccent,
  danger: signal.negativeAccent,

  /* Tinta para cifras (contraste AA), equivalente a las variantes sin sufijo. */
  inkPositive: signal.positive,
  inkNegative: signal.negative,
  inkCash: signal.info,
} as const;

/** Estilo de tooltip compartido, acoplado al tema de AntD. */
export const chartTooltipStyle = (token: {
  colorBgElevated: string;
  colorBorderSecondary: string;
  colorText: string;
}) => ({
  background: token.colorBgElevated,
  border: `1px solid ${token.colorBorderSecondary}`,
  borderRadius: 8,
  color: token.colorText,
  boxShadow: "var(--ui-shadow-deep)",
});
