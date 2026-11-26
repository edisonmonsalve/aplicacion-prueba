import { expect, request, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { adminCredentials, apiBaseURL } from "./env";

interface Session {
  token: string;
  refreshToken: string;
  user: { id: number; email: string; rol: string };
}

interface Fixtures {
  adminSession: Session;
  adminPage: Page;
  adminApi: APIRequestContext;
}

/** Inicia sesión por HTTP una vez y reutiliza la sesión en las pruebas. */
export const test = base.extend<Fixtures>({
  adminSession: async ({}, use) => {
    const api = await request.newContext({ baseURL: apiBaseURL });
    try {
      const response = await api.post("/api/auth/login", { data: adminCredentials });
      const body = await response.text();
      expect(
        response.ok(),
        `El administrador demo debe existir en la base E2E (${response.status()}): ${body}`,
      ).toBeTruthy();
      await use(JSON.parse(body) as Session);
    } finally {
      await api.dispose();
    }
  },

  adminPage: async ({ browser, baseURL, adminSession }, use) => {
    const context = await browser.newContext({
      baseURL,
      storageState: {
        cookies: [],
        origins: [
          {
            origin: String(baseURL),
            localStorage: [
              { name: "token", value: adminSession.token },
              { name: "refreshToken", value: adminSession.refreshToken },
              { name: "user", value: JSON.stringify(adminSession.user) },
            ],
          },
        ],
      },
    });
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },

  adminApi: async ({ adminSession }, use) => {
    const api = await request.newContext({
      baseURL: apiBaseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${adminSession.token}` },
    });
    try {
      await use(api);
    } finally {
      await api.dispose();
    }
  },
});

export { expect };

/** Prefijo único para no colisionar con datos de otras pruebas. */
export const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
