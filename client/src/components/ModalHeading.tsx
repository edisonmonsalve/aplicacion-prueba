import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
}

/**
 * Cabecera editorial para formularios en modal. Repite el lenguaje de
 * `PageHeader` (micro-label, título display y barra de señal) para que el
 * diálogo se sienta parte del sistema y no un panel genérico de AntD.
 */
export default function ModalHeading({ eyebrow, title, description }: Props) {
  return (
    <div className="ui-modal-heading">
      <span className="ui-eyebrow">{eyebrow}</span>
      <h2 className="ui-modal-title">{title}</h2>
      {description && <p className="ui-modal-desc">{description}</p>}
    </div>
  );
}
