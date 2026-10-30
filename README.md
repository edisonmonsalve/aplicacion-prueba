# Sistema de Usuarios e Inventario

Aplicación fullstack para gestionar usuarios, productos, categorías y movimientos de stock. Proyecto de práctica enfocado en CRUD completo, tablas con paginación en servidor, formularios con validación, reglas de negocio y transacciones SQL.

## Funcionalidades

- **Autenticación:** inicio de sesión con JWT, rutas protegidas por rol y cambio de la propia contraseña.
- **Usuarios** (solo admin): listar con búsqueda, filtros y paginación; crear, editar y desactivar.
- **Categorías:** listar, crear, editar y eliminar (si no tienen productos).
- **Productos:** listar con búsqueda, filtros por categoría, estado y stock bajo; crear, editar y desactivar.
- **Movimientos de stock:** registrar entradas y salidas con motivo, e historial filtrable por producto y tipo.
- **Alertas:** indicador visual de productos con stock por debajo del mínimo.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React, TypeScript, Vite, Ant Design, React Router, Axios |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Base de datos | MariaDB (driver `mysql2`) |
| Seguridad | JWT, bcryptjs |

## Roles y permisos

| Acción | Admin | Operador |
|---|:---:|:---:|
| Ver categorías, productos y movimientos | Sí | Sí |
| Crear y editar productos | Sí | Sí |
| Registrar movimientos de stock | Sí | Sí |
| Desactivar productos | Sí | No |
| Crear, editar y eliminar categorías | Sí | No |
| Gestionar usuarios | Sí | No |

## Reglas de negocio

- **RN-01:** el SKU de un producto es único.
- **RN-02:** no se permite una salida mayor al stock disponible.
- **RN-03:** el stock actual solo cambia mediante movimientos, y cada movimiento y su actualización de stock ocurren en una única transacción.
- **RN-04:** los productos no se eliminan, se desactivan.
- **RN-05:** una categoría con productos asociados no se puede eliminar.
- **RN-06:** un usuario no puede desactivarse a sí mismo ni quitarse el rol de admin.
- **RN-07:** precios y cantidades deben ser mayores que cero.

## Estructura del proyecto

```
.
├── client/                  # React + Vite
│   └── src/
│       ├── components/      # AppLayout, ProtectedRoute, modales de formularios
│       ├── context/         # AuthContext (sesión)
│       ├── pages/           # Login, Inicio, Usuarios, Categorías, Productos, Movimientos
│       ├── services/        # llamadas a la API (axios)
│       ├── types/           # interfaces compartidas
│       └── utils/           # errores y formato de moneda
└── server/                  # Express + TypeScript
    ├── db/schema.sql        # esquema de la base de datos
    └── src/
        ├── config/          # conexión a MariaDB
        ├── middlewares/     # autenticación, roles y manejo central de errores
        ├── modules/         # auth, users, categories, products, movements
        │   └── <módulo>/    # routes, service y schema (validación con Zod)
        ├── scripts/         # seed del usuario admin
        └── utils/           # HttpError y helpers de SQL
```

## Requisitos previos

- Node.js 20 o superior
- MariaDB 10.5 o superior

## Instalación

### 1. Base de datos

```bash
mariadb -u root -p < server/db/schema.sql
```

Esto crea la base `inventario` con sus cuatro tablas.

### 2. Backend

```bash
cd server
npm install
cp .env.example .env     # en Windows: copy .env.example .env
```

Edita `.env` con tus datos:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de la API (por defecto 3000) |
| `DB_HOST`, `DB_PORT` | Servidor de MariaDB |
| `DB_USER`, `DB_PASSWORD` | Credenciales de la base |
| `DB_NAME` | Nombre de la base (`inventario`) |
| `JWT_SECRET` | Cadena larga y aleatoria para firmar los tokens |

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

| Carpeta | Comando | Descripción |
|---|---|---|
| `server` | `npm run dev` | Servidor con recarga automática |
| `server` | `npm run build` | Compila TypeScript a `dist/` |
| `server` | `npm start` | Ejecuta la versión compilada |
| `server` | `npm run seed:admin -- correo clave` | Crea un usuario administrador |
| `client` | `npm run dev` | Servidor de desarrollo |
| `client` | `npm run build` | Verifica tipos y genera el build |
| `client` | `npm run lint` | Revisa el código con ESLint |

## API

Todas las rutas, salvo el login y `health`, requieren el encabezado `Authorization: Bearer <token>`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/health` | Público | Estado del servidor y la base |
| POST | `/api/auth/login` | Público | Inicio de sesión |
| GET | `/api/auth/me` | Autenticado | Datos de la sesión |
| PUT | `/api/auth/password` | Autenticado | Cambiar la propia contraseña |
| GET, POST | `/api/users` | Admin | Listar (paginado y filtrado) y crear |
| PUT | `/api/users/:id` | Admin | Editar |
| PATCH | `/api/users/:id/activo` | Admin | Activar o desactivar |
| GET | `/api/categories` | Autenticado | Listar con conteo de productos |
| POST, PUT, DELETE | `/api/categories[/:id]` | Admin | Crear, editar y eliminar |
| GET, POST | `/api/products` | Autenticado | Listar (paginado y filtrado) y crear |
| PUT | `/api/products/:id` | Autenticado | Editar |
| PATCH | `/api/products/:id/activo` | Admin | Activar o desactivar |
| GET, POST | `/api/movements` | Autenticado | Historial (paginado) y registrar movimiento |

Los errores siguen un formato único: `{ "message": "..." }`, con códigos 400 (datos inválidos), 401 (sin sesión), 403 (sin permiso), 404, 409 (conflicto con una regla de negocio) y 500.

## Pruebas

Las pruebas del servidor usan Vitest y Supertest contra una base de datos aparte (`inventario_test`), para no tocar los datos de desarrollo.

1. Crea `server/.env.test` con las mismas variables que `.env`, pero con `DB_NAME=inventario_test`.
2. Crea la base de pruebas (una sola vez, o cuando cambie `schema.sql`):

   ```bash
   cd server
   npm run test:db
   ```

3. Ejecuta las pruebas:

   ```bash
   npm test
   ```

Cubren autenticación y permisos por rol, las reglas de negocio del inventario (SKU único, categorías con productos, precios válidos) y los movimientos de stock, incluida una prueba de concurrencia.

## Decisiones técnicas

- **Paginación, búsqueda y filtros en el servidor**, con consultas parametrizadas para evitar inyección SQL.
- **Transacciones con bloqueo de fila** (`SELECT ... FOR UPDATE`) al registrar movimientos, para que dos salidas simultáneas no dejen el stock negativo.
- **Validación en dos capas:** Ant Design en el formulario (experiencia de usuario) y Zod en el servidor (seguridad).
- **Restricciones en la base de datos** (`UNIQUE`, `CHECK`, claves foráneas) como red de seguridad adicional.
- **Historial inmutable:** los movimientos no se editan ni se borran; los errores se corrigen con un movimiento compensatorio.
- **Manejo central de errores** en Express, con una clase `HttpError` para los errores de negocio.

## Posibles mejoras

- [ ] Panel de inicio con indicadores (productos, stock bajo, últimos movimientos)
- [ x ] Pruebas automáticas de las reglas de negocio (Vitest y Supertest)
- [ ] Exportación de inventario e historial a CSV o Excel
- [ ] Tokens de vida corta con refresh tokens
- [ ] Despliegue en la nube

## Autor

Edison · [GitHub](https://github.com/edisonmonsalve)