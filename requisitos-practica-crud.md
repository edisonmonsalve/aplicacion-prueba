# Proyecto de práctica: Usuarios e Inventario

MVP fullstack para practicar CRUD, tablas, formularios, lógica de negocio y buenas técnicas de programación.

## 1. Objetivo

Construir un sistema pequeño de **gestión de usuarios e inventario** donde cada módulo obligue a practicar un concepto distinto: tablas con datos reales, formularios con validación, reglas de negocio y manejo de errores.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Ant Design (Vite) |
| Backend | Node.js + Express + TypeScript |
| Base de datos | MariaDB |
| Validación | Zod |
| Autenticación | JWT + bcrypt |

## 3. Roles

- **Admin:** gestiona usuarios y todo el inventario.
- **Operador:** registra productos y movimientos de stock; no gestiona usuarios.

## 4. Requisitos funcionales

### Módulo Usuarios

| ID | Requisito |
|---|---|
| RF-01 | Inicio de sesión con correo y contraseña |
| RF-02 | Listar usuarios en tabla con paginación, búsqueda y filtro por rol/estado |
| RF-03 | Crear y editar usuario mediante formulario (nombre, correo, rol, contraseña) |
| RF-04 | Desactivar/activar usuario (borrado lógico, no físico) |
| RF-05 | Cambiar la propia contraseña |

### Módulo Inventario

| ID | Requisito |
|---|---|
| RF-06 | CRUD de categorías |
| RF-07 | CRUD de productos (nombre, SKU único, categoría, precio, stock mínimo) |
| RF-08 | Listar productos en tabla con orden, paginación, búsqueda y filtro por categoría |
| RF-09 | Registrar movimientos de stock: entrada y salida, con cantidad y motivo |
| RF-10 | Ver historial de movimientos por producto |
| RF-11 | Alerta visual de productos con stock por debajo del mínimo |

## 5. Reglas de negocio (la parte clave de la práctica)

- **RN-01:** El SKU no se puede repetir.
- **RN-02:** No se permite una salida mayor al stock disponible.
- **RN-03:** El stock actual se calcula a partir de los movimientos (entradas menos salidas), o se actualiza en la misma transacción que registra el movimiento.
- **RN-04:** Un producto con movimientos no se elimina: se desactiva.
- **RN-05:** Una categoría con productos asociados no se puede eliminar.
- **RN-06:** Un usuario no puede desactivarse a sí mismo ni quitarse el rol de admin.
- **RN-07:** Precio y cantidades deben ser mayores que cero.

## 6. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Contraseñas con hash (bcrypt/argon2) |
| RNF-02 | Validación en el cliente (Ant Design Form) y en el servidor (Zod) |
| RNF-03 | Rutas protegidas por autenticación y rol |
| RNF-04 | Errores de la API con formato y códigos HTTP consistentes |
| RNF-05 | Paginación en servidor para las tablas |
| RNF-06 | Variables de entorno con `.env.example` |
| RNF-07 | TypeScript con modo estricto |

## 7. Modelo de datos inicial

- `users` (id, nombre, email único, password_hash, rol, activo, created_at)
- `categories` (id, nombre único)
- `products` (id, sku único, nombre, category_id, precio, stock_actual, stock_minimo, activo)
- `stock_movements` (id, product_id, user_id, tipo [entrada/salida], cantidad, motivo, created_at)

## 8. Técnicas de programación a practicar

- Arquitectura por capas en el backend: rutas, controlador, servicio, acceso a datos.
- **Transacciones SQL** al registrar movimientos y actualizar stock.
- Validación con esquemas compartidos (Zod) y tipos inferidos.
- Middleware de autenticación, autorización y manejo central de errores.
- En React: servicio de API aislado, hooks personalizados, estados de carga y error.
- Paginación y filtros ejecutados en el servidor, no en el cliente.
- Borrado lógico y manejo de integridad referencial.

## 9. Plan por fases

1. **Base:** estructura del repo, conexión a MariaDB, migraciones, auth con login.
2. **Usuarios:** CRUD completo con tabla, formulario y reglas RN-06.
3. **Categorías y productos:** CRUD con filtros, búsqueda y paginación.
4. **Movimientos de stock:** transacciones, reglas RN-02/RN-03 e historial.
5. **Pulido:** alertas de stock bajo, manejo de errores, README.

## 10. Fuera del alcance

Facturación, proveedores, reportes avanzados, subida de imágenes, notificaciones, despliegue.

## 11. Criterios de aceptación

- Puedo crear, ver, editar y desactivar usuarios y productos desde la interfaz.
- No es posible registrar una salida mayor al stock.
- Cada rol ve y hace solo lo que le corresponde.
- El proyecto corre localmente siguiendo el README.
