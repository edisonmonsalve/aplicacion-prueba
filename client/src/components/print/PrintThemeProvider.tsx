import type { ReactNode } from "react";
import { ConfigProvider, theme } from "antd";

/**
 * Tema claro propio de las hojas de impresión.
 *
 * Un `ConfigProvider` anidado hereda los tokens del proveedor de la aplicación;
 * en modo oscuro eso dejaba mezclas (fondo oscuro con texto claro). Aquí se
 * redefinen explícitamente los tokens que la app sobrescribe para que la hoja y
 * su barra de acciones se vean siempre en claro.
 */
const printTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#0d9488",
    colorInfo: "#0ea5e9",
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorError: "#dc2626",
    colorBgLayout: "#f1f7f6",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorText: "rgba(0, 0, 0, 0.88)",
    colorTextSecondary: "rgba(0, 0, 0, 0.65)",
    colorBorder: "#d9d9d9",
    colorBorderSecondary: "#f0f0f0",
    fontFamily: "'Plus Jakarta Sans Variable', system-ui, sans-serif",
  },
};

export default function PrintThemeProvider({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={printTheme}>{children}</ConfigProvider>;
}
