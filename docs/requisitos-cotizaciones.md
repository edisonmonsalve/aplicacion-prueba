# Módulo de Presupuestos (Cotizaciones)

Extensión del sistema de inventario: permite preparar presupuestos para clientes con productos del inventario, llevarlos por un ciclo de aprobación y, al entregarlos, descontar el stock.

## 1. Objetivo

Practicar modelado de datos con relaciones maestro-detalle, cálculos monetarios, máquinas de estado y transacciones que involucran varias tablas, integrando el módulo con los movimientos de stock que ya existen.

## 2. Ciclo de vida

```
borrador ──enviar──▶ enviado ──aprobar──▶ aprobado ──entregar──▶ entregado
                        │
                        └────rechazar───▶ rechazado
```

Un presupuesto `enviado` cuya fecha de validez ya pasó se muestra como **vencido** (estado calculado, no guardado) y no puede aprobarse.

| Acción | Desde | Hacia | Quién |
|---|---|---|---|
| Enviar | borrador | enviado | Creador o admin |
| Aprobar | enviado | aprobado | Creador o admin |
| Rechazar | enviado | rechazado | Creador o admin |
| Entregar | aprobado | entregado | Creador o admin |
| Eliminar | borrador | (se borra) | Creador o admin |

> La transición **Entregar** se conserva en el servidor (`POST /api/quotes/:id/deliver`) para
> una futura entrega de almacén, pero la interfaz ya no la ofrece. Hoy la cotización queda
> `entregado` al confirmar su factura de venta, que es cuando sale el stock y se reconoce la
> venta.

## 3. Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-P01 | Crear un presupuesto en borrador con datos del cliente, fecha de validez y notas |
| RF-P02 | Agregar, editar y quitar líneas (producto, cantidad, descuento, impuesto) mientras sea borrador |
| RF-P03 | Calcular subtotal, descuentos, impuestos y total en el servidor |
| RF-P04 | Listar presupuestos con búsqueda (número o cliente), filtro por estado y fechas, y paginación |
| RF-P05 | Ver el detalle con líneas, totales e historial de estados |
| RF-P06 | Enviar, aprobar y rechazar según el ciclo de vida |
| RF-P07 | Entregar: generar las salidas de stock de todas las líneas |
| RF-P08 | Duplicar un presupuesto para crear un borrador nuevo a partir de otro |
| RF-P09 | Vista de impresión o PDF (opcional, fase final) |

## 4. Reglas de negocio

- **RN-P01:** solo los borradores se editan o eliminan. Un presupuesto enviado es inmutable; para cambiarlo se duplica.
- **RN-P02:** cada línea guarda una copia del SKU, el nombre y el precio unitario al momento de cotizar. Si el producto cambia después, el presupuesto no se altera.
- **RN-P03:** solo se cotizan productos activos, con cantidad entera mayor que cero, y un producto no se repite en el mismo presupuesto.
- **RN-P04:** el descuento va de 0 a 100 %. El operador puede aplicar hasta 10 %; un descuento mayor requiere rol admin.
- **RN-P05:** los totales los calcula siempre el servidor, nunca se aceptan los del cliente. Redondeo a 2 decimales.
- **RN-P06:** un presupuesto enviado vence al pasar su fecha de validez y ya no puede aprobarse.
- **RN-P07:** cotizar no reserva stock. El stock solo se descuenta al entregar.
- **RN-P08:** entregar es todo o nada: si alguna línea no tiene stock suficiente (RN-02), no se entrega ninguna y se informa cuáles fallan.
- **RN-P09:** entregar genera movimientos de salida con motivo "Presupuesto COT-n", en una sola transacción, bloqueando los productos en orden de id para evitar interbloqueos.
- **RN-P10:** un presupuesto necesita al menos una línea para poder enviarse.
- **RN-P11:** la fecha de validez no puede ser anterior a hoy al crear o enviar.
- **RN-P12:** cada cambio de estado queda registrado con quién lo hizo y cuándo.
- **RN-P13:** un operador solo ve y duplica sus propios presupuestos; el admin ve todos.
- **RN-P14:** el número documental de la cotización usa el prefijo `COT-` (por ejemplo
  `COT-000001`); se acepta el prefijo histórico `PRE-` al buscar.


