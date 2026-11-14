# Mejoras de facturación, contabilidad y ciclo comercial

> Documento de cierre de la primera fase de mejoras y de registro de decisiones e implementación de la segunda iteración (M1–M6).
> Rama: `feat/base-financiera` · Commit: `387b640` · Migración: `V012__contabilidad_iva_y_trazabilidad.sql`

---

## 1. Resumen ejecutivo

Se completó la base financiera del sistema: IVA separado (opción B), asientos de cabecera
trazables por factura, costo histórico y precio de venta en movimientos, presupuesto por
categoría de producto y cuentas con saldo inicial.

La cotización quedó como documento **pre-contractual sin contabilidad**; la factura es la
única que contabiliza. El stock se mueve por la entrega de cotización o por la factura,
según corresponda, sin duplicarse.

Esta sección cierra las mejoras M1–M6 definidas para la siguiente iteración. Todas están
implementadas, probadas y documentadas:

| Mejora | Resumen de la decisión | Estado |
|---|---|---|
| **M1. Costo unitario en compras** | `products.costo` solo cambia con **edición manual**; una compra no lo sobrescribe. | Implementado |
| **M2. Inventario y costo de venta** | La compra de inventario es un **activo con salida de caja**; el costo de venta es un **gasto que reduce utilidad/margen sin mover caja**. Cada peso impacta una vez la caja (al comprar) y una vez la utilidad (al vender). | Implementado |
| **M3. Alertas, IVA y retenciones** | IVA 19 % por defecto (editable) en factura y cotización; autocompletado de impuesto en cotización; alertas de stock bajo en factura y cotización; retenciones prellenadas automáticamente según tipo (tasas configurables). | Implementado |
| **M4. Aprobación de cotización** | Se **advierte y bloquea** la aprobación si no hay stock suficiente para las líneas cotizadas. | Implementado |
| **M5. Múltiples facturas por cotización** | Una cotización aprobada puede vincularse a varias facturas (facturación por hitos). La cotización es una propuesta comercial: sus montos **no limitan** los de la factura, que refleja el valor real de la venta. Se muestra el saldo cotizado como seguimiento. Generación **asistida** desde la cotización. Avisa y marca cotizaciones entregadas con saldo pendiente de facturar. Vínculo bidireccional cotización ↔ factura. | Implementado |
| **M6. Autocompletado desde cotización** | Al seleccionar una cotización en la factura de venta se precargan cliente, email, notas y líneas (producto, cantidad, precio, descuento, impuesto). El cliente puede cambiar valores y agregar productos; los precios **no se bloquean**. | Implementado |

Requisitos conservados: IVA opción B, asientos de cabecera, cotización sin contabilidad,
costo histórico, presupuestos por categoría y cuentas.

---

## 2. Mejoras implementadas

### 2.1 Contabilidad con IVA (Opción B)

- Nuevas naturalezas contables: `ingreso`, `gasto`, `activo`, `pasivo`.
- Categorías nuevas:
  - **IVA por pagar** → pasivo.
  - **IVA descontable** → activo.
- Venta: ingreso **neto** + IVA por pagar + costo de ventas.
- Compra: gasto **neto** (con descuento, sin IVA) + IVA descontable.
- El capital de caja solo se mueve con ingresos y gastos; el IVA no lo afecta.
- El resumen financiero muestra **IVA por pagar** e **IVA descontable**.

### 2.2 Asientos de cabecera por factura

- Al confirmar una factura se crean asientos agrupados por documento, no por línea.
- Cada asiento lleva `invoice_id` y enlace a `/facturas/:id`.
- El detalle por producto sigue disponible en Movimientos.
- Anular una factura revierte **todos** sus asientos con contrapartidas.
- Los asientos automáticos no se anulan manualmente: se anulan desde su factura.

### 2.3 Ciclo documental y stock

- La entrega de cotización mueve stock (origen `entrega`) y **no genera contabilidad**. La
  interfaz ya no expone la acción «Entregar»: el endpoint se conserva para una futura entrega
  de almacén, y hoy la cotización queda `entregado` al confirmar su factura de venta.
- La factura directa mueve stock y contabiliza.
- Factura vinculada a cotización **aprobada**: mueve stock una vez y deja la cotización en `entregado`.
- Factura vinculada a cotización **entregada**: no vuelve a mover stock y usa el costo histórico de la entrega.
- `quote_id` evita el doble reconocimiento cotización → factura.
- Anular una factura revierte el stock solo si la factura lo había movido.

