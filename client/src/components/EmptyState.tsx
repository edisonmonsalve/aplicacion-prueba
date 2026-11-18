import type { ReactNode } from "react";

interface Props {
  /** Micro-label de contexto: módulo o tipo de dato. */
  eyebrow?: string;
  /** Frase corta que explica qué falta. */
  title: ReactNode;
  /** Línea de apoyo: qué aparecerá aquí o cómo empezar. */
  description?: ReactNode;
  /** Acción principal: crear el primer registro o limpiar filtros. */
  action?: ReactNode;
  /** `panel` para tarjetas y páginas; `inline` para celdas de tabla y gráficos. */
  variant?: "panel" | "inline";
  className?: string;
}

/**
 * Estado vacío Signal. Repite la voz de `PageHeader` y `ModalHeading` para que
 * el vacío también se sienta parte del sistema. La marca es estática y
 * decorativa; el texto y la acción son el contenido real.
 */
export default function EmptyState({
  eyebrow,
  title,
  description,
  action,
  variant = "panel",
  className,
}: Props) {
  return (
    <div
      className={["ui-empty", variant === "inline" && "ui-empty--inline", className]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="ui-empty__mark" aria-hidden="true" />
      {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
      <p className="ui-empty__title">{title}</p>
      {description && <p className="ui-empty__desc">{description}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}
