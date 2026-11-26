# Mejoras de documentación y contrato de API (OpenAPI)

> Documento de cierre de la mejora de documentación ejecutable y tipado del cliente.
> Ramas: `feat/openapi-spec` → `feat/openapi-client-types` · Spec: OpenAPI 3.1 (101 operaciones, 74 paths, 67 esquemas).

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
| **Swagger UI** | Explorador interactivo en `/api/docs`; JSON crudo en `/api/openapi.json`. Fuera de producción, o con `API_DOCS_ENABLED=1`. | Implementado |
| **Contrato del cliente** | `client/src/services/api-contract.generated.ts` generado por el exportador. | Implementado |
| **Helper tipado** | `apiRequest()` infiere cuerpo y respuesta desde la operación. | Implementado en los 14 servicios |
| **Parámetros** | Sustitución de `{id}` en la ruta y envío de query string. | Implementado |
| **Prueba antidesfase** | Los tests fallan si la spec, el JSON o el contrato no coinciden. | Implementado (11 pruebas) |

---

## 2. Cómo funciona

```text
Esquemas Zod + router de Express  (servidor)
        ↓  npm run openapi:export
docs/api/openapi.json  ──▸  /api/openapi.json  ──▸  Swagger UI en /api/docs
        ↓  buildClientContract()
client/src/services/api-contract.generated.ts
        ↓  import
client/src/services/api.ts  →  apiRequest()  →  los 14 servicios
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

`app.ts` monta `/api/openapi.json` y `/api/docs` junto al resto de los montajes cuando
`API_DOCS_ENABLED=1` (valor por defecto fuera de producción). En producción las rutas no se
registran y responden `404`. La generación de la spec no depende de que las rutas estén activas,
así que los artefactos versionados siguen reflejando el router real. La metadata es opcional: una
ruta nueva sin resumen entra igual a la spec con un valor genérico, de modo que no puede quedar
invisible por olvidarse de documentarla.

### 2.2 Cliente

El archivo generado exporta:

- Un **tipo por esquema Zod** (`LoginRequest`, `CreateProductRequest`, …).
- `ApiRoutes`: unión de las 101 operaciones, con o sin cuerpo.
- `ApiRequests`: mapa de `"MÉTODO /api/ruta"` al tipo de cuerpo, solo para operaciones que
  aceptan JSON.
- `ApiResponses`: tipo de la respuesta correcta para las operaciones con esquema verificado.
- `apiRoutesWithBody`: conjunto runtime que permite distinguir las peticiones con cuerpo.
- `ApiOperationId`: unión con los `operationId` de la spec.
- `apiEndpoints`: correspondencia entre `operationId` y `{ method, path }`.

`apiRequest()` tiene dos firmas: con cuerpo para las operaciones que lo aceptan y sin cuerpo para
el resto. En ambos casos admite opciones:

```ts
export interface ApiRequestOptions {
  params?: Record<string, string | number>; // sustituye {id}, {lineId}, {anio}…
  query?: object;                            // query string
}

// Con cuerpo: el tipo se infiere de ApiRequests[K]
await apiRequest("PUT /api/users/{id}", input, { params: { id } });

// Sin cuerpo: el segundo argumento son las opciones
await apiRequest<"GET /api/users", Paginated<User>>("GET /api/users", { query: filters });
```

La URL se construye a partir de la ruta de la spec: se quita el prefijo `/api` (ya está en
`baseURL`) y se sustituyen los marcadores `{…}` por los valores de `params`, codificados con
`encodeURIComponent`. Si falta un parámetro, se lanza un error explícito en lugar de enviar una
URL con llaves literals.

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
4. **Respuestas inferidas.** `login` ya no declara el tipo de respuesta: `ApiResponses` sabe que
   `"POST /api/auth/login"` devuelve `LoginResponse`.
5. **Parámetros verificados.** `"PUT /api/users/{id}"` obliga a pasar `params.id`; antes era fácil
   olvidarlo o concatenar una plantilla con un valor equivocado.
6. **Antidesfase automático.** `server/tests/openapi.test.ts` comprueba que todas las rutas estén
   documentadas, que los `$ref` resuelvan, que solo `health` y `login` sean públicos, que el
   conjunto de rutas con body coincida con la spec y que los artefactos generados no estén viejos.
7. **Referencia ejecutable.** `/api/docs` permite probar las 101 operaciones sin leer código ni
   mantener una colección de Postman.
8. **Sin dependencias nuevas.** Se aprovecha `z.toJSONSchema`, disponible en la Zod 4.6.7 ya
   instalada.

Ejemplo de migración (`client/src/services/authService.ts`):

```diff
-import { api } from "./api";
-import type { AuthUser } from "@/types";
+import { apiRequest } from "./api";

-  const { data } = await api.post<{ token: string; user: AuthUser }>(
-    "/auth/login",
+  const { data } = await apiRequest("POST /api/auth/login",
     { email, password }
   );

-  await api.put("/auth/password", { currentPassword, newPassword });
+  await apiRequest("PUT /api/auth/password", { currentPassword, newPassword });
```

Y un caso con parámetros (`client/src/services/categoriesService.ts`):

```diff
-  await api.put(`/categories/${id}`, { nombre, codigo });
+  await apiRequest("PUT /api/categories/{id}", { nombre, codigo }, { params: { id } });
```

---

## 4. Alcance actual y trabajo futuro

Ya resuelto en esta iteración:

- **Servicios migrados:** los 14 módulos de `client/src/services` usan `apiRequest`; no queda
  ninguna llamada directa a `api.get/post/put/patch/delete`.
- **Sin cuerpo:** `GET` y `DELETE` usan la segunda firma del helper, con `query` o `params`.
- **Parámetros de ruta:** sustituidos desde `params`, con error explícito si falta uno.
- **Respuestas verificadas:** 16 operaciones tienen esquema de respuesta (`health`, sesión,
  altas con `{ id }`, mensajes, SKU y movimientos) y el cliente infiere esos tipos.

Pendiente o limitación:

- **Resto de respuestas:** las operaciones sin `response` en `operations.ts` siguen requiriendo
  el genérico `T`, como ya hacían los servicios. La cobertura crece añadiendo esquemas verificados
  a la metadata; no hace falta cambiar el generador.
- **Tipado de la query:** `query` acepta `object`, no valida los nombres contra `ListXQuery`. Los
  filtros siguen tipados en cada servicio.
- **Swagger UI desde CDN:** sin red no carga la interfaz, pero `/api/openapi.json` y el JSON
  versionado siguen disponibles.

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

- Servidor: `typecheck`, `lint`, `build` y **254/254 pruebas** (11 de OpenAPI).
- Cliente: `lint` y `build`, sin llamadas directas a axios en los servicios.
- Spec exportada: OpenAPI 3.1, 101 operaciones, 67 componentes.
- `git diff --check` limpio y referencias relativas del README verificadas.
