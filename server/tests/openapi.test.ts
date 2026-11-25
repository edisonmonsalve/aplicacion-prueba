import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { buildOpenApiDocument, collectRoutes, operationKey } from "../src/docs/openapi.js";
import { buildClientContract } from "../src/docs/client-contract.js";
import { operationMeta } from "../src/docs/operations.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const doc = buildOpenApiDocument();

type AnyRecord = Record<string, unknown>;

function* walk(value: unknown): Generator<AnyRecord> {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item);
    return;
  }
  const record = value as AnyRecord;
  yield record;
  for (const item of Object.values(record)) yield* walk(item);
}

describe("especificación OpenAPI", () => {
  it("declara OpenAPI 3.1 y autenticación bearer", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect((doc.components.securitySchemes as AnyRecord).bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
  });

  it("documenta todas las rutas del router de Express", () => {
    const routes = collectRoutes();
    expect(routes.length).toBeGreaterThan(90);
    for (const route of routes) {
      expect(Object.keys(doc.paths)).toContain(route.path);
      const methods = doc.paths[route.path] as AnyRecord;
      expect(Object.keys(methods)).toContain(route.method);
      expect(operationMeta[operationKey(route.method, route.path)]).toBeDefined();
    }
    const total = Object.values(doc.paths).reduce((count, methods) => count + Object.keys(methods).length, 0);
    expect(total).toBe(routes.length);
  });

  it("usa operationId únicos y respuestas de error coherentes", () => {
    const ids: string[] = [];
    for (const methods of Object.values(doc.paths)) {
      for (const raw of Object.values(methods as AnyRecord)) {
        const operation = raw as AnyRecord;
        ids.push(operation.operationId as string);
        expect(operation.tags).toHaveLength(1);
        expect(operation.summary).toBeTruthy();
        expect(operation.parameters).toBeInstanceOf(Array);
        const responses = operation.responses as AnyRecord;
        expect(responses["400"]).toBeDefined();
        expect(responses["500"]).toBeDefined();
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marca como públicas solo health y login", () => {
    const publicOps = ["/api/health", "/api/auth/login"];
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const raw of Object.values(methods as AnyRecord)) {
        const operation = raw as AnyRecord;
        const isPublic = publicOps.includes(path);
        if (isPublic) expect(operation.security).toEqual([]);
        else expect(operation.security).toBeUndefined();
      }
    }
  });

  it("resuelve todas las referencias a componentes", () => {
    const refs: string[] = [];
    for (const node of walk(doc)) {
      if (typeof node.$ref === "string" && node.$ref.startsWith("#/components/schemas/")) {
        refs.push(node.$ref.replace("#/components/schemas/", ""));
      }
    }
    expect(refs.length).toBeGreaterThan(50);
    const available = Object.keys(doc.components.schemas);
    for (const name of refs) expect(available).toContain(name);
  });

  it("derive los cuerpos de los esquemas Zod reales", () => {
    const login = (doc.paths["/api/auth/login"] as AnyRecord).post as AnyRecord;
    const body = (login.requestBody as AnyRecord).content as AnyRecord;
    expect(body["application/json"]).toMatchObject({
      schema: { $ref: "#/components/schemas/LoginRequest" },
    });
    const schemas = doc.components.schemas as AnyRecord;
    expect(schemas.LoginRequest).toMatchObject({ required: ["email", "password"] });
  });

  it("sirve la spec y la interfaz pública", async () => {
    const json = await request(app).get("/api/openapi.json").expect(200);
    expect(json.body.openapi).toBe("3.1.0");
    const html = await request(app).get("/api/docs").expect(200);
    expect(html.headers["content-type"]).toMatch(/html/);
    expect(html.text).toContain("/api/openapi.json");
    expect(html.text).toContain("swagger-ui-bundle.js");
  });

  it("mantiene actualizados los artefactos generados", async () => {
    const json = await readFile(resolve(root, "docs/api/openapi.json"), "utf8");
    expect(JSON.parse(json)).toEqual(doc);
    const contract = await readFile(
      resolve(root, "client/src/services/api-contract.generated.ts"),
      "utf8"
    );
    expect(contract.replace(/\r\n/g, "\n")).toBe(buildClientContract(doc));
  });
});
