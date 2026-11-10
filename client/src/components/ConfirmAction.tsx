import type { ReactNode } from "react";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Popconfirm } from "antd";

interface Props {
  /** Pregunta principal, con el nombre del objeto afectado. */
  title: ReactNode;
  /** Consecuencia concreta de la acción. */
  description: ReactNode;
  /** Texto del botón de confirmación. */
  okText: string;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  /** Las acciones de activación no son destructivas. */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Confirmación común para acciones destructivas o sensibles.
 *
 * Muestra el nombre del objeto, explica la consecuencia y usa un botón danger
 * para que el usuario no confunda la acción con una operación normal.
 */
export default function ConfirmAction({
  title,
  description,
  okText,
  onConfirm,
  children,
  danger = true,
  disabled = false,
}: Props) {
  return (
    <Popconfirm
      title={title}
      description={description}
      okText={okText}
      cancelText="Cancelar"
      okButtonProps={{ danger }}
      icon={<ExclamationCircleOutlined style={{ color: danger ? "#ff4d4f" : "#faad14" }} />}
      onConfirm={onConfirm}
      disabled={disabled}
    >
      {children}
    </Popconfirm>
  );
}
