import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../docs/openapi.js";
import { buildClientContract } from "../docs/client-contract.js";
import { operationMeta } from "../docs/operations.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const doc = buildOpenApiDocument();

for (const [path, methods] of Object.entries(doc.paths)) {
  for (const method of Object.keys(methods)) {
    const key = `${method.toUpperCase()} ${path}`;
    if (!operationMeta[key]) throw new Error(`Falta metadata de operación para ${key}`);
  }
}

await mkdir(resolve(root, "docs/api"), { recursive: true });
await mkdir(resolve(root, "client/src/services"), { recursive: true });
await writeFile(resolve(root, "docs/api/openapi.json"), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
await writeFile(
  resolve(root, "client/src/services/api-contract.generated.ts"),
  buildClientContract(doc),
  "utf8"
);
console.log(
  `OpenAPI exportado: ${Object.values(doc.paths).reduce((n, m) => n + Object.keys(m).length, 0)} operaciones, ` +
    `${Object.keys(doc.components.schemas).length} esquemas`
);
