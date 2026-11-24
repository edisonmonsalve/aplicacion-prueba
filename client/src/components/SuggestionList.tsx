import type { ReactNode } from "react";
import { AlertOutlined, BulbOutlined, WarningOutlined } from "@ant-design/icons";
import type { Suggestion } from "@/types";

const META: Record<Suggestion["severidad"], { label: string; icon: ReactNode }> = {
  danger: { label: "Crítico", icon: <AlertOutlined /> },
  warning: { label: "Atención", icon: <WarningOutlined /> },
  info: { label: "Sugerencia", icon: <BulbOutlined /> },
};

/**
 * Sugerencias del presupuesto con voz Signal.
 *
 * Cada tarjeta lleva su propio acento semántico, un icono en chip y la
 * referencia de la línea. Es una lista real (`ul`/`li`) para conservar la
 * semántica y el recorrido con lector de pantalla.
 */
export default function SuggestionList({ items }: { items: Suggestion[] }) {
  return (
    <ul className="ui-suggestions">
      {items.map((suggestion, index) => {
        const meta = META[suggestion.severidad];
        const reference = [suggestion.referencia?.categoria, suggestion.referencia?.producto]
          .filter(Boolean)
          .join(" · ");

        return (
          <li
            key={`${suggestion.tipo}-${suggestion.referencia?.line_id ?? index}`}
            className={`ui-suggestion ui-suggestion--${suggestion.severidad}`}
          >
            <span className="ui-suggestion__icon" aria-hidden="true">
              {meta.icon}
            </span>
            <div className="ui-suggestion__body">
              <span className="ui-eyebrow">{meta.label}</span>
              <p className="ui-suggestion__text">{suggestion.mensaje}</p>
              {reference && <span className="ui-suggestion__ref">{reference}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
