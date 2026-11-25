# Mejoras de documentación y contrato de API (OpenAPI)

> Documento de cierre de la mejora de documentación ejecutable y tipado del cliente.
> Rama: `feat/openapi-spec` · Commit: `eb5b6e1` · Spec: OpenAPI 3.1 (101 operaciones, 74 paths, 60 esquemas).

---

## 1. Resumen ejecutivo

Antes existían dos fuentes separadas para describir la API: los esquemas Zod que validan las
peticiones en el servidor y el texto del README. El cliente, por su parte, escribía las rutas y
los cuerpos a mano en cada llamada a axios. Cualquier cambio en el servidor podía dejar tanto al
README como al cliente desactualizados sin que nada lo detectara.

Ahora la descripción HTTP se **genera** desde el código real:

- Las rutas se leen del router de Express, no de una lista mantenida a parte.
- Los esquemas de petición se derivan de los mismos esquemas Zod que validan en runtime.
- La especificación se publica en el servidor y se versiona como JSON.
- El cliente recibe un contrato TypeScript generado de esa misma spec.

| Mejora | Decisión | Estado |
| --- | --- | --- |
| **Spec OpenAPI 3.1** | 101 operaciones derivadas del router; esquemas con `z.toJSONSchema`. | Implementado |
| **Swagger UI** | Explorador interactivo en `/api/docs`; JSON crudo en `/api/openapi.json`. | Implementado |
| **Contrato del cliente** | `client/src/services/api-contract.generated.ts` generado por el exportador. | Implementado |
| **Helper tipado** | `apiRequest()` infiere el cuerpo desde la operación. | Implementado (primer consumidor: `authService`) |
| **Prueba antidesfase** | Los tests fallan si la spec, el JSON o el contrato no coinciden. | Implementado |

---

## 2. Cómo funciona

```text
Esquemas Zod + router de Express  (servidor)
        ↓  npm run openapi:export
docs/api/openapi.json  ──▸  /api/openapi.json  ──▸  Swagger UI en /api/docs
        ↓  buildClientContract()
client/src/services/api-contract.generated.ts
        ↓  import
client/src/services/api.ts  →  apiRequest()  →  authService.ts
```

### 2.1 Servidor

| Archivo | Responsabilidad |
| --- | --- |
| `server/src/routes.ts` | Prefijos de montaje compartidos por `app.ts` y el generador. |
| `server/src/docs/schema-registry.ts` | Registra los esquemas Zod existentes como componentes reutilizables. |
| `server/src/docs/operations.ts` | Enriquece cada operación con resumen, etiquetas, roles y esquemas. |
| `server/src/docs/openapi.ts` | Construye el documento OpenAPI recorriendo el router real. |
| `server/src/docs/swagger-ui.ts` | HTML de Swagger UI, cargado desde CDN. |
| `server/src/docs/client-contract.ts` | Convierte el subconjunto de JSON Schema usado por Zod en tipos TS. |
| `server/src/scripts/export-openapi.ts` | Escribe el JSON versionado y el contrato del cliente. |

`app.ts` monta `/api/openapi.json` y `/api/docs` junto al resto de los montajes, por lo que la
documentación siempre describe lo que el servidor está publicando. La metadata es opcional: una
ruta nueva sin resumen entra igual a la spec con un valor genérico, de modo que no puede quedar
invisible por olvidarse de documentarla.

### 2.2 Cliente

El archivo generado exporta:

- Un **tipo por esquema Zod** (`LoginRequest`, `CreateProductRequest`, …).
- `ApiRequests`: mapa de `"MÉTODO /api/ruta"` al tipo de cuerpo, solo para operaciones que
  aceptan JSON.
- `ApiOperationId`: unión con los `operationId` de la spec.
- `apiEndpoints`: correspondencia entre `operationId` y `{ method, path }`.

`apiRequest()` consume ese mapa:

