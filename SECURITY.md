# Seguridad

## Versiones soportadas

La rama `main` recibe correcciones de seguridad. Las ramas de trabajo y los despliegues de
demostración no tienen soporte garantizado.

## Cómo reportar una vulnerabilidad

No abras un issue público con detalles explotables. Usa la pestaña **Security → Report a
vulnerability** del repositorio en GitHub para enviar un aviso privado.

Incluye:

- Versión o commit afectado.
- Pasos mínimos para reproducir el problema.
- Impacto esperado.
- Una propuesta de corrección, si la tienes.

No incluyas secretos reales, datos personales ni volcados de producción en el reporte.

## Medidas implementadas

- **Contraseñas:** hash con bcrypt; nunca se almacenan en claro. Política explícita: mínimo 10
  caracteres, al menos una letra y un número, y rechazo de contraseñas habituales. Se aplica al
  alta de usuarios, al cambio propio y al seed de administrador.
- **Sesiones:** token de acceso JWT firmado con HS256, emisor y audiencia fijos, y 15 minutos de
  vida. Refresh token opaco de 7 días, guardado solo como hash SHA-256 y rotado en cada uso; la
  reutilización de uno ya rotado cierra todas las sesiones del usuario.
- **Revocación:** cada petición autenticada comprueba que el usuario siga activo y usa el rol
  actual de la base, no solo el que venía en el token. Cambiar la contraseña revoca los refresh
  tokens.
- **Autorización:** middlewares de rol por router y reglas adicionales en los servicios.
- **Fuerza bruta:** límite por IP en login, refresh y cambio de contraseña, más bloqueo temporal
  de la cuenta tras 5 intentos fallidos (15 minutos por defecto). El bloqueo persiste en la base.
- **Auditoría de acceso:** los intentos fallidos y los bloqueos se registran en `audit_log`
  (entidad `auth`) con el correo intentado y el motivo, sin contraseñas ni hashes.
