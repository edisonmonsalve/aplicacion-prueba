# Sistema de Usuarios e Inventario

Aplicación fullstack para gestionar usuarios, productos, categorías, movimientos de stock y cotizaciones. Ya está creado el esquema base del módulo financiero (presupuestos por periodo, transacciones y capital); la API y la UI vienen en el siguiente paso. Proyecto de práctica enfocado en CRUD completo, tablas con paginación en servidor, formularios con validación, reglas de negocio, transacciones SQL, cálculos monetarios y máquinas de estado.

El módulo de finanzas tiene su propio documento de requisitos: [`docs/REQUISITOS-FINANZAS.md`](docs/REQUISITOS-FINANZAS.md). El módulo de cotizaciones está documentado en [`docs/requisitos-cotizaciones.md`](docs/requisitos-cotizaciones.md).

## Funcionalidades

- **Autenticación:** inicio de sesión con JWT, rutas protegidas por rol y cambio de la propia contraseña.
- **Roles:** admin, contador, operador y consulta. `contador` y `consulta` quedan preparados para el módulo financiero.
- **Costos y márgenes:** `admin`, `contador` y `consulta` ven el costo de los productos y el margen; el `operador` no. Solo `admin` puede fijar el costo de un producto o el de una entrada de stock.
- **Usuarios** (solo admin): listar con búsqueda, filtros y paginación; crear, editar y desactivar.
- **Categorías:** listar, crear, editar y eliminar (si no tienen productos).
- **Productos:** listar con búsqueda, filtros por categoría, estado y stock bajo; crear, editar y desactivar.
- **Movimientos de stock:** registrar entradas y salidas con motivo, e historial filtrable por producto y tipo.
- **Alertas:** indicador visual de productos con stock por debajo del mínimo.
- **Presupuestos:** crear y editar borradores con datos del cliente (email y notas incluidos) y líneas dinámicas de productos; totales calculados en el servidor (descuentos e impuestos, redondeo a 2 decimales); enviar, aprobar, rechazar y entregar con historial de estados; la entrega descuenta stock en una sola transacción; duplicar; auditoría de las ediciones; vista de impresión / PDF. El operador solo ve y duplica los suyos; el admin ve todos.
- **Base financiera (esquema):** presupuestos por periodo (`budgets`), líneas planeadas por categoría y producto (`budget_lines`) y transacciones reales inmutables con anulación (`transactions`). La API y la UI del módulo financiero se implementan en el siguiente paso.

## Stack

| Capa          | Tecnología                                               |
| ------------- | -------------------------------------------------------- |
| Frontend      | React, TypeScript, Vite, Ant Design, React Router, Axios |
| Backend       | Node.js, Express 5, TypeScript, Zod                      |
| Base de datos | MariaDB (driver `mysql2`)                                |
| Seguridad     | JWT, bcryptjs                                            |
| Pruebas y CI  | Vitest, Supertest, ESLint, GitHub Actions                |

## Roles y permisos

| Acción                                  | Admin | Contador | Operador | Consulta |
| --------------------------------------- | :---: | :------: | :------: | :------: |
| Ver categorías, productos y movimientos |  Sí   |    Sí    |    Sí    |    Sí    |
| Ver costos y márgenes                   |  Sí   |    Sí    |    No    |    Sí    |
| Fijar el costo de productos y entradas  |  Sí   |    No    |    No    |    No    |
| Crear y editar productos                |  Sí   |    No    |    Sí    |    No    |
| Registrar movimientos de stock          |  Sí   |    No    |    Sí    |    No    |
| Desactivar productos                    |  Sí   |    No    |    No    |    No    |
| Crear, editar y eliminar categorías     |  Sí   |    No    |    No    |    No    |
| Gestionar usuarios                      |  Sí   |    No    |    No    |    No    |