### 2.4 Costos y precios en movimientos

- Se guarda el **costo histórico** al momento de la salida (base del costo de ventas).
- **Descuento de compra:** el costo neto (`precio × (1 − descuento)`) se guarda como costo
  histórico de la entrada y valoriza el activo Inventario; también reduce la salida de caja.
  No actualiza `products.costo` (M1), así que **el costo de ventas no aplica el descuento**:
  usa el costo unitario del producto.
- **Costo de ventas:** gasto con `afecta_caja = 0`; reduce la utilidad y el margen bruto, pero
  no vuelve a mover caja (la salida ocurrió al comprar o al pagar la compra).
- Se guarda el **precio de venta** separado en `precio_unitario`.
- Trazabilidad con `invoice_id` y `quote_id`.
- Columnas nuevas: **Costo unitario**, **Costo total**, **Precio unitario**, **Origen** y **Documento**.
- Filtros por origen y por documento.
- Costo y precio restringidos por rol con `canSeeCosts` (el operador no los ve).

### 2.5 Facturación ampliada

- Cabecera con `subtotal`, `descuento_total`, `impuesto_total`, `total` y `total_neto`.
- **Orden de compra** como referencia (sin módulo completo).
- **Retenciones** (fuente, IVA, ICA) informativas: reducen el total neto, no generan asientos.
- Selector de producto con **stock visible**.
- Al anular una compra se **restaura el costo anterior**.
- Detalle con desglose tributario, cotización vinculada y tabla de asientos.

### 2.6 Presupuestos analíticos

- Líneas por categoría financiera con alcance:
  - General.
  - Por **producto**.
  - Por **categoría de producto**.
- Ejecución real mediante `transaction_allocations` (sin doble conteo).
- Disponibilidad por prioridad: **producto > categoría de producto > general**.
- Validación en servidor: una categoría no mezcla niveles de alcance.

### 2.7 Cuentas financieras

- CRUD de cuentas con **saldo inicial**, tipo caja/banco y estado activo.
- Saldo actual = saldo inicial + ingresos − gastos.
- No se puede eliminar una cuenta con transacciones; se desactiva.
- Los cambios de saldo quedan auditados.

### 2.8 UI, documentación y calidad

- Transacciones: naturalezas IVA, columna Documento, bloqueo de anulación de asientos automáticos.
- Movimientos: costo histórico, precio, origen y links a factura/cotización.
- Presupuestos: selector de categoría de producto y columna de alcance.
- Finanzas: tarjetas de IVA y modal de cuentas.
- Facturas: formulario y detalle con IVA, OC, retenciones, cotización y asientos.
- Documentación actualizada: ciclo documental, lógica de negocio y manual de usuario.
- Servidor: **132/132 tests** y typecheck limpio.
- Cliente: typecheck y build en verde.
- Migración aplicada en test y desarrollo (`inventario`).

---

## 3. Puntos abiertos para la siguiente iteración

Cada punto indica la situación actual, el problema detectado, las alternativas y la decisión
que debe cerrarse antes de implementar.

### M1. Costo unitario del producto al registrar una compra

**Situación actual**

- Al confirmar una factura de compra, `products.costo` se reemplaza por el costo neto de la
  línea: `precio_unitario × (1 − descuento_pct / 100)`, sin IVA.
- El costo anterior se guarda en `invoice_items.costo_anterior` para restaurarlo si la factura
  se anula.
- Las salidas guardan un snapshot de costo histórico, por lo que las ventas pasadas no cambian
  si luego se modifica el costo del producto.

**Observación**

- Una compra nueva con otro precio (o con descuento) sobrescribe el costo de referencia del
  producto, aunque esa compra no necesariamente represente el costo vigente del inventario.
- Si el descuento es comercial, aplicarlo al costo puede distorsionar el costo de referencia.
- Se planteó que solo una edición manual del costo debería cambiarlo.

**Alternativas**

| Opción | Comportamiento | Ventaja | Riesgo |
|---|---|---|---|
| A. Actual (mantener) | La compra actualiza el costo neto | Costo siempre refleja la última compra | Sobrescribe costo de referencia |
| B. Solo manual | La compra no toca `products.costo`; solo guarda costo del movimiento/línea | Control explícito del costo | Costo de referencia puede quedar desactualizado |
| C. Costo promedio ponderado | Recalcula con existencias y costo de la compra | Valuación más realista | Más complejidad y migración de datos |

**Recomendación**

