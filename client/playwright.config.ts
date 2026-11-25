import { defineConfig } from "@playwright/test";
import { apiBaseURL, apiPort, prepareDatabase, serverEnv, webBaseURL, webPort } from "./e2e/env";

const isCI = Boolean(process.env.CI);

// Playwright inicia los webServer después de evaluar la configuración, no
// después del globalSetup. Preparar la base aquí evita que el API arranque
// contra una base que todavía no existe. El centinela evita repetirlo en cada
// worker (la configuración se vuelve a cargar dentro de ellos).
if (!process.env.E2E_DB_PREPARED) {
  process.env.E2E_DB_PREPARED = "1";
  prepareDatabase();
}

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: webBaseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // En local se puede usar el Chrome instalado con PLAYWRIGHT_CHANNEL=chrome
    // y evitar la descarga; en CI se usa el Chromium de Playwright.
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      cwd: "../server",
      env: serverEnv,
      url: `${apiBaseURL}/api/health`,
      reuseExistingServer: !isCI,
      timeout: Number(process.env.E2E_WEB_TIMEOUT ?? 120_000),
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`,
      env: {
        ...serverEnv,
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
      },
      url: webBaseURL,
      reuseExistingServer: !isCI,
      timeout: Number(process.env.E2E_WEB_TIMEOUT ?? 120_000),
    },
  ],
});