Los roles `contador` y `consulta` ya existen en autenticación y usuarios y ya acceden a costos y márgenes en solo lectura. El módulo financiero completo se habilitará con las tablas de `budgets`, `budget_lines` y `transactions`.

## Reglas de negocio

- **RN-01:** el SKU de un producto es único.
- **RN-02:** no se permite una salida mayor al stock disponible.
- **RN-03:** el stock actual solo cambia mediante movimientos, y cada movimiento y su actualización de stock ocurren en una única transacción.
- **RN-04:** los productos no se eliminan, se desactivan.
- **RN-05:** una categoría con productos asociados no se puede eliminar.
- **RN-06:** un usuario no puede desactivarse a sí mismo ni quitarse el rol de admin.
- **RN-07:** precios y cantidades deben ser mayores que cero.
- **RN-08:** solo `admin` fija `products.costo` y el costo unitario de una entrada; el `operador` registra productos con costo 0 y entradas con el costo del producto. Las salidas no guardan costo unitario.
- **RN-09:** el `operador` nunca recibe costos desde la API (se devuelve `null`); `contador` y `consulta` los ven, pero no pueden modificarlos.

### Presupuestos

- **RN-P01:** solo los borradores se editan o eliminan; un presupuesto enviado es inmutable (para cambiarlo se duplica).
- **RN-P02:** cada línea guarda una copia del SKU, nombre y precio al cotizar; cambios del catálogo no alteran presupuestos existentes.
- **RN-P03:** solo productos activos, cantidad entera mayor que cero, sin repetir producto en el mismo presupuesto.
- **RN-P04:** el descuento va de 0 a 100 %; el operador aplica hasta 10 %, más requiere admin.
- **RN-P05:** los totales los calcula siempre el servidor, con redondeo a 2 decimales.
- **RN-P06:** un presupuesto enviado cuya validez ya pasó se muestra como vencido (estado calculado) y no puede aprobarse.
- **RN-P08:** entregar es todo o nada: si alguna línea no tiene stock suficiente, no se entrega ninguna y se informa cuáles fallan (409 con `errors`).
- **RN-P07:** cotizar no reserva stock.
- **RN-P09:** entregar genera salidas de stock con motivo "Presupuesto PRE-n" en una sola transacción, bloqueando los productos en orden de id para evitar interbloqueos.
- **RN-P10:** se necesita al menos una línea para enviar.
- **RN-P11:** la fecha de validez no puede ser anterior a hoy.
- **RN-P12:** cada cambio de estado queda registrado con quién lo hizo y cuándo.
- **RN-P13:** el operador solo ve y duplica sus propios presupuestos.

### Estados de un presupuesto

`borrador → enviado → aprobado → entregado`, o `enviado → rechazado`. **Vencido** no se guarda: el servidor lo calcula cuando un presupuesto enviado pasó su fecha de validez. Entregar solo es posible desde `aprobado`.

## Estructura del proyecto

```
.
├── client/                  # React + Vite
│   └── src/
│       ├── components/      # AppLayout, ProtectedRoute, modales de formularios
│       ├── context/         # AuthContext (sesión)
│       ├── pages/           # Login, Inicio, Usuarios, Categorías, Productos, Movimientos
│       │   └── quotes/      # lista, detalle, formulario e impresión de
│       ├── services/        # llamadas a la API (axios)
│       ├── types/           # interfaces compartidas
│       └── utils/           # errores y formato de moneda
│
└── server/                  # Express + TypeScript
    ├── migrations/          # SQL numeradas (presupuestos y auditoría desde V003)
    ├── src/
    │   ├── db/
    │   │   └── migrator.ts  # ejecutor de migraciones
    │   ├── config/          # conexión a MariaDB
    │   ├── middlewares/     # autenticación, roles y manejo central de errores
    │   ├── modules/         # auth, users, categories, products, movements, dashboard, quotes
    │   │   └── quotes/      # incluye submódulo audit/ (auditoría de ediciones)
    │   ├── scripts/         # seed admin, ejecutor de migraciones, base de pruebas
    │   ├── types/           # tipos de Express (req.user)
    │   └── utils/           # HttpError, helpers de SQL, transacciones y fechas
    └── tests/               # pruebas Vitest + Supertest
```