```ts
export function apiRequest<K extends keyof ApiRequests, T = unknown>(
  endpoint: K,
  body: ApiRequests[K]
): Promise<AxiosResponse<T>> {
  const [method, path] = endpoint.split(" ");
  return api.request<T>({
    method: method.toLowerCase(),
    url: path.replace(/^\/api/, ""), // baseURL ya es "/api"
    data: body,
  });
}
```

La petición HTTP es idéntica a la de antes: se usa el mismo axios, con `baseURL: "/api"`, el
interceptor que adjunta el bearer token y el manejo centralizado de 401. Lo que cambia es que
TypeScript verifica la llamada antes de compilar.

---

## 3. Beneficios

1. **Fallos en compilación, no en producción.** Si el servidor cambia `password` por `clave` en
   `LoginRequest`, al regenerar el contrato el build del cliente señala `authService.ts`. Antes
   el problema solo aparecía como un 400 en runtime.
2. **Rutas verificadas.** Un typo en `"POST /api/auth/login"` o un método equivocado no compila.
3. **Cuerpos inferidos.** En `changePassword` no se declara el tipo: TypeScript ya sabe que es
   `ChangePasswordRequest`.
4. **Antidesfase automático.** `server/tests/openapi.test.ts` comprueba que todas las rutas estén
   documentadas, que los `$ref` resuelvan, que solo `health` y `login` sean públicos y que los
   artefactos generados coincidan con la spec.
5. **Referencia ejecutable.** `/api/docs` permite probar las 101 operaciones sin leer código ni
   mantener una colección de Postman.
6. **Sin dependencias nuevas.** Se aprovecha `z.toJSONSchema`, disponible en la Zod 4.6.7 ya
   instalada.

Ejemplo de migración (`client/src/services/authService.ts`):

```diff
-import { api } from "./api";
+import { apiRequest } from "./api";

-  const { data } = await api.post<{ token: string; user: AuthUser }>(
-    "/auth/login",
+  const { data } = await apiRequest<"POST /api/auth/login", { token: string; user: AuthUser }>(
+    "POST /api/auth/login",
     { email, password }
   );

-  await api.put("/auth/password", { currentPassword, newPassword });
+  await apiRequest("PUT /api/auth/password", { currentPassword, newPassword });
```

---

## 4. Alcance actual y trabajo futuro

La mejora es una base; todavía no cubre todo el cliente:

- **Tipos de respuesta:** la spec declara respuestas, pero el generador aún no las convierte en
  tipos TS. Por eso `login` indica `T` explícitamente.
- **Parámetros de ruta:** `ApiRequests` incluye claves como `"PUT /api/users/{id}"`, pero
  `apiRequest` no sustituye `{id}`. Por ahora solo se migró `authService`, que no los usa.
- **Operaciones sin cuerpo:** los `GET` y `DELETE` siguen usando `api.get(...)` y compañía.
- **Swagger UI desde CDN:** sin red no carga la interfaz, pero `/api/openapi.json` y el JSON
  versionado siguen disponibles.

Trabajo natural siguiente: generar tipos de respuesta, añadir un sustituyente de parámetros y
migrar los servicios restantes al helper.

---

## 5. Mantenimiento

Cuando cambie un esquema o una ruta:

```bash
cd server
npm run openapi:export     # regenera docs/api/openapi.json y el contrato TS
npm test -- tests/openapi.test.ts
cd ../client
npm run build              # detecta llamadores que ya no compilan
```

Si se añade una ruta nueva, conviene completar su entrada en `operations.ts` para que la spec
tenga resumen, etiqueta y esquema de petición. No es obligatorio para que aparezca documentada.

---

## 6. Verificación

- Servidor: `typecheck`, `lint`, `build` y **251/251 pruebas** (8 nuevas de OpenAPI).
- Cliente: `lint` y `build`.
- Spec exportada: OpenAPI 3.1, 101 operaciones, 60 componentes.
- `git diff --check` limpio y referencias relativas del README verificadas.
- Commit: `eb5b6e1`, 15 archivos, 12.814 inserciones y 36 borrados.
