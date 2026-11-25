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

- **Contraseñas:** hash con bcrypt; nunca se almacenan en claro.
- **Sesiones:** JWT firmados con HS256, emisor y audiencia fijos, expiración de 8 horas.
- **Revocación:** cada petición autenticada comprueba que el usuario siga activo y usa el rol
  actual de la base, no solo el que venía en el token.
- **Autorización:** middlewares de rol por router y reglas adicionales en los servicios.
- **Fuerza bruta:** límite de intentos en login y cambio de contraseña.
- **Cabeceras:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy` y HSTS en producción. `X-Powered-By` está desactivado.
- **Cliente estático:** el kit de producción sirve el build de Vite con Nginx, no con el servidor
  de desarrollo. Añade CSP (`script-src 'self'`), gzip, caché de assets y fallback de la SPA.
- **Contenedores:** la API y el cliente corren con usuarios sin privilegios; solo se publica el
  puerto del cliente y Nginx hace de proxy inverso de `/api`.
- **CORS:** sin cabeceras por defecto; solo se habilitan los orígenes de `CORS_ORIGINS`.
- **Validación:** Zod valida el entorno al arrancar y rechaza secretos de ejemplo o demasiado
  cortos.
- **Límite de cuerpo:** las peticiones JSON se limitan a 1 MB.
- **Datos sensibles:** el rol `operador` no recibe costes ni márgenes, incluido el dashboard.
- **Secretos:** `.env` y `.env.test` están ignorados por Git; los ejemplos no contienen valores
  utilizables y los `.dockerignore` excluyen secretos, `node_modules` y `dist`.

## Lista de verificación para desplegar

1. Define `JWT_SECRET` y `DB_ROOT_PASSWORD` con valores aleatorios de al menos 32 bytes.
2. Termina TLS en Nginx o en un proxy externo. `docker-compose.prod.yml` ya fija
   `TRUST_PROXY=1` y sobrescribe `X-Forwarded-For`; si añades otro proxy delante, ajústalo.
3. Enumera los orígenes reales en `CORS_ORIGINS`; no uses `*`.
4. Usa un usuario de MariaDB con permisos limitados a la base de la aplicación fuera del kit local.
5. Revisa las dependencias según la política de actualización de abajo.
6. Configura copias de seguridad y prueba la restauración.
7. Revisa los logs sin volcar tokens, contraseñas ni datos personales.
8. Si cambias las credenciales de MariaDB en Docker, recrea el volumen con
   `docker compose down -v`.

## Actualización de dependencias

- **Cadencia:** revisión mensual de `npm audit` y de las alertas de Dependabot. Las
  correcciones de seguridad críticas o altas se aplican en cuanto haya versión disponible.
- **Puerta en CI:** cada push ejecuta `npm audit --omit=dev --audit-level=high` en servidor y
  cliente. Una vulnerabilidad alta o crítica en dependencias de producción rompe la build.
- **Producción primero:** las vulnerabilidades de dependencias de producción tienen prioridad.
  Las de desarrollo se revisan y corrigen en la siguiente ventana mensual.
- **Actualizaciones:** Dependabot abre PRs mensuales para npm y semanales para Docker y GitHub
  Actions. Las actualizaciones mayores se prueban con la suite completa antes de fusionarse.
- **Fijación:** se versionan `package-lock.json` y las imágenes Docker por etiqueta. No se usa
  `latest` en los Dockerfiles del repositorio.
- **Sin `npm audit fix --force`:** los cambios de versión mayor se hacen con revisión y pruebas,
  nunca automáticamente en CI.

## Limitaciones conocidas

- El token se guarda en `localStorage`; una XSS podría exfiltrarlo. El cliente estático aplica
  una CSP con `script-src 'self'`, lo que bloquea scripts externos, pero no elimina el riesgo de
  una inyección propia. A medio plazo, valorar cookies `HttpOnly` con protección CSRF.
- El rate limiting es en memoria: con varias réplicas hay que usar un almacén compartido.
- El kit Docker usa `root` de MariaDB para simplificar el arranque local. En un despliegue real
  usa un usuario dedicado con permisos solo sobre la base de la aplicación.
- La suite E2E usa credenciales demo y una base desechable; no debe apuntar a producción.
- El kit Docker no se ha podido ejecutar en el equipo de desarrollo por no tener Docker; la
  validación es estática hasta probarlo en una máquina con Docker o en CI.

## Rotación de secretos

Al cambiar `JWT_SECRET`, todas las sesiones existentes quedan invalidadas. Al cambiar la
contraseña de MariaDB en Docker, el volumen conserva la anterior: hay que recrearlo con
`docker compose down -v` antes de volver a levantar.
