type JsonSchema = Record<string, unknown>;
type OpenApiDocument = {
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};

type JsonResponse = {
  content?: Record<string, { schema?: { $ref?: string } }>;
};

/** Convierte el subconjunto de JSON Schema que emite Zod en tipos TypeScript. */
function tsType(value: unknown): string {
  if (!value || typeof value !== "object") return "unknown";
  const schema = value as JsonSchema;
  if (typeof schema.$ref === "string") return schema.$ref.split("/").pop() as string;
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.map((item) => JSON.stringify(item)).join(" | ");
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map(tsType).join(" | ");
  if (Array.isArray(schema.allOf)) return schema.allOf.map(tsType).join(" & ");

  switch (schema.type) {
    case "object": {
      const properties = schema.properties as Record<string, unknown> | undefined;
      if (!properties || !Object.keys(properties).length) return "Record<string, unknown>";
      const required = new Set((schema.required as string[] | undefined) ?? []);
      const lines = Object.entries(properties).map(([key, property]) => {
        const name = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
        return `  ${name}${required.has(key) ? "" : "?"}: ${tsType(property)};`;
      });
      return `{\n${lines.join("\n")}\n}`;
    }
    case "array": {
      const item = tsType(schema.items);
      return item.includes(" | ") ? `(${item})[]` : `${item}[]`;
    }
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}

interface Endpoint {
  method: string;
  path: string;
  operationId: string;
  body?: string;
  response?: string;
}

const nameOfRef = (ref: string) => ref.split("/").pop() as string;

/** Contrato TypeScript para el cliente, generado desde la misma spec OpenAPI. */
export function buildClientContract(doc: OpenApiDocument): string {
  const typeLines = Object.entries(doc.components.schemas).map(([name, schema]) => {
    return `/** Generado desde el esquema Zod \`${name}\`. */\nexport type ${name} = ${tsType(schema)};`;
  });

  const endpoints: Endpoint[] = [];
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, rawOperation] of Object.entries(methods)) {
      const operation = rawOperation as {
        operationId: string;
        requestBody?: JsonResponse;
        responses?: Record<string, JsonResponse>;
      };
      const bodyRef = operation.requestBody?.content?.["application/json"]?.schema?.$ref;
      const successStatus = Object.keys(operation.responses ?? {}).find((status) =>
        status.startsWith("2")
      );
      const responseRef = successStatus
        ? operation.responses?.[successStatus]?.content?.["application/json"]?.schema?.$ref
        : undefined;
      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId,
        ...(bodyRef ? { body: nameOfRef(bodyRef) } : {}),
        ...(responseRef ? { response: nameOfRef(responseRef) } : {}),
      });
    }
  }

  const route = (endpoint: Endpoint) => `${endpoint.method} ${endpoint.path}`;
  const routes = endpoints.map((endpoint) => `  | "${route(endpoint)}"`).join("\n");
  const withBody = endpoints.filter((endpoint) => endpoint.body);
  const requestKeys = withBody.map(
    (endpoint) => `  "${route(endpoint)}": ${endpoint.body};`
  );
  const withResponse = endpoints.filter((endpoint) => endpoint.response);
  const responseBlock = withResponse.length
    ? `export type ApiResponses = {\n${withResponse
        .map((endpoint) => `  "${route(endpoint)}": ${endpoint.response};`)
        .join("\n")}\n};`
    : "export type ApiResponses = Record<never, never>;";
  const bodyRouteKeys = withBody.map((endpoint) => `  "${route(endpoint)}",`).join("\n");
  const operationIds = endpoints.map((endpoint) => `  | "${endpoint.operationId}"`).join("\n");

  return `// Generado por \`npm run openapi:export\` en server. No editar a mano.
// Fuente: esquemas Zod del servidor y rutas reales de Express.

${typeLines.join("\n\n")}

/** Todas las operaciones publicadas por el servidor, con o sin cuerpo. */
export type ApiRoutes =
${routes};

/** Cuerpo esperado por cada operación que acepta JSON. */
export interface ApiRequests {
${requestKeys.join("\n")}
}

/** Respuesta correcta de las operaciones con esquema verificado en el servidor. */
${responseBlock}

/** Operaciones que aceptan cuerpo JSON; lo usa \`apiRequest\` en runtime. */
export const apiRoutesWithBody: ReadonlySet<ApiRoutes> = new Set<ApiRoutes>([
${bodyRouteKeys}
]);

export type ApiOperationId =
${operationIds};

/** Puntos de entrada de la API, con la misma ruta que publica el servidor. */
export const apiEndpoints = {
${endpoints
  .map(
    (endpoint) =>
      `  "${endpoint.operationId}": { method: "${endpoint.method}", path: "${endpoint.path}" },`
  )
  .join("\n")}
} as const;
`;
}
