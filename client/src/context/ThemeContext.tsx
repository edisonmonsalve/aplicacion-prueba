import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";

type Mode = "light" | "dark";
const KEY = "theme-mode";
const SWITCHING_CLASS = "theme-switching";
const Ctx = createContext<{ mode: Mode; toggle: () => void }>({ mode: "light", toggle: () => {} });

// Signal: misma paleta que styles/tokens.css. Mantener ambas en sincronía.
const palette = {
  light: {
    colorPrimary: "#0d9488",
    colorInfo: "#38bdf8",
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorError: "#fb7185",
    colorBgLayout: "#f6f5f2",
    colorText: "#16201e",
    colorTextSecondary: "#5b6b67",
    colorBorderSecondary: "#e6e9e5",
  },
  dark: {
    colorPrimary: "#2dd4bf",
    colorInfo: "#38bdf8",
    colorSuccess: "#34d399",
    colorWarning: "#fbbf24",
    colorError: "#fb7185",
    colorBgLayout: "#0d1413",
    colorBgContainer: "#131e1c",
    colorBgElevated: "#16231f",
    colorText: "#e8f1ef",
    colorTextSecondary: "#9db3ae",
    colorBorderSecondary: "#243631",
  },
};

const MONO_STACK = 'ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, monospace';

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
            fontFamilyCode: MONO_STACK,
            borderRadius: 14,
            borderRadiusLG: 16,
            controlHeight: 38,
            fontSize: 14,
            wireframe: false,
            ...palette[mode],
          },
          components: {
            Layout: { siderBg: mode === "dark" ? "#0a1110" : "#0c2e2a" },
            Menu: {
              darkItemBg: "transparent",
              darkItemSelectedBg: palette[mode].colorPrimary,
              darkItemSelectedColor: mode === "dark" ? "#052e2b" : "#fff",
            },
            Card: {
              borderRadiusLG: 16,
              // Misma escala que `--ui-elev-1`: las tarjetas descansan, no flotan.
              boxShadowTertiary:
                mode === "dark"
                  ? "0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 30px -18px rgba(0, 0, 0, 0.75)"
                  : "0 1px 2px rgba(16, 24, 40, 0.04), 0 10px 28px -18px rgba(16, 24, 40, 0.18)",
            },
            Table: {
              headerBg: mode === "dark" ? "#16231f" : "#fbfaf8",
              headerColor: mode === "dark" ? "#9db3ae" : "#5b6b67",
              headerSplitColor: "transparent",
              rowHoverBg: mode === "dark" ? "#132a26" : "#f2fbf9",
              borderColor: mode === "dark" ? "#243631" : "#e6e9e5",
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
