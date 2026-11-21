import type { ReactNode } from "react";

interface Props {
  /** Índice corto del bloque (`01`, `02`, …) dentro del documento. */
  index: string;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Bloque numerado de la plantilla de impresión.
 *
 * Cotización y factura comparten el mismo ritmo: índice monoespaciado,
 * micro-label y una línea que agota el ancho. El número es decoración visual y
 * el título es el encabezado real, así que el lector de pantalla no oye dos
 * veces la misma información.
 */
export default function PrintSection({ index, title, children, className = "" }: Props) {
  return (
    <section className={`print-section ${className}`.trim()}>
      <div className="print-section-head">
        <span className="print-section-index" aria-hidden="true">
          {index}
        </span>
        <h2 className="print-section-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}
