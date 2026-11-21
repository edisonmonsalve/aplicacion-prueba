import type { ReactNode } from "react";

interface Props {
  /** Índice del bloque dentro del formulario (`01`, `02`, …). */
  index: string;
  title: string;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

/**
 * Sección de un formulario de documento.
 *
 * Cotización y factura comparten el mismo ritmo: número plano, título y una
 * línea corta de contexto. No es una tarjeta: una regla separa los bloques.
 * El componente no valida ni guarda; solo ordena la información.
 */
export default function FormSection({ index, title, description, extra, children }: Props) {
  return (
    <section className="ui-doc-section">
      <header className="ui-doc-section__head">
        <span className="ui-doc-section__index" aria-hidden="true">
          {index}
        </span>
        <div className="ui-doc-section__heading">
          <h2 className="ui-doc-section__title">{title}</h2>
          {description && <p className="ui-doc-section__description">{description}</p>}
        </div>
        {extra && <div className="ui-doc-section__extra">{extra}</div>}
      </header>
      <div className="ui-doc-section__body">{children}</div>
    </section>
  );
}