## 5. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-P01 | Cálculos monetarios sin errores de coma flotante, con pruebas de casos borde (descuentos, redondeos, impuestos) |
| RNF-P02 | Toda operación que escribe en varias tablas ocurre en una transacción |
| RNF-P03 | Cada regla RN-P tiene al menos una prueba automática |
| RNF-P04 | Paginación y filtros resueltos en el servidor |
| RNF-P05 | El esquema nuevo se introduce con migraciones versionadas |

## 6. Modelo de datos inicial

- `quotes` (id, customer_nombre, customer_documento, customer_email, estado, fecha_validez, notas, subtotal, descuento_total, impuesto_total, total, created_by, created_at, updated_at)
- `quote_items` (id, quote_id, product_id, sku, nombre, cantidad, precio_unitario, descuento_pct, impuesto_pct, total_linea), con restricción única (quote_id, product_id)
- `quote_status_history` (id, quote_id, estado_anterior, estado_nuevo, user_id, created_at)

Estados posibles guardados: `borrador`, `enviado`, `aprobado`, `rechazado`, `entregado`.

## 7. API propuesta

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/quotes` | Autenticado | Listar con filtros y paginación |
| GET | `/api/quotes/:id` | Autenticado | Detalle con líneas e historial |
| POST | `/api/quotes` | Autenticado | Crear borrador con sus líneas |
| PUT | `/api/quotes/:id` | Creador o admin | Editar borrador |
| DELETE | `/api/quotes/:id` | Creador o admin | Eliminar borrador |
| POST | `/api/quotes/:id/send` | Creador o admin | Enviar |
| POST | `/api/quotes/:id/approve` | Creador o admin | Aprobar |
| POST | `/api/quotes/:id/reject` | Creador o admin | Rechazar |
| POST | `/api/quotes/:id/deliver` | Creador o admin | Entregar y descontar stock |
| POST | `/api/quotes/:id/duplicate` | Autenticado | Crear borrador a partir de otro |

## 8. Pantallas

- **Lista de presupuestos:** tabla con número, cliente, estado (con color), total, fecha de validez y acciones.
- **Formulario de presupuesto:** datos del cliente y líneas dinámicas (selector de producto, cantidad, descuento, impuesto), con totales de vista previa que se recalculan al escribir. El valor oficial lo calcula el servidor.
- **Detalle:** líneas, totales, historial de estados y los botones de acción que correspondan al estado actual y al rol.

## 9. Decisiones de diseño

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Datos del cliente dentro del presupuesto | Tabla `customers` con su CRUD | Mantiene el alcance acotado; los clientes pueden ser una mejora posterior |
| Cotizar no reserva stock | Stock reservado por presupuesto | Las reservas añaden mucha complejidad (liberarlas al vencer o rechazar) |
| Entregar es un paso aparte de aprobar | Aprobar descuenta stock | Aprobar es un acuerdo con el cliente; entregar es un hecho físico que debe validar el stock |
| Vencimiento calculado al consultar | Tarea programada que cambia el estado | Evita infraestructura adicional y el estado nunca queda desactualizado |
| Totales guardados también en el encabezado | Calcularlos con una suma en cada consulta | Listar es mucho más rápido; se recalculan en cada guardado |
| Copia de SKU, nombre y precio en cada línea | Leerlos del producto | Un documento ya emitido no debe cambiar cuando cambia el catálogo |

## 10. Fuera del alcance

Facturación, pagos, envío por correo, historial de clientes, varias monedas, reservas de stock y aprobaciones por niveles.

## 11. Plan de tickets (en orden)

1. Migraciones de base de datos versionadas (requisito previo).
2. Esquema de presupuestos: migración de las tres tablas.
3. Backend: crear, editar y eliminar borradores con cálculo de totales y pruebas (RN-P02 a RN-P05, RN-P11).
4. Backend: listado, detalle y duplicar, con filtros y paginación.
5. Backend: transiciones de estado e historial, con pruebas de cada transición permitida y prohibida (RN-P01, RN-P06, RN-P10, RN-P12).
6. Backend: entrega con salidas de stock transaccionales y prueba de concurrencia (RN-P07 a RN-P09). Requiere refactorizar `registerMovement` para poder ejecutarse dentro de una transacción mayor.
7. Frontend: lista y detalle.
8. Frontend: formulario con líneas dinámicas y totales en vista previa.
9. Vista de impresión o PDF (opcional).
