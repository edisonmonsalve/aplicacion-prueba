import type { CSSProperties } from "react";
import { Alert, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

interface Props {
  /** Título breve del fallo, específico del reporte. */
  message: string;
  /** Detalle devuelto por la API. */
  description?: string;
  /** Vuelve a lanzar la misma petición. */
  onRetry?: () => void;
  retryLabel?: string;
  style?: CSSProperties;
}

/**
 * Error de carga persistente para reportes y listados.
 *
 * A diferencia de un `message.error`, no desaparece solo: deja claro que los
 * datos visibles no corresponden al filtro actual y permite reintentar sin
 * recargar la página.
 */
export default function LoadError({
  message,
  description,
  onRetry,
  retryLabel = "Reintentar",
  style,
}: Props) {
  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16, ...style }}
      message={message}
      description={description}
      action={
        onRetry ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
}
