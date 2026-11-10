# Requerimientos del Módulo de Facturación

## 1. Entidades de Datos

### 1.1 Tabla `invoices` (Cabeceras de Factura)

| Campo         | Tipo                                    | Descripción                             |
| ------------- | --------------------------------------- | --------------------------------------- |
| `id`          | INT UNSIGNED AUTO_INCREMENT             | Identificador único                     |
| `tipo`        | ENUM('venta','compra')                  | Tipo de factura                         |
| `numero`      | VARCHAR(20) UNIQUE                      | Numero consecutivo (FAC-0001, COM-0001) |
| `fecha`       | DATE                                    | Fecha de la factura                     |
| `contraparte` | VARCHAR(200)                            | Nombre del cliente o proveedor          |
| `documento`   | VARCHAR(50)                             | Documento de identidad (opcional)       |
| `email`       | VARCHAR(150)                            | Email de la contraparte (opcional)      |
| `estado`      | ENUM('borrador','confirmada','anulada') | Estado actual                           |
| `total`       | DECIMAL(14,2)                           | Total calculado                         |
| `notas`       | TEXT                                    | Observaciones                           |
| `created_by`  | INT UNSIGNED                            | Usuario que creó                        |
| `created_at`  | TIMESTAMP                               | Fecha de creación                       |
| `updated_at`  | TIMESTAMP                               | Última actualización                    |

**Restricciones:**

- `numero` debe ser único por tipo (admin via `invoice_counters`)
- No se puede editar/eliminar facturas confirmadas o anuladas
- Estado inicial siempre es `borrador`

### 1.2 Tabla `invoice_items` (Líneas de Factura)

| Campo             | Tipo                        | Descripción                       |
| ----------------- | --------------------------- | --------------------------------- |
| `id`              | INT UNSIGNED AUTO_INCREMENT | Identificador único               |
| `invoice_id`      | INT UNSIGNED FK → invoices  | Factura padre                     |
| `product_id`      | INT UNSIGNED FK → products  | Producto                          |
| `cantidad`        | INT                         | Cantidad vendida/comprada (> 0)   |
| `precio_unitario` | DECIMAL(14,2)               | Precio unitario de la línea (> 0) |
| `descuento_pct`   | DECIMAL(5,2) DEFAULT 0      | Descuento porcentual (0-100)      |
| `impuesto_pct`    | DECIMAL(5,2) DEFAULT 0      | Impuesto porcentual (0-100)       |
| `total_linea`     | DECIMAL(14,2)               | Total de la línea (calculado)     |

**Fórmulas:**

- `base = cantidad × precio_unitario`
- `desc = (base × descuento_pct) / 100`
- `imp = ((base - desc) × impuesto_pct) / 100`
- `total_linea = roundMoney(base - desc + imp)`

### 1.3 Tabla `invoice_counters` (Contadores Consecutivos)

| Campo         | Tipo                   | Descripción            |
| ------------- | ---------------------- | ---------------------- |
| `tipo`        | ENUM('venta','compra') | Tipo de factura (PK)   |
| `last_number` | INT NOT NULL DEFAULT 0 | Último número asignado |

**Comportamiento:**

- `INSERT IGNORE` + `FOR UPDATE` para concurrencia segura
- Al crear factura: `last_number` incrementa en 1
- Formato: `FAC-NNNN` para venta, `COM-NNNN` para compra

---

## 2. Flujo de Trabajo

### 2.1 Crear Factura (Borrador)

- **Rol permitido**: admin, contador, operador
- **Input requerido**: `tipo`, `fecha`, `contraparte`, `items` (mínimo 1)
- **Generación automática**: `numero` consecutivo via `invoice_counters`
- **Output**: `{ id, numero }` en estado `borrador`
- **Validaciones**:
  - Cada ítem debe tener `product_id`, `cantidad > 0`, `precio_unitario > 0`
  - El producto debe estar activo
  - No se permiten ítems duplicados de mismo producto en una misma factura

### 2.2 Confirmar Factura de Venta

- **Rol permitido**: admin, contador, operador
- **Validaciones previas**:
  - Factura debe estar en estado `borrador`
  - Debe tener al menos 1 línea
  - **Validación de stock**: para cada producto en línea, verificar `stock_actual >= cantidad` (`FOR UPDATE`)
  - Ningún producto inactivo
- **Acciones en transacción atómica**:
  1. Registrar movimiento de stock `salida` con `origen=venta`
  2. Generar asiento financiero `ingreso "Ventas"` por `total`
  3. Actualizar `invoices.estado = 'confirmada'`
  4. Descontar stock de cada producto
- **Errores**:
  - 409 si stock insuficiente
  - 409 si producto inactivo
  - 409 si factura no está en borrador

### 2.3 Confirmar Factura de Compra

- **Rol permitido**: admin, contador, operador
- **Validaciones previas**:
  - Factura debe estar en estado `borrador`
  - Debe tener al menos 1 línea
