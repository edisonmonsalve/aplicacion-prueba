import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";

type Mode = "light" | "dark";
const KEY = "theme-mode";
const SWITCHING_CLASS = "theme-switching";
const Ctx = createContext<{ mode: Mode; toggle: () => void }>({ mode: "light", toggle: () => {} });

const palette = {
  light: {
    colorPrimary: "#0d9488",
    colorInfo: "#0ea5e9",
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorBgLayout: "#f1f7f6",
  },
  dark: {
    colorPrimary: "#2dd4bf",
    colorBgLayout: "#0b1412",
    colorBgContainer: "#111c1a",
    colorBgElevated: "#16231f",
  },
};

export const useThemeMode = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(KEY) === "dark" ? "dark" : "light"));

  // Al cambiar de tema se desactivan las transiciones de color de Ant Design
  // (tablas, tarjetas, botones) para que el cambio sea de una sola vez y no
  // parezca un parpadeo. Se reactivan cuando el nuevo tema ya se pintó.
  const toggle = useCallback(() => {
    document.documentElement.classList.add(SWITCHING_CLASS);
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, mode);
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;

    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => root.classList.remove(SWITCHING_CLASS));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [mode]);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return (
    <Ctx.Provider value={value}>
      <ConfigProvider
        locale={esES}
        theme={{
          algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            fontFamily: "'Plus Jakarta Sans Variable', system-ui, sans-serif",
            borderRadius: 12,
            borderRadiusLG: 16,
            controlHeight: 38,
            fontSize: 14,
            wireframe: false,
            ...palette[mode],
          },
          components: {
            Layout: { siderBg: mode === "dark" ? "#0b1412" : "#0f3d38" },
            Menu: {
              darkItemBg: "transparent",
              darkItemSelectedBg: palette[mode].colorPrimary,
              darkItemSelectedColor: mode === "dark" ? "#052e2b" : "#fff",
            },
            Card: {
              borderRadiusLG: 16,
              boxShadowTertiary:
                mode === "dark"
                  ? "0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 28px -14px rgba(0, 0, 0, 0.7)"
                  : "0 1px 2px rgba(16, 24, 40, 0.04), 0 10px 28px -16px rgba(16, 24, 40, 0.18)",
            },
            Table: {
              headerBg: mode === "dark" ? "#16231f" : "#f7fafa",
              headerColor: mode === "dark" ? "#cfe7e2" : "#475569",
              headerSplitColor: "transparent",
              rowHoverBg: mode === "dark" ? "#132a26" : "#f2fbf9",
              borderColor: mode === "dark" ? "#1e2f2b" : "#eef2f1",
              cellPaddingBlock: 12,
            },
            Button: { fontWeight: 600 },
          },
        }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </Ctx.Provider>
  );
}
