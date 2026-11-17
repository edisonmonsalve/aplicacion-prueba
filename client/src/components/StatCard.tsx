import type { CSSProperties, ReactNode } from "react";
import { Card, Flex, theme, Typography } from "antd";

export type StatTone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONE_TOKEN = {
  neutral: "colorTextSecondary",
  primary: "colorPrimary",
  success: "colorSuccess",
  warning: "colorWarning",
  danger: "colorError",
} as const;

interface Props {
  label: ReactNode;
  value: ReactNode;
  /** Texto corto bajo el valor (aclaración, comparación, rango). */
  hint?: ReactNode;
  tone?: StatTone;
  /** Convierte la tarjeta en un atajo navegable. */
  onClick?: () => void;
  style?: CSSProperties;
}

/**
 * Tarjeta compacta de indicador.
 *
 * Usa tokens del tema (no colores fijos) para que el modo claro y el oscuro
 * mantengan el contraste. Si recibe `onClick` se comporta como un atajo
 * accesible: foco por teclado, rol de botón y elevación al pasar el cursor.
 */
export default function StatCard({ label, value, hint, tone = "neutral", onClick, style }: Props) {
  const { token } = theme.useToken();
  const accent = token[TONE_TOKEN[tone]];

  return (
    <Card
      className="stat-card"
      hoverable={!!onClick}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      styles={{ body: { padding: "14px 16px" } }}
      style={{
        borderLeft: `3px solid ${accent}`,
        height: "100%",
        ...style,
      }}
    >
      <Flex vertical gap={2}>
        <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.3 }}>
          {label}
        </Typography.Text>
        <Typography.Title level={4} style={{ margin: 0, lineHeight: 1.25 }}>
          {value}
        </Typography.Title>
        {hint && (
          <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.3 }}>
            {hint}
          </Typography.Text>
        )}
      </Flex>
    </Card>
  );
}
