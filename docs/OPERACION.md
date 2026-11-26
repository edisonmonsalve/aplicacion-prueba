# Operación

Guía para desplegar, respaldar y observar Signal sin depender de un proveedor concreto. Los
comandos de Docker asumen el kit de `docker-compose.prod.yml`; los de MariaDB sirven también para
una instalación local.

## 1. Copias de seguridad de MariaDB

### Qué respaldar

| Dato | Dónde vive | Frecuencia sugerida |
| --- | --- | --- |
| Base de datos | Volumen `signal-prod_mariadb_data` / servidor MariaDB | Diaria |
| `.env` y secretos | Fuera del repositorio | Al cambiar |
| Imágenes y configuración | Repositorio + registro de imágenes | Por despliegue |

La base contiene toda la operación (inventario, facturas, asientos y auditoría). El volumen de
Docker **no es una copia de seguridad**: si se borra con `docker compose down -v`, no se puede
recuperar. Hay que exportar la base a un archivo y llevarlo fuera del host.

### Crear una copia

Desde la raíz del repositorio, con el kit de producción en marcha:

```bash
npm --prefix server run backup:db
```

El script ejecuta `mariadb-dump --single-transaction --routines --triggers --events` dentro del
contenedor `db`, comprime en el host y guarda en `BACKUP_DIR` (`./backups` por defecto) con nombre
`signal-<DB_NAME>-<fecha>.sql.gz`. Verifica la integridad con `gzip -t` antes de terminar.

Variables opcionales:

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `BACKUP_DIR` | `backups` | Destino local; monta ahí el NAS o sincronízalo a almacenamiento de objetos. |
| `COMPOSE_FILE` | `docker-compose.prod.yml` | Kit de Compose a usar. |

Sin Docker (cliente `mariadb-dump` instalado en el host):

```bash
mariadb-dump --single-transaction --routines --triggers --events \
  -h 127.0.0.1 -P 3306 -u root -p inventario | gzip > "signal-$(date +%Y%m%d-%H%M).sql.gz"
```

- `--single-transaction` evita bloquear la operación con InnoDB.
- Guarda el archivo fuera del host (almacenamiento de objetos, NAS o servidor distinto).
- Cifra la copia si sale del perímetro: `age`, GPG o el cifrado del almacenamiento.
- Conserva al menos 7 copias diarias, 4 semanales y 12 mensuales, o lo que exija la normativa
  aplicable. Ajusta la retención a la política de la empresa.
- Comprueba el tamaño y que el archivo no esté vacío. Un `gzip -t` detecta archivos truncados.

### Restaurar

> La restauración sobrescribe datos. Hazlo en una base nueva o con la aplicación detenida.

Desde la raíz del repositorio (PowerShell):

```powershell
$env:RESTORE_DB='si'
npm --prefix server run restore:db -- backups/signal-inventario-20260101-0200.sql.gz
```

El script valida el archivo con `gzip -t`, exige la confirmación `RESTORE_DB=si`, detiene API y
cliente, restaura dentro del contenedor `db` y al terminar indica cómo arrancar de nuevo. Sin
confirmación no toca nada.

Sin Docker:

```bash
gunzip -c signal-20260101-0200.sql.gz | mariadb -h 127.0.0.1 -u root -p inventario
```

Después:

1. `curl -fsS http://localhost:8080/api/health` debe devolver `status: ok`.
2. Inicia sesión y revisa el dashboard, una factura y el visor de auditoría.
3. Ejecuta `npm run migrate:status` en local o `node dist/scripts/migrate-status.js` dentro del
   contenedor para confirmar que el esquema quedó al día.

### Probar la restauración

Una copia que nunca se ha restaurado no es una copia fiable. Una vez al trimestre:

1. Levanta una base desechable (`DB_NAME=inventario_restore_test`) con el mismo kit de Compose.
2. Restaura la última copia apuntando `RESTORE_DB=si` y `COMPOSE_FILE` al kit de prueba; el script
   rechaza bases `*_test`, así que para esta prueba usa `docker compose exec -T db sh -c
   'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" inventario_restore_test'` con la copia descomprimida.
3. Comprueba conteos básicos (`users`, `invoices`, `transactions`) y que la API arranca contra
   esa base.
4. Borra la base de prueba.

Automatización: programa `npm --prefix server run backup:db` con cron systemd/timer del host o un
cron de Contabo, y conserva 7 copias diarias, 4 semanales y 12 mensuales con los nombres ya
fechados. La rotación y el envío a almacenamiento externo son responsabilidad del host; el script
solo crea y verifica cada copia.