## Requisitos previos

- Node.js 20 o superior
- MariaDB 10.5 o superior

## Instalación

### 1. Base de datos

Esto crea la base si no existe y aplica las migraciones pendientes. Si ya tenías una base creada con el esquema anterior, adóptala con `npm run migrate -- --baseline=1`.

```bash
cd server
npm run migrate
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env     # en Windows: copy .env.example .env
```

Edita `.env` con tus datos:

| Variable                 | Descripción                                     |
| ------------------------ | ----------------------------------------------- |
| `PORT`                   | Puerto de la API (por defecto 3000)             |
| `DB_HOST`, `DB_PORT`     | Servidor de MariaDB                             |
| `DB_USER`, `DB_PASSWORD` | Credenciales de la base                         |
| `DB_NAME`                | Nombre de la base (`inventario`)                |
| `JWT_SECRET`             | Cadena larga y aleatoria para firmar los tokens |

Crea el primer usuario administrador:

```bash
npm run seed:admin -- admin@ejemplo.com TuClaveSegura123
```

Inicia el servidor:

```bash
npm run dev
```

La API queda en `http://localhost:3000`. Comprueba que funciona en `http://localhost:3000/api/health`.

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173`. En desarrollo, Vite redirige las peticiones `/api` al backend, así que no hace falta configurar CORS.

## Scripts

| Carpeta  | Comando                              | Descripción                                |
| -------- | ------------------------------------ | ------------------------------------------ |
| `server` | `npm run dev`                        | Servidor con recarga automática            |
| `server` | `npm run build`                      | Compila TypeScript a `dist/`               |
| `server` | `npm start`                          | Ejecuta la versión compilada               |
| `server` | `npm run seed:admin -- correo clave` | Crea un usuario administrador              |
| `client` | `npm run dev`                        | Servidor de desarrollo                     |
| `client` | `npm run build`                      | Verifica tipos y genera el build           |
| `client` | `npm run lint`                       | Revisa el código con ESLint                |
| `server` | `npm run typecheck`                  | Verifica tipos sin compilar                |
| `server` | `npm run lint`                       | Revisa el código con ESLint                |
| `server` | `npm run test:watch`                 | Pruebas en modo observador                 |
| `server` | `npm run test:db`                    | Crea/actualiza la base de datos de pruebas |
| `server` | `npm run migrate`                    | Aplica las migraciones pendientes          |
| `server` | `npm test`                           | Ejecuta las pruebas                        |

## API

Todas las rutas, salvo el login y `health`, requieren el encabezado `Authorization: Bearer <token>`.

| Método            | Ruta                        | Acceso          | Descripción                                   |
| ----------------- | --------------------------- | --------------- | --------------------------------------------- |
| GET               | `/api/health`               | Público         | Estado del servidor y la base                 |
| POST              | `/api/auth/login`           | Público         | Inicio de sesión                              |
| GET               | `/api/auth/me`              | Autenticado     | Datos de la sesión                            |
| PUT               | `/api/auth/password`        | Autenticado     | Cambiar la propia contraseña                  |
| GET, POST         | `/api/users`                | Admin           | Listar (paginado y filtrado) y crear          |
| PUT               | `/api/users/:id`            | Admin           | Editar                                        |
| PATCH             | `/api/users/:id/activo`     | Admin           | Activar o desactivar                          |
| GET               | `/api/categories`           | Autenticado     | Listar con conteo de productos                |
| POST, PUT, DELETE | `/api/categories[/:id]`     | Admin           | Crear, editar y eliminar                      |
| GET, POST         | `/api/products`             | Autenticado     | Listar (paginado y filtrado) y crear          |
| PUT               | `/api/products/:id`         | Autenticado     | Editar                                        |
| PATCH             | `/api/products/:id/activo`  | Admin           | Activar o desactivar                          |
| GET, POST         | `/api/movements`            | Autenticado     | Historial (paginado) y registrar movimiento   |
| GET, POST         | `/api/quotes`               | Autenticado     | Listar (paginado y filtrado) y crear borrador |
| GET               | `/api/quotes/:id`           | Autenticado     | Detalle con líneas                            |
| PUT               | `/api/quotes/:id`           | Creador o admin | Editar borrador                               |
| DELETE            | `/api/quotes/:id`           | Creador o admin | Eliminar borrador                             |
| POST              | `/api/quotes/:id/duplicate` | Autenticado     | Duplicar como borrador nuevo                  |
| POST              | `/api/quotes/:id/send`      | Creador o admin | Enviar                                        |
| POST              | `/api/quotes/:id/approve`   | Creador o admin | Aprobar                                       |
| POST              | `/api/quotes/:id/reject`    | Creador o admin | Rechazar                                      |
| GET               | `/api/quotes/:id/history`   | Autenticado     | Historial de estados                          |
| POST              | `/api/quotes/:id/deliver`   | Creador o admin | Entregar (descuenta stock)                    |

Los errores siguen un formato único: `{ "message": "..." }`, más `errors` cuando hay detalle (validación Zod o líneas sin stock en la entrega), con códigos 400, 401, 403, 404, 409 y 500.

## Pruebas

Las pruebas del servidor usan Vitest y Supertest contra una base de datos aparte (`inventario_test`), para no tocar los datos de desarrollo.

1. Crea `server/.env.test` con las mismas variables que `.env`, pero con `DB_NAME=inventario_test`.
2. Ejecuta las pruebas. La suite aplica automáticamente las migraciones pendientes sobre `inventario_test` antes de empezar:

   ```bash
   cd server
   npm test
   ```

   Si necesitas recrear la base de pruebas desde cero (por ejemplo, tras un cambio de esquema), ejecuta `npm run test:db`.

Cubren autenticación y permisos por rol, las reglas del inventario (SKU único, categorías con productos, precios válidos), los movimientos de stock (incluida concurrencia) y la visibilidad de costos por rol. Del módulo de presupuestos/cotizaciones: validación y cálculo de totales, reglas de líneas, visibilidad por rol, auditoría de ediciones, historial, transiciones de estado y la entrega (todo o nada y dos entregas simultáneas). Del esquema financiero: presupuesto activo único por periodo, borrado en cascada de líneas y transacciones inmutables con anulación única.

## Decisiones técnicas

- **Paginación, búsqueda y filtros en el servidor**, con consultas parametrizadas para evitar inyección SQL.
- **Transacciones con bloqueo de fila** (`SELECT ... FOR UPDATE`) al registrar movimientos, para que dos salidas simultáneas no dejen el stock negativo.
- **Validación en dos capas:** Ant Design en el formulario (experiencia de usuario) y Zod en el servidor (seguridad).
- **Restricciones en la base de datos** (`UNIQUE`, `CHECK`, claves foráneas) como red de seguridad adicional.
- **Historial inmutable:** los movimientos no se editan ni se borran; los errores se corrigen con un movimiento compensatorio.
- **Manejo central de errores** en Express, con una clase `HttpError` para los errores de negocio.

## Posibles mejoras

- Exportación de inventario, historial y presupuestos a CSV o Excel
- Tokens de vida corta con refresh tokens
- Docker y despliegue en la nube
- Auditoría ampliada y seguridad reforzada
- Rediseño UI/UX: diseño moderno y funcional (sistema de diseño con tokens de Ant Design, tema claro/oscuro, jerarquía visual, estados vacíos y de carga, responsive)

## Autor

Edison · [GitHub](https://github.com/edisonmonsalve)