- Si el objetivo es simplicidad: **Opción B**, usando el costo de la línea de compra para el
  movimiento y el costo histórico de salida. La edición manual del producto sigue siendo la
  única que cambia el costo de referencia.
- Si se quiere valuación de inventario más realista: **Opción C** (promedio ponderado),
  preferiblemente en una fase separada.

**Decisión adoptada:** **Opción B (solo manual)**. La compra guarda el costo neto como costo
histórico del movimiento de entrada, pero **no modifica `products.costo`**; solo la edición
manual del producto (rol admin) cambia el costo de referencia. El descuento de compra sí se
aplica al costo del movimiento/línea (costo neto sin IVA).

---

### M2. Costo de inventario vs. costo de venta

**Modelo contable adoptado (Opción A)**

| Concepto | ¿Genera salida de caja? | ¿Reduce la utilidad? | Dónde se registra |
|---|---|---|---|
| Costo de inventario | Sí, al comprar o fabricar | No directamente | Balance: activo “Inventario” |
| Costo de venta | No en ese instante (el dinero ya salió al comprar) | Sí, al vender | Estado de resultados: gasto “Costo de ventas” |

- **Compra de inventario:** sale dinero de caja/bancos, pero el valor entra como activo.
  No reduce la utilidad del periodo.
- **Venta:** el inventario sale del activo y se reconoce el gasto “Costo de ventas”.
  Reduce la utilidad y el margen bruto, pero no vuelve a mover caja.
- **Resultado:** cada peso del costo impacta una sola vez la utilidad (al vender) y una sola
  vez la caja (al comprar).

**Implementación**

- `finance_categories.afecta_caja` (V014) indica si un asiento mueve caja:
  - `afecta_caja = 1`: entra o sale dinero de caja/bancos (ventas, gastos operativos,
    compras de inventario).
  - `afecta_caja = 0`: asiento informativo que solo afecta resultados (costo de ventas, IVA).
- V015 transforma la categoría “Compra de inventario” (gasto) en **“Inventario” (activo)** y
  migra las transacciones históricas. Conserva el id para no romper presupuestos.
- `egresos` y el saldo de cuentas incluyen las compras de inventario (salida real de caja).
- `gastos_totales`, `utilidad` y `margen_bruto` solo descuentan gastos (costo de ventas y
  gastos operativos), no la compra del activo.
- El resumen expone `compras_inventario` para mostrar la compra como activo, y la UI marca el
  costo de ventas como «No afecta caja».
- El presupuesto puede planificar la categoría “Inventario” (activo) y su ejecución se mide
  contra las compras reales.

---

### M3. Alertas de stock bajo, IVA por defecto y retenciones automáticas

**Situación actual**

- El formulario de factura muestra el stock en el selector, pero no marca explícitamente
  “stock bajo”.
- El IVA se ingresa manualmente por línea (por defecto 0).
- Las retenciones se ingresan manualmente y son informativas.

**Propuesta**

1. **Stock bajo en cotización y factura**
   - Marcar productos con `stock_actual <= stock_minimo` con un tag/aviso.
   - En factura, si la cantidad supera el stock, el servidor ya rechaza la confirmación.
   - En cotización, mostrar alerta y impedir aprobación sin stock (ver M4).

2. **IVA 19 % automático en factura**
   - Precargar `impuesto_pct = 19` en las líneas nuevas.
   - Permitir edición manual (0 %, 5 %, exentos, etc.).
   - Evaluar un campo de impuesto por producto en el catálogo como fuente del valor.

3. **Retenciones automáticas según tipo**
   - Precargar retenciones al cambiar el tipo de factura, con posibilidad de edición.
   - Definir si son porcentajes sobre base neta o sobre IVA.
   - No hardcodear tarifas legales sin confirmación: deben ser parámetros configurables.

**Decisión adoptada:** el IVA 19 % se precarga por defecto en las líneas nuevas de factura
**y cotización** (venta y compra), y es editable (0 %, 5 %, exentos, etc.). Las retenciones se
prellenan automáticamente según el tipo de factura y son editables; los porcentajes son
parámetros configurables (no tarifas legales hardcodeadas) y, por defecto, se dejan en 0 hasta
confirmar las tasas legales. Las retenciones continúan siendo **informativas**: reducen el
`total_neto` a pagar, pero no generan asientos contables. Las alertas de stock bajo se muestran
en la factura y en la cotización.

---

### M4. No aprobar cotizaciones sin stock suficiente

**Situación actual**