## 2. Migraciones y rollback

Las migraciones son **solo hacia delante**:

- Se aplican al arrancar el contenedor o con `npm run migrate`.
- `schema_migrations` guarda el checksum de cada archivo. Si alguien edita una migración ya
  aplicada, el arranque falla. La solución es restaurar el archivo y crear una migración nueva.
- `npm run migrate:status` muestra aplicadas, pendientes y archivos modificados sin tocar la base.

### Estrategia de rollback

No se ejecutan `DOWN` automáticos: un `DROP` o un `ALTER` inverso puede perder datos. El plan es:

1. **Antes de desplegar:** copia de seguridad y `migrate:status` en verde.
2. **Cambios compatibles (expand/contract):** primero se añade lo nuevo sin quitar lo viejo; el
   código nuevo se despliega; en una versión posterior se elimina lo antiguo. Así el código
   anterior sigue funcionando durante el despliegue.
3. **Rollback de aplicación:** vuelve a la imagen anterior. Si la migración fue compatible, no hay
   que tocar la base.
4. **Rollback de esquema destructivo:** restaura la copia previa al despliegue. Es la única opción
   segura si la migración borró o transformó datos.
5. **Corrección urgente:** si no se puede restaurar, crea una migración compensatoria que devuelva
   los datos a su estado anterior. Nunca edites la migración ya aplicada.

Las migraciones deben ser idempotentes cuando sea posible (`CREATE TABLE IF NOT EXISTS`,
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` cuando la versión de MariaDB lo soporte) y probarse
contra una copia real antes de producción.

## 3. Logs estructurados

La API escribe una línea JSON por evento en stdout/stderr:

```json
{"time":"2026-01-01T02:00:00.000Z","level":"info","msg":"request","requestId":"...","method":"GET","path":"/api/invoices","status":200,"durationMs":12.4}
```

- `LOG_LEVEL` controla el nivel (`debug`, `info`, `warn`, `error`, `silent`). Por defecto `info`.
- Cada respuesta lleva `X-Request-Id`; úsalo para cruzar una queja con su línea de log.
- Nunca se registran cuerpos, contraseñas, tokens ni direcciones IP. El logger además oculta
  claves que contengan `password`, `token`, `secret` o `cookie`.
- Los errores no controlados se registran con `msg: "unhandled_error"` y su traza.

En Docker:

```bash
docker compose -f docker-compose.prod.yml logs -f server
```

Para conservarlos, configura el driver de logs de Docker (`json-file` con rotación o
`journald`) o envía stdout a tu colector (Loki, Elastic, CloudWatch, etc.). No es necesario
añadir un SDK al código: el formato ya es indexable.

### Monitorización de errores

`unhandled_error` es la señal principal. Recomendaciones:

- Alerta si aparece más de X veces en 5 minutos.
- Alerta si `/api/health` devuelve 503 o no responde.
- Si se adopta un servicio (Sentry, GlitchTip), conectarlo en `errorHandler` y en
  `unhandledRejection`; el `requestId` ya está disponible para correlacionar.

## 4. Salud y métricas

| Endpoint | Acceso | Uso |
| --- | --- | --- |
| `GET /api/health` | Público | Liveness/readiness: estado de la API, uptime y latencia de `SELECT 1` |
| `GET /api/metrics` | Solo `admin` | Totales, errores 5xx, latencia media/máxima y rutas más usadas |

`/api/health` devuelve `503` con `status: "degraded"` si MariaDB no responde. El healthcheck de
Docker usa ese endpoint.

`/api/metrics` es en memoria y se reinicia con el proceso. Sirve para una lectura operativa
básica; para series históricas hay que enviar los logs o añadir un exportador de Prometheus.

Consultas útiles:

```bash
curl -fsS http://localhost:8080/api/health
TOKEN=$(curl -fsS -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ejemplo.com","password":"..."}' | jq -r .token)
curl -fsS http://localhost:8080/api/metrics -H "Authorization: Bearer $TOKEN" | jq
```

## 5. Checklist de despliegue

1. `npm ci && npm run build && npm run test:coverage` en servidor; `npm ci && npm run build` en
   cliente.
2. Copia de seguridad reciente y restauración de prueba verificada.
3. `docker compose -f docker-compose.prod.yml build`.
4. `docker compose -f docker-compose.prod.yml up -d --wait`.
5. `curl -fsS .../api/health` y revisión de `/api/metrics`.
6. Inicio de sesión, una consulta de solo lectura y revisión de logs.
7. Si algo falla: vuelve a la imagen anterior; restaura la base solo si la migración fue
   destructiva.
