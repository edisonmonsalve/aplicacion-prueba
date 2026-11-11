import type { ReactNode } from "react";
import { COMPANY } from "@/config/company";

interface Props {
  /** Tipo de documento, por ejemplo «COTIZACIÓN». */
  docKind: string;
  docNumber: string;
  /** Etiqueta de estado (antd Tag) del documento. */
  status?: ReactNode;
  /** Líneas de fecha u otros metadatos, una por renglón. */
  meta: ReactNode;
}

/** Símbolo de la empresa emisora. Pensado para impresión en color o escala de grises. */
function CompanyMark({ size = 46 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`Logotipo de ${COMPANY.nombre}`}
      className="print-brand-mark"
    >
      <circle cx="24" cy="24" r="23" fill="#0f766e" />
      <path d="M24 11.5 36 17.4v13.2L24 36.5l-12-5.9V17.4z" fill="#fff" />
      <path
        d="M12 17.4 24 23.3l12-5.9M24 23.3v13.2"
        stroke="#0f766e"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Cabecera común de cotizaciones y facturas: identidad de la empresa a la
 * izquierda y datos del documento a la derecha.
 */
export default function PrintHeader({ docKind, docNumber, status, meta }: Props) {
  return (
    <header className="print-header">
      <div className="print-brand">
        <CompanyMark />
        <div className="print-brand-text">
          <div className="print-company-name">{COMPANY.nombre}</div>
          <div className="print-company-tagline">{COMPANY.eslogan}</div>
          <div className="print-company-data">
            <span>
              {COMPANY.nit} · {COMPANY.regimen}
            </span>
            <span>{COMPANY.direccion}</span>
            <span>
              {COMPANY.telefono} · {COMPANY.celular}
            </span>
            <span>
              {COMPANY.email} · {COMPANY.web}
            </span>
          </div>
        </div>
      </div>

      <div className="print-doc">
        <div className="print-doc-kind">{docKind}</div>
        <div className="print-doc-number">{docNumber}</div>
        {status && <div className="print-doc-status">{status}</div>}
        <div className="print-doc-meta">{meta}</div>
      </div>
    </header>
  );
}