- **Cabeceras:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy` y HSTS en producción. `X-Powered-By` está desactivado.
- **Cliente estático:** el kit de producción sirve el build de Vite con Nginx, no con el servidor
  de desarrollo. Añade CSP (`script-src 'self'`), gzip, caché de assets y fallback de la SPA.
- **Contenedores:** la API y el cliente corren con usuarios sin privilegios; MariaDB usa
  `DB_APP_USER`, no `root`, y solo se publica el puerto del cliente, con Nginx de proxy inverso
  de `/api`.
- **CORS:** sin cabeceras por defecto; solo se habilitan los orígenes de `CORS_ORIGINS`.
- **Validación:** Zod valida el entorno al arrancar y rechaza secretos de ejemplo o demasiado
  cortos.
- **Límite de cuerpo:** las peticiones JSON se limitan a 7 MB para permitir adjuntos de compra
  en base64; cada adjunto se valida por MIME, cabecera mágica y tamaño máximo de 5 MB.
- **Datos sensibles:** el rol `operador` no recibe costes ni márgenes, incluido el dashboard.
- **Documentación de API:** `/api/docs` y `/api/openapi.json` responden `404` en producción;
  se exponen solo fuera de ella o con `API_DOCS_ENABLED=1`.
- **Observabilidad:** logs JSON por petición con `X-Request-Id`, sin cuerpos ni credenciales;
  `/api/health` incluye latencia de base y `/api/metrics` (solo admin) expone totales, errores y
  latencia.
- **Secretos:** `.env` y `.env.test` están ignorados por Git; los ejemplos no contienen valores
  utilizables y los `.dockerignore` excluyen secretos, `node_modules` y `dist`. CI ejecuta
  `gitleaks` y la revisión de dependencias en cada Pull Request.

## Lista de verificación para desplegar

1. Define `JWT_SECRET`, `DB_ROOT_PASSWORD` y `DB_APP_PASSWORD` con valores aleatorios de al menos
   32 bytes.
2. Termina TLS en Nginx o en un proxy externo. `docker-compose.prod.yml` ya fija
   `TRUST_PROXY=1` y sobrescribe `X-Forwarded-For`; si añades otro proxy delante, ajústalo.
3. Enumera los orígenes reales en `CORS_ORIGINS`; no uses `*`.
4. El kit ya usa `DB_APP_USER` con permisos sobre la base de la aplicación; en un despliegue propio
   limita además los permisos DDL a la ventana de migración.
5. Revisa las dependencias según la política de actualización de abajo y los avisos de `gitleaks`.
6. Configura copias de seguridad y prueba la restauración siguiendo
   [`docs/OPERACION.md`](docs/OPERACION.md).
7. Revisa los logs sin volcar tokens, contraseñas ni datos personales; alerta sobre
   `unhandled_error` y las respuestas 503 de `/api/health`.
8. Si cambias las credenciales de MariaDB en Docker, recrea el volumen con
   `docker compose down -v`.

## Actualización de dependencias

- **Cadencia:** revisión mensual de `npm audit` y de las alertas de Dependabot. Las
  correcciones de seguridad críticas o altas se aplican en cuanto haya versión disponible.
- **Puerta en CI:** cada push ejecuta `npm audit --omit=dev --audit-level=high` en servidor y
  cliente, y cada Pull Request añade `dependency-review` y `gitleaks` sobre el historial. Una
  vulnerabilidad alta o crítica en dependencias de producción rompe la build. `dependency-review`
  pasa a ser bloqueante cuando se habilita el grafo de dependencias en Settings → Security y se
  define la variable `DEPENDENCY_GRAPH_ENABLED=true`; hasta entonces es informativo y `npm audit`
  mantiene la puerta estricta. `gitleaks` usa una allowlist estrecha para los valores ficticios de
  CI y pruebas.
- **Producción primero:** las vulnerabilidades de dependencias de producción tienen prioridad.
  Las de desarrollo se revisan y corrigen en la siguiente ventana mensual.
- **Actualizaciones:** Dependabot abre PRs mensuales para npm y semanales para Docker y GitHub
  Actions. Las actualizaciones mayores se prueban con la suite completa antes de fusionarse.
- **Fijación:** se versionan `package-lock.json` y las imágenes Docker por etiqueta. No se usa
  `latest` en los Dockerfiles del repositorio.
- **Sin `npm audit fix --force`:** los cambios de versión mayor se hacen con revisión y pruebas,
  nunca automáticamente en CI.

## Limitaciones conocidas

- El token de acceso y el refresh token se guardan en `localStorage`; una XSS podría
  exfiltrarlos. El cliente estático aplica una CSP con `script-src 'self'`, lo que bloquea scripts
  externos, pero no elimina el riesgo de una inyección propia. A medio plazo, valorar cookies
  `HttpOnly` con protección CSRF. Los tokens de acceso son de 15 minutos y los refresh rotan, lo
  que reduce la ventana de abuso.
- El rate limiting por IP es en memoria: con varias réplicas hay que usar un almacén compartido.
  El bloqueo por cuenta sí persiste en MariaDB.
- Las métricas de `/api/metrics` son en memoria y se reinician con el proceso; para histórico hay
  que enviar los logs a un colector.
- La suite E2E usa credenciales demo y una base desechable; no debe apuntar a producción.
- El kit Docker no se ha podido ejecutar en el equipo de desarrollo por no tener Docker; el
  workflow `preview.yml` lo construye y prueba en CI en cada Pull Request.

## Rotación de secretos

Al cambiar `JWT_SECRET`, los tokens de acceso existentes quedan invalidados, pero los refresh
tokens guardados en la base siguen vigentes y emitirán tokens nuevos. Para cerrar todas las
sesiones, revoca los refresh tokens:

```sql
UPDATE refresh_tokens SET revoked_at = NOW() WHERE revoked_at IS NULL;
```

Al cambiar la contraseña de MariaDB en Docker, el volumen conserva la anterior: hay que recrearlo
con `docker compose down -v` antes de volver a levantar.
