import { HEALTH_PATH, apiMounts } from "../routes.js";
import { componentSchemas, schemaRef } from "./schema-registry.js";
import { operationMeta, type HttpMethod, type OperationMeta } from "./operations.js";

interface RouteLayer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
  handle?: { stack?: RouteLayer[] };
}

export interface ApiRoute {
  method: HttpMethod;
  /** Rutatal como la declara Express, con `:id` y sin normalizar. */
  expressPath: string;
  /** Ruta OpenAPI, con `{id}` y sin barra final. */
  path: string;
}

const METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete"];

function toOpenApiPath(prefix: string, routePath: string | string[]): string {
  const parts = Array.isArray(routePath) ? routePath : [routePath];
  return parts.map((part) => {
    const joined = `${prefix}${part}`.replace(/\/+/g, "/");
    return joined.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}").replace(/(.)\/$/, "$1");
  })[0];
}

/**
 * Rutas leídas del router real de Express. Si se añade una ruta nueva sin tocar
 * esta documentación, aparece igualmente en la spec (con metadata genérica).
 */
export function collectRoutes(): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const add = (method: string, expressPath: string, path: string) => {
    if (!METHODS.includes(method as HttpMethod)) return;
    routes.push({ method: method as HttpMethod, expressPath, path });
  };

  add("get", HEALTH_PATH, HEALTH_PATH);
  for (const mount of apiMounts) {
    for (const layer of (mount.router as unknown as { stack: RouteLayer[] }).stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        const routePath = Array.isArray(layer.route.path) ? layer.route.path[0] : layer.route.path;
        add(method, `${mount.path}${routePath}`, toOpenApiPath(mount.path, layer.route.path));
      }
    }
  }
  return routes;
}

export const operationKey = (method: HttpMethod, path: string) => `${method.toUpperCase()} ${path}`;

function operationId(method: HttpMethod, path: string): string {
  const words = path.split("/").filter(Boolean).join(" ").replace(/[{}]/g, "");
  const suffix = words
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");
  return `${method}${suffix}`;
}

function fallbackMeta(method: HttpMethod, path: string): OperationMeta {
  const readable = path
    .replace(/^\/api\//, "")
    .split("/")
    .filter(Boolean)
    .join(" · ")
    .replace(/[{}]/g, "");
  return { tag: "General", summary: `${method.toUpperCase()} ${readable}` };
}

function objectSchema(name: string) {
  return componentSchemas[name] as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

function queryParameters(schemaName: string) {
  const schema = objectSchema(schemaName);
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: property,
  }));
}

function pathParameters(path: string, meta: OperationMeta) {
  const names = Array.from(path.matchAll(/\{([^}]+)\}/g), (match) => match[1]);
  return names.map((name) => ({
    name,
    in: "path",
    required: true,
    schema: schemaRef(meta.params?.[name] ?? (name === "anio" ? "AnioParam" : "IdParam")),
  }));
}

const errorResponse = (description: string, ref: string) => ({
  description,
  content: { "application/json": { schema: schemaRef(ref) } },
});

function buildOperation(method: HttpMethod, path: string, meta: OperationMeta) {
  const isPublic = meta.roles === "public";
  const successStatus = meta.status ?? 200;
  const responses: Record<string, unknown> = {
    [String(successStatus)]: {
      description: successStatus === 201 ? "Recurso creado" : "Operación completada",
      ...(meta.response && {
        content: { "application/json": { schema: schemaRef(meta.response) } },
      }),
    },
    "400": errorResponse("Datos inválidos (errores de validación)", "ValidationErrorResponse"),
  };
  if (!isPublic) {
    responses["401"] = errorResponse("Token ausente, inválido o expirado", "ErrorResponse");
    responses["403"] = errorResponse("Rol sin permiso para esta operación", "ErrorResponse");
  }
  if (["post", "put", "patch", "delete"].includes(method) && meta.tag !== "Sesión") {
    responses["409"] = errorResponse("Conflicto: recurso duplicado o en uso", "ErrorResponse");
  }
  responses["500"] = errorResponse("Error interno del servidor", "ErrorResponse");

  const operation: Record<string, unknown> = {
    operationId: operationId(method, path),
    tags: [meta.tag],
    summary: meta.summary,
    ...(meta.description && { description: meta.description }),
    ...(isPublic ? { security: [] } : {}),
    parameters: [...pathParameters(path, meta), ...(meta.query ? queryParameters(meta.query) : [])],
    responses,
  };
  if (meta.body) {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: schemaRef(meta.body) } },
    };
  }
  return operation;
}

/** Especificación OpenAPI 3.1 derivada de las rutas y de los esquemas Zod reales. */
export function buildOpenApiDocument() {
  const routes = collectRoutes();
  const paths: Record<string, Record<string, unknown>> = {};
  const tags = new Set<string>();

  for (const route of routes) {
    const key = operationKey(route.method, route.path);
    const meta = operationMeta[key] ?? fallbackMeta(route.method, route.path);
    tags.add(meta.tag);
    paths[route.path] ??= {};
    paths[route.path][route.method] = buildOperation(route.method, route.path, meta);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Signal · API de inventario, facturación y finanzas",
      version: "1.0.0",
      description:
        "Contrato HTTP generado desde los esquemas Zod que validan las peticiones en tiempo de ejecución. " +
        "Todas las operaciones salvo el login y `health` requieren `Authorization: Bearer <token>`.",
    },
    servers: [
      { url: "/", description: "Servidor donde se sirve esta documentación" },
      { url: "http://localhost:3000", description: "Desarrollo local" },
    ],
    tags: Array.from(tags).map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        ...componentSchemas,
        ErrorResponse: {
          type: "object",
          required: ["message"],
          properties: { message: { type: "string" } },
          additionalProperties: false,
        },
        ValidationErrorResponse: {
          type: "object",
          required: ["message", "errors"],
          properties: {
            message: { type: "string" },
            errors: { type: "array", items: { type: "object" } },
          },
          additionalProperties: false,
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}