- **Acciones en transacción atómica**:
  1. Registrar movimiento de stock `entrada` con `origen=compra` + `costo_unitario`
  2. Guardar el costo neto como costo histórico del movimiento (M1)
  3. Generar asiento financiero `activo "Inventario"` por el neto: es salida de caja, no gasto
  4. Actualizar `invoices.estado = 'confirmada'`
- **Nota**: `products.costo` solo cambia con edición manual (M1); la compra no lo sobrescribe. El gasto se reconoce al vender como `Costo de ventas`.

### 2.4 Anular Factura

- **Rol permitido**: admin, contador, operador
- **Condiciones**:
  - Factura debe estar en estado `confirmada` (no se puede anular en borrador)
- **Acciones**:
  1. Si fue de tipo `venta`: revertir stock (`stock_actual += cantidad`)
  2. Si fue de tipo `compra`: revertir stock (`stock_actual -= cantidad`)
  3. Registrar contrapartida financiera del mismo tipo (la anulación queda excluida de los reportes)
  4. Marcar `invoices.estado = 'anulada'`
- **Restricción**: No se puede anular una factura anulada

### 2.5 Listado y Filtrado

- **Filtros disponibles**:
  - `tipo`: venta / compra
  - `estado`: borrador / confirmada / anulada
  - `desde` / `hasta`: rango de fecha
  - `contraparte`: nombre del cliente/proveedor
- **Paginado**: `page`, `pageSize` (default: 10)
- **Orden**: por `id DESC` por defecte
- **Output**: `{ data: [], total: N, page, pageSize }`

---

## 3. Validaciones de Negocio

| Regla  | Descripción                                      | Código                                                                                        |
| ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **R1** | Precio unitario obligatorio y > 0                | `invoiceItemSchema` Zod validation                                                            |
| **R2** | No confirmar factura vacía (sin líneas)          | Validación en `confirmInvoice`                                                                |
| **R3** | Stock suficiente antes de confirmar venta        | `FOR UPDATE` con validación previa                                                            |
| **R4** | Producto inactivo bloquea operación              | Verificación `products.activo = 1`                                                            |
| **R5** | Numeración consecutiva por tipo                  | Tabla `invoice_counters` con `FOR UPDATE`                                                     |
| **R6** | Solo editar/eliminar facturas en borrador        | Validación `estado !== borrador` → error 409                                                  |
| **R7** | Anular solo facturas confirmadas                 | Validación `estado === confirmada`                                                            |
| **R8** | Asientos automáticos son idempotentes            | Index unique en `stock_movements`(`quote_id`,`tipo`) y `stock_movements`(`stock_movement_id`) |
| **R8** | Costo de producto se actualiza en factura compra | `UPDATE products SET costo = precio_unitario`                                                 |

---

## 4. Integración con Módulos Existentes

### 4.1 Integración con Inventario (stock_movements)

- **Campo `origen`** obligatorio en todas las entradas/salidas:
  - `compra` → factura de compra
  - `venta` → factura de venta
  - `entrega` → entrega de cotización
  - `merma`, `ajuste` → movimientos directos
- **Validación en `movements.service.ts`**:
  - Entrada: origen permitido = `compra`, `ajuste`
  - Salida: origen permitido = `venta`, `entrega`, `merma`, `ajuste`
- **Asientos automáticos**:
  - `entrada + origen=compra` → activo "Inventario" (salida de caja, no gasto)
  - `salida + origen=venta` → ingreso "Ventas"
  - Salidas `entrega/merma/ajuste` → solo movimiento stock, sin asiento

### 4.2 Integración con Finanzas

- Uso de `finance_categories` y `finance_accounts` existentes
- Categorías usadas:
  - `Ventas` (tipo `ingreso`)
  - `Inventario` (tipo `activo`)
  - `Costo de ventas` (tipo `gasto`, informativo: no mueve caja)
- Cuentas: cualquier cuenta activa (`finance_accounts WHERE activo = 1`)

### 4.3 Integración con Cotizaciones

- Factura de venta puede derivar de una cotización entregada
- Al entregar cotización: ya se descontaba stock y generaba ingreso
- Factura de venta confirma y formaliza esa venta con numeración propia

---

## 5. Reportes y Consultas

### 5.1 Resumen Financiero por Rango

- Ingresos, egresos, utilidad, margen
- Costo de ventas (total de facturas compra)
- Filtrar por tipo (venta/compra)

### 5.2 Facturas por Tipo y Estado

- Count y detalles por `tipo` y `estado`
- Agrupado por rango de fecha

### 5.3 Disponibilidad Presupuestaria por Producto

- Consultar presupuesto activo vigente
- Validar si una factura de compra excede disponibilidad

---

## 6. Errores y Mensajes

| Código | Mensaje            | Cuándo se lanza                                               |
| ------ | ------------------ | ------------------------------------------------------------- |
| 201    | Creado             | Al crear factura en borrador                                  |
| 200    | OK                 | Al confirmar/anular                                           |
| 400    | Solicitud inválida | Datos faltantes, sin líneas                                   |
| 409    | Conflicto          | Factura no en borrador, stock insuficiente, producto inactivo |
| 404    | No encontrado      | ID de factura inexistente                                     |

---
