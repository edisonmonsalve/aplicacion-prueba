import { useId } from "react";

interface Props {
  /** Lado del símbolo en píxeles. */
  size?: number;
  /** `light` para fondos oscuros (texto blanco). */
  tone?: "light" | "dark";
  showText?: boolean;
  textSize?: number;
}

/**
 * Marca de la aplicación: cuadrícula de inventario sobre un cuadrado teal.
 * El texto hereda el color del contenedor para integrarse con el sidebar.
 */
export default function AppLogo({ size = 28, tone = "dark", showText = true, textSize }: Props) {
  const gradientId = useId();
  const color = tone === "light" ? "#fff" : "currentColor";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.34), color }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role="img"
        aria-label="Logotipo de Inventario"
        style={{ flex: "0 0 auto" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
        <rect x="8" y="8" width="7" height="7" rx="2" fill="#fff" />
        <rect x="17" y="8" width="7" height="7" rx="2" fill="#fff" fillOpacity=".82" />
        <rect x="8" y="17" width="7" height="7" rx="2" fill="#fff" fillOpacity=".82" />
        <rect x="17" y="17" width="7" height="7" rx="2" fill="#fff" />
      </svg>
      {showText && (
        <span
          style={{
            fontWeight: 700,
            fontSize: textSize ?? Math.round(size * 0.62),
            letterSpacing: "-0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          Inventario
        </span>
      )}
    </span>
  );
}
