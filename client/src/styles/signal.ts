/**
 * Referencias a los tokens Signal desde JavaScript.
 *
 * Los valores son `var(--ui-*)` para que un único cambio en `tokens.css`
 * (o en `ConfigProvider`) actualice también cifras, SVG y gráficos. Se usan
 * dos variantes por señal: `Accent` para shapes y `sin sufijo` para texto,
 * con contraste AA sobre superficie en claro y oscuro.
 */
export const signal = {
  /* Acento: barras, gráficos, iconos, glow. */
  brand: "var(--ui-brand)",
  brandStrong: "var(--ui-brand-strong)",
  positiveAccent: "var(--ui-success)",
  negativeAccent: "var(--ui-danger)",
  warningAccent: "var(--ui-warning)",
  infoAccent: "var(--ui-info)",
  violetAccent: "var(--ui-violet)",

  /* Tinta: cifras y texto breve. */
  ink: "var(--ui-ink)",
  muted: "var(--ui-ink-2)",
  positive: "var(--ui-success-ink)",
  negative: "var(--ui-danger-ink)",
  warning: "var(--ui-warning-ink)",
  info: "var(--ui-info-ink)",
  violet: "var(--ui-violet-ink)",

  /* Superficies y líneas. */
  surface: "var(--ui-surface)",
  surfaceSoft: "var(--ui-surface-2)",
  canvas: "var(--ui-canvas)",
  line: "var(--ui-line)",

  /* Marca assets: blanco intencional sobre el teal del logo y del login,
     en ambos temas (no es la superficie de la aplicación). */
  onBrand: "#ffffff",
  brandDeep: "#0f3d38",
} as const;