- La aprobación no valida stock; la entrega sí lo valida y bloquea.
- Entre aprobación y entrega el stock puede cambiar.

**Propuesta**

- Validar stock en la transición a `aprobado`, con el mismo criterio de la entrega.
- Informar todos los productos con faltante en un solo mensaje.
- Evaluar reserva de stock al aprobar para evitar que otra operación lo consuma.

**Decisión adoptada:** se **bloquea** la aprobación si no hay stock suficiente (error 409, sin
cambio de estado), informando todos los productos con faltante en un solo mensaje. La entrega
sigue validando stock por si cambió desde la aprobación. No se reserva stock al aprobar.

**Criterios de aceptación**

- Aprobar una cotización con faltante devuelve error 409 y no cambia de estado.
- Aprobar con stock suficiente funciona igual que hoy.
- La entrega sigue validando stock por si cambió desde la aprobación.

---

### M5. Vínculo cotización ↔ factura y recordatorios

**Situación actual**

- La factura puede vincular una cotización `aprobado` o `entregado`.
- Si la cotización está aprobada, la factura mueve stock y la deja entregada.
- Si está entregada, la factura no mueve stock y solo contabiliza.
- Una cotización entregada puede quedar sin factura y, por tanto, sin contabilidad.
- No existe unicidad de factura por cotización: podrían crearse varias facturas para la misma
  cotización.

**Propuesta**

1. Marcar la cotización entregada como **“pendiente de facturar”** cuando no tenga factura.
2. Añadir filtro/columna y alerta en el listado y en el detalle de la cotización.
3. Botón **“Generar factura”** desde la cotización, con datos y líneas precargadas.
4. Advertir si se intenta crear otra factura para una cotización ya facturada.
5. Definir el flujo recomendado:
   - Cotización aprobada → factura mueve stock y entrega.
   - Cotización entregada → factura solo contabiliza.
   - Cotización entregada sin factura → recordatorio persistente, nunca generación silenciosa.
6. Evaluar la generación automática de factura solo con confirmación explícita y aviso.

**Decisión adoptada:** sí, una cotización aprobada puede vincularse a **más de una factura**
(facturación por hitos/avances). La cotización es una **propuesta comercial informativa** y la
factura es el **documento legal** que refleja el cobro real: los valores pueden diferir si antes de
facturar cambian cantidades, precios, descuentos o tarifas de impuestos. Por eso el total cotizado
**no es un tope** y el servidor no bloquea la confirmación por superarlo; el saldo cotizado se
muestra como seguimiento en el detalle y el formulario avisa (sin impedir) cuando la factura lo
supera. Una vez emitida la factura, los ajustes se hacen con nota crédito o débito. La generación es
**asistida**, no automática: desde la cotización se precargan datos y líneas, y el cliente puede
agregar información antes de confirmar. Una cotización entregada con saldo pendiente se marca como
"pendiente de facturar" con una alerta persistente (nunca generación silenciosa). Existe vínculo
bidireccional cotización ↔ factura.

---

### M6. Autocompletar líneas de la factura desde la cotización

**Situación actual**

- El formulario de venta permite seleccionar una cotización, pero solo guarda `quote_id`.
- Las líneas, precios, descuentos e impuestos se ingresan manualmente.

**Propuesta**

- Al seleccionar una cotización:
  - Cargar cliente, documento, email y notas.
  - Cargar las líneas: producto, cantidad, precio unitario, descuento % e impuesto %.
  - Mostrar el total estimado y el stock disponible por producto.
- Permitir editar después de cargar.
- Añadir botón **“Sincronizar desde cotización”** para recargar si cambió.
- Advertir si el precio de la factura difiere del cotizado.
- Impedir agregar dos veces el mismo producto si la cotización ya lo incluye.

**Decisión adoptada:** el precio de la factura **no se bloquea** al de la cotización. Al
seleccionar una cotización se precargan cliente, documento, email, notas y líneas (producto,
cantidad, precio unitario, descuento e impuesto), y el cliente puede cambiar valores, corregir
precios y agregar productos adicionales. Se sincronizan productos, cantidades, precios,
descuentos e impuestos.

**Criterios de aceptación**

- Seleccionar una cotización llena las líneas y los datos del cliente.
- El usuario puede ajustar cantidades/precios antes de guardar.
- El total de la factura es coherente con las líneas cargadas.
- Si el stock es insuficiente, se muestra alerta antes de confirmar.

---

## 4. Prioridad sugerida

