import type { ReactNode } from "react";
import { Button, Tag, Tooltip } from "antd";
import { CloseOutlined, PrinterOutlined, SaveOutlined } from "@ant-design/icons";

interface Props {
  saving: boolean;
  dirty: boolean;
  onCancel: () => void;
  submitLabel: string;
  totalLabel: string;
  totalValue: string;
  net?: { label: string; value: string };
  /** Opcional: la factura ofrece guardar un borrador solo en este navegador. */
  onSaveDraft?: () => void;
  draftSavedAt?: string | null;
  /** Contexto a la izquierda: número de documento o «Nueva factura». */
  eyebrow?: string;
  /** Aviso compacto dentro de la barra (p. ej. datos fiscales pendientes). */
  notice?: ReactNode;
  /** Solo documentos que se imprimen como hoja (factura). */
  onPrint?: () => void;
}

/**
 * Barra flotante de acciones de los formularios de documento.
 *
 * Mantiene guardar/cancelar y el importe a la vista mientras se editan líneas.
 * El estado de cambios sin guardar se anuncia, no se deja solo al color, y el
 * guardado se refleja con un barrido mientras la petición está en curso.
 */
export default function DocumentFormFooter({
  saving,
  dirty,
  onCancel,
  submitLabel,
  totalLabel,
  totalValue,
  net,
  onSaveDraft,
  draftSavedAt,
  eyebrow,
  notice,
  onPrint,
}: Props) {
  const lastSaved = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="ui-doc-footer" data-saving={saving} data-dirty={dirty}>
      <div className="ui-doc-footer__actions">
        {eyebrow && <span className="ui-doc-footer__eyebrow">{eyebrow}</span>}
        <span className="ui-doc-footer__state" role="status" aria-live="polite">
          {dirty ? (
            <Tag color="warning" variant="filled">
              Sin guardar
            </Tag>
          ) : (
            <span className="ui-doc-footer__saved">Guardado</span>
          )}
        </span>
        {notice}
        {onPrint && (
          <Tooltip title="Imprimir en carta o A4 (Ctrl+P)">
            <Button type="text" icon={<PrinterOutlined />} onClick={onPrint}>
              Imprimir
            </Button>
          </Tooltip>
        )}
        {onSaveDraft && (
          <Tooltip
            title={
              lastSaved
                ? `Último guardado local: ${lastSaved}`
                : "Guardar en este navegador (Ctrl+S)"
            }
          >
            <Button type="text" icon={<SaveOutlined />} onClick={onSaveDraft}>
              Borrador
            </Button>
          </Tooltip>
        )}
        <Button icon={<CloseOutlined />} onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Tooltip title="Guardar el documento (Ctrl+Enter)">
          <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
            {submitLabel}
          </Button>
        </Tooltip>
      </div>
      <div className="ui-doc-footer__amounts" aria-live="polite">
        <span className="ui-eyebrow">{totalLabel}</span>
        <strong className="num">{totalValue}</strong>
        {net && (
          <span className="ui-doc-footer__net">
            {net.label}: <span className="num">{net.value}</span>
          </span>
        )}
      </div>
    </div>
  );
}
