import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = dirname(fileURLToPath(import.meta.url));
export const clientDir = resolve(e2eDir, "..");
export const serverDir = resolve(clientDir, "../server");

/** Lee un `.env` sin dependencias nuevas; las variables del proceso ganan. */
function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const separator = text.indexOf("=");
    if (separator < 1) continue;
    let value = text.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[text.slice(0, separator).trim()] = value;
  }
  return values;
}

const fromProcess: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) fromProcess[key] = value;
}

export const apiPort = Number(process.env.E2E_API_PORT ?? 3100);
export const webPort = Number(process.env.E2E_WEB_PORT ?? 5174);
// La base URL es el origen: las rutas incluyen `/api` para que la resolución
// de Playwright no pierda el prefijo.
export const apiBaseURL = `http://127.0.0.1:${apiPort}`;
export const webBaseURL = `http://127.0.0.1:${webPort}`;

export const adminCredentials = {
  email: "demo@demo.com",
  password: "Demo12345!",
};

/**
 * Entorno del API y de la base de pruebas. En local se toman las credenciales
 * de `server/.env.test`; en CI vienen del job. La base siempre es propia y
 * termina en `_test` para que `test:db` pueda borrarla con seguridad.
 */
export const serverEnv: Record<string, string> = {
  ...parseEnvFile(resolve(serverDir, ".env.test")),
  ...fromProcess,
  DB_NAME: "inventario_e2e_test",
  PORT: String(apiPort),
  // La suite repite logins; el límite se prueba en su propia batería unitaria.
  RATE_LIMIT_DISABLED: "1",
};

/** Recrea la base E2E y crea el administrador demo antes de levantar los servidores. */
export function prepareDatabase(): void {
  const run = (args: string[]) => {
    if (process.platform === "win32") {
      // npm es un .cmd: se invoca con cmd.exe para evitar DEP0190.
      execFileSync("cmd.exe", ["/d", "/s", "/c", "npm", ...args], {
        cwd: serverDir,
        env: serverEnv,
        stdio: "inherit",
      });
      return;
    }
    execFileSync("npm", args, {
      cwd: serverDir,
      env: serverEnv,
      stdio: "inherit",
    });
  };

  run(["run", "test:db"]);
  run(["run", "seed:admin", "--", adminCredentials.email, adminCredentials.password]);
}