| Prioridad | Punto | Motivo |
|---|---|---|
## 4. Estado de las mejoras M1–M6

Todas las mejoras están implementadas, probadas y en verde (tests, typecheck y build).

| Mejora | Estado | Notas |
|---|---|---|
| M1. Costo unitario en compras | Implementado | `products.costo` solo cambia con edición manual; la compra no lo sobrescribe. |
| M2. Inventario y costo de venta | Implementado | Compra = activo con salida de caja; costo de venta = gasto que reduce utilidad/margen sin mover caja. |
| M3. Alertas, IVA y retenciones | Implementado | IVA 19 % por defecto (editable) en factura y cotización; stock bajo; retenciones prellenadas según tipo. |
| M4. Aprobación sin stock | Implementado | Bloquea la aprobación con 409 si hay faltante; la entrega sigue validando. |
| M5. Múltiples facturas por cotización | Implementado | Facturación por hitos; el total cotizado es referencia y no un tope; aviso no bloqueante si la factura lo supera; generación asistida; saldo pendiente de facturar. |
| M6. Autocompletado desde cotización | Implementado | Precarga datos y líneas; precios editables y productos adicionales permitidos. |

---

## 5. Decisiones cerradas (M1–M6)

Todas las decisiones de la iteración anterior están cerradas:

1. El costo del producto solo se actualiza con edición manual, no con las compras (M1).
2. El capital disponible representa caja; las compras de inventario salen de caja como activo (M2).
3. El costo de ventas es un gasto que afecta utilidad/margen, pero no mueve caja porque el dinero ya salió al comprar el inventario (M2).
4. Los porcentajes de retención son parámetros configurables; por defecto 0 hasta confirmar tasas legales, y las retenciones se mantienen informativas (M3).
5. La aprobación de cotización bloquea si no hay stock suficiente (M4).
6. Una cotización puede generar más de una factura; el total cotizado se sigue como saldo informativo, no como límite (M5).
7. La generación de factura desde cotización es asistida, no automática (M5).
8. El precio de la factura no se bloquea; se permite editar y agregar productos (M6).

---

## 6. Ajustes de UI/UX posteriores

- **Stock en líneas autocompletadas:** las líneas que llegan desde una cotización, al editar
  una factura o al reabastecer un producto ahora hidratan sus datos por lote de ids
  (`GET /api/products?ids=1,2,3`). Así el select y las alertas muestran SKU, nombre y stock
  real también en esas líneas. El indicador de stock es permanente: verde (suficiente),
  naranja (bajo mínimo) y rojo (cantidad solicitada > disponible).
- **Cotización ya entregada:** si la cotización vinculada está en estado `entregado`, el stock
  ya salió al entregar y la factura solo reconoce la venta y el costo de ventas. El formulario
  reemplaza el semáforo de stock por la etiqueta «Entregado en cotización» (o «Agregado tras
  la entrega» para productos que no estaban en la cotización) y el detalle de la factura
  (`quote_estado`) ajusta los textos de confirmación y anulación para no prometer un
  descuento de inventario que no ocurrirá.
- **Fechas sin desfase horario:** las columnas DATE (`fecha` de factura/cotización, vigencias y
  periodos) se muestran con `formatDateOnly` (`client/src/utils/dates.ts`), que conserva el día
  calendario `AAAA-MM-DD` sin reinterpretarlo como medianoche UTC. En Bogotá (UTC-5) una fecha
  `2026-11-09` ya no se muestra como `2026-11-08`. Las columnas DATETIME siguen usando la
  conversión local.
- **Reabastecimiento:** en el inicio, cada producto con stock bajo tiene la acción «Comprar»
  que abre una factura de compra (`?tipo=compra&product=id`) con el producto y su costo
  precargados.
- **Presupuestos: ingresos vs. gastos:** superar la meta de una categoría de ingreso se
  muestra como resultado positivo («Meta superada», verde); superar el límite de un gasto se
  mantiene como alerta («Excedido», rojo). El resumen global ya no marca «excedido» por un
  sobrecumplimiento de ingresos.
- **Ajuste de presupuestos:** un presupuesto en estado `activo` se puede ajustar (no así uno
  cerrado). Al cambiar los montos planificados se recalcula la ejecución de las transacciones
  ya registradas.
- **Numeración de cotizaciones:** el prefijo documental es `COT-` (antes `PRE-`). La migración
  V013 actualiza también los motivos históricos de movimientos de stock
  («Presupuesto PRE-n» → «Presupuesto COT-n»).

---
