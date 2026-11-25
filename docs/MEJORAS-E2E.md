# Pruebas de extremo a extremo con Playwright

La suite E2E ejercita el cliente real en Chromium contra una API Express efímera y una base de
datos dedicada. No comparte datos con el desarrollo ni con las pruebas unitarias del servidor.

## Alcance

- **Sesión:** redirección a `/login` sin token, error con credenciales incorrectas y login válido
  con la sesión persistida en `localStorage`.
- **Categorías:** creación, edición y eliminación desde el panel, con confirmación incluida.
- **Productos y stock:** alta de producto con categoría y registro de una entrada; se comprueba el
  mensaje de éxito y el stock en la tabla.
- **Permisos:** un `operador` no ve los menús de Usuarios/Finanzas y es redirigido al inicio si
  intenta abrir esas rutas.

## Arquitectura

| Elemento | Valor | Observación |
| --- | --- | --- |
| Base de datos | `inventario_e2e_test` | Se borra y migra al inicio; el nombre termina en `_test`. |
| API | `http://127.0.0.1:3100` | `npm run dev` dentro de `server/`, con el entorno E2E. |
| Cliente | `http://127.0.0.1:5174` | Vite con `--host 127.0.0.1` y proxy `/api` a la API. |
| Navegador | Chromium | En local se puede usar el Chrome instalado; en CI, el de Playwright. |

`client/e2e/env.ts` lee `server/.env.test` en local y deja que las variables del proceso tengan
prioridad, de modo que CI no necesita archivos `.env`. La preparación de la base se ejecuta al
evaluar `playwright.config.ts`, antes de que Playwright levante los servidores; un centinela evita
que se repita cuando el runner recarga la configuración dentro de los workers.

Las fixtures de `client/e2e/fixtures.ts` inician sesión por HTTP una vez y reutilizan el token:

- `adminPage`: contexto con `localStorage` precargado, para no repetir login en cada prueba.
- `adminApi`: `APIRequestContext` con `Authorization: Bearer`, para preparar datos de apoyo.
- `unique()`: prefijo con marca de tiempo y aleatorio para evitar colisiones entre ejecuciones.

Las rutas de la API incluyen `/api` en la llamada porque el `baseURL` del contexto de Playwright
es el origen del servidor, no `${origen}/api`.

## Ejecución local

```bash
cd client
npm ci
npm run test:e2e          # requiere los navegadores de Playwright
npm run test:e2e:ui       # modo interactivo
```

Para usar el Chrome ya instalado y evitar la descarga de navegadores:

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:e2e
```

En bash: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

Los puertos se pueden cambiar con `E2E_API_PORT` y `E2E_WEB_PORT`. El arranque de los servidores
se ajusta con `E2E_WEB_TIMEOUT` (milisegundos).

## Integración continua

El job `e2e` de `.github/workflows/ci.yml` levanta un servicio MariaDB, instala las dependencias de
`server` y `client`, ejecuta `npx playwright install --with-deps chromium` y corre
`npm run test:e2e`. Las variables de base y `JWT_SECRET` se definen en el job; `reuseExistingServer`
está desactivado en CI para garantizar una base limpia.

## Mantenimiento

- Preferir selectores por rol y etiqueta (`getByRole`, `getByLabel`) antes que clases de Ant Design.
- Para los `Select`, abrir el combobox, escribir el valor y pulsar `Enter`; la opción virtualizada
  puede no ser estable para `click()`.
- Si se añade una ruta protegida nueva, ampliar `roles.spec.ts` para verificar el menú y la
  redirección.
- Los artefactos en `test-results/`, `playwright-report/` y `blob-report/` están ignorados por Git.
