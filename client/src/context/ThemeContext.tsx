import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";

type Mode = "light" | "dark";
const KEY = "theme-mode";
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

  useEffect(() => {
    localStorage.setItem(KEY, mode);
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo(
    () => ({ mode, toggle: () => setMode((m) => (m === "light" ? "dark" : "light")) }),
    [mode]
  );

  return (
    <Ctx.Provider value={value}>
      <ConfigProvider
        locale={esES}
        theme={{
          algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            fontFamily: "'Plus Jakarta Sans Variable', system-ui, sans-serif",
            borderRadius: 10,
            ...palette[mode],
          },
          components: {
            Layout: { siderBg: mode === "dark" ? "#0b1412" : "#0f3d38" },
            Menu: {
              darkItemBg: "transparent",
              darkItemSelectedBg: palette[mode].colorPrimary,
              darkItemSelectedColor: mode === "dark" ? "#052e2b" : "#fff",
            },
            Card: { borderRadiusLG: 14 },
          },
        }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </Ctx.Provider>
  );
}
