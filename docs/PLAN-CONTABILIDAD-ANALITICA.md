# Plan de contabilidad y analítica de datos

> Documento vivo. Registra el alcance, las decisiones contables, el modelo de
> datos y el avance de las mejoras. Cada bloque implementado se marca aquí y en
> el historial de commits de la rama `feat/contabilidad-analitica`.

## 1. Punto de partida

La aplicación ya tiene una base financiera sólida:

- Asientos automáticos al confirmar facturas (`transactions`).
- IVA separado (por pagar / descontable) y costo de ventas histórico.
- Distribución analítica por producto (`transaction_allocations`).
- Presupuestos por periodo con ejecución, alertas y cierre.
- Inventario valorizado y trazabilidad documental cotización → factura.

Los huecos principales eran:

1. **No existía cartera**: confirmar una venta a crédito aumentaba la caja como
   si se hubiera cobrado.
2. **Las retenciones eran solo informativas**: no reducían la cuenta por cobrar
   ni generaban un activo/pasivo.
3. **No había estados financieros** (resultado, flujo de caja, balance).
4. **La analítica era operativa**, no contable: no había margen por producto o
   cliente, rotación, ABC ni embudo de cotizaciones.
5. **Dependencia de nombres de categorías** (`'Ventas'`, `'IVA por pagar'`): un
   cambio de nombre rompía los indicadores.

## 2. Principios contables adoptados

- **Moneda**: COP, `DECIMAL(18,2)`, redondeo a dos decimales. Nunca `FLOAT`.
- **Partida simple controlada**: cada asiento tiene una naturaleza
  (`ingreso | gasto | activo | pasivo`) y declara si mueve caja.
- **Devengo vs. caja**:
  - Una venta a crédito reconoce el ingreso y el IVA, pero **no** mueve caja.
  - El cobro posterior mueve caja y reduce la cartera, sin volver a reconocer
    ingreso.
  - Una compra a crédito reconoce inventario y IVA, pero no mueve caja; el pago
    posterior sí.
- **Costo de ventas**: se reconoce al vender, con el costo histórico del
  movimiento de salida. No vuelve a mover caja (la compra ya la movió o generó
  una cuenta por pagar).
- **IVA**: no es dinero propio. Se registra como pasivo (por pagar) o activo
  (descontable) y no afecta el capital de caja. Se netea en los informes.
- **Retenciones**: reducen el valor neto a cobrar/pagar. Se reconocen como
  activo ("Retenciones a favor") en ventas y pasivo ("Retenciones por pagar")
  en compras.
- **Anulaciones**: ningún asiento se edita ni se borra; se anula con
  contrapartida. Una factura con pagos no se anula hasta revertirlos.
- **Trazabilidad**: toda operación sensible queda en `audit_log`.
- **Códigos de sistema**: las categorías contables se identifican por `codigo`,
  no por nombre visible.
- **Terceros**: clientes y proveedores se registran una vez y se reutilizan. La
  factura conserva un snapshot de nombre/documento y se vincula con `party_id`.
- **Condición de pago**: contado mueve caja al confirmar; crédito genera cartera
  y mueve caja al registrar el cobro o pago. El vencimiento se calcula con los
  días de crédito.

## 3. Modelo de datos objetivo

### 3.1 Extensiones existentes

| Tabla | Cambio | Motivo |
|---|---|---|
| `finance_categories` | `codigo` único y `afecta_resultado` | Desacoplar lógica del nombre; separar resultado de caja |
| `transactions` | `afecta_caja` opcional (override) | Una misma categoría puede moverse a caja o no según la factura |
| `invoices` | `party_id`, `condicion_pago`, `dias_credito`, `fecha_vencimiento` | Terceros y cartera |
| `invoices` | `saldo_pendiente` derivado | Estado real de la cuenta por cobrar/pagar |

### 3.2 Tablas nuevas

- **`third_parties`**: clientes y proveedores con documento, contacto,
  condiciones de pago y estado.
- **`invoice_payments`**: pagos y cobros parciales, con cuenta, método,
  referencia, anulación y vínculo al asiento de caja.
- **`period_closures`**: cierre formal con nombre, rango, snapshot JSON de
  totales (resumen, facturas, cartera y retenciones), responsable, fecha y
  estado (`cerrado | reabierto`). La reapertura guarda motivo, usuario y fecha;
  nunca se borra el cierre.

### 3.3 Derivaciones (no se guardan duplicadas)

- `saldo_pendiente` de una factura = `total_neto` − pagos válidos (para
  crédito); 0 para contado.
- Estado de cartera: `pendiente | parcial | pagada | vencida`.
- Edad de cartera: 0–30, 31–60, 61–90, +90 días desde `fecha_vencimiento`.
- Utilidad = ingresos de resultado − gastos de resultado.
- Capital de caja = saldos iniciales + movimientos con impacto de caja.

## 4. Fases y alcance

### Fase 0 — Fundamentos (quick wins)

| ID | Mejora | Estado |
|---|---|---|
| QW-1 | Inventario valorizado **al costo** además del precio de venta | Hecho |
| QW-2 | IVA neto (por pagar − descontable) en el resumen | Hecho |
| QW-3 | Categorías contables por `codigo` de sistema | Hecho |
| QW-4 | Rango de fechas de Finanzas persistido en la URL | Hecho |
| QW-5 | Dashboard financiero del mes en Inicio (según rol) | Hecho |

### Fase 1 — Núcleo contable

| ID | Mejora | Estado |
|---|---|---|
| C1 | Maestro de terceros (clientes/proveedores) | Hecho |
| C2 | Cartera CxC/CxP, condiciones de pago y pagos parciales | Hecho |
| C3 | Aging, mora, DSO y alertas de cobro | Hecho |
| C4 | Retenciones contables (activo/pasivo, no solo informativas) | Hecho |
| C5 | Cierre de periodo formal con snapshot y reapertura auditada | Hecho |

### Fase 2 — Informes y analítica

| ID | Mejora | Estado |
|---|---|---|
| R1 | Estado de resultados (P&L) por periodo y comparativo | Hecho |
| R2 | Flujo de caja por cuenta y por mes | Hecho |
| R3 | Balance simplificado (caja, inventario, cartera, impuestos) | Hecho |
| A1 | Rentabilidad por producto, categoría y cliente | Hecho |
| A2 | Rotación, días de inventario, stock muerto y ABC | Hecho |
| A3 | Embudo de cotizaciones y tiempo de cierre | Hecho |
| A4 | Tendencias mensuales y comparación de periodos | Hecho |
| R4 | Exportación de reportes a CSV y PDF con los filtros activos | Hecho |
| R5 | Conciliación bancaria con extracto, sugerencias de cruce y cierre auditado | Hecho |
| R6 | Alertas de cartera priorizadas y seguimiento de cobro auditado | Hecho |
| R7 | Cierre de ejercicio con resultado y balance congelados | Hecho |
| R8 | Rendimiento de consultas, índices y carga inicial del cliente | Hecho |

### Fase 3 — Gobierno del dato

| ID | Mejora | Estado |
|---|---|---|
| G1 | Visor de auditoría (`audit_log`) | Hecho |
| G2 | Panel de salud de datos (asientos huérfanos, stock negativo, sin costo) | Hecho |
| G3 | Índices analíticos y pruebas de invariantes contables | Hecho |

## 5. Reglas de negocio nuevas

- **RN-13**: Una factura de venta a crédito no aumenta la caja al confirmarse;
  genera una cuenta por cobrar por `total_neto`.
- **RN-14**: Una factura de compra a crédito no reduce la caja al confirmarse;
  genera una cuenta por pagar por `total_neto`.
- **RN-22**: Un pago/cobro no puede superar el saldo pendiente ni registrarse en
  una factura anulada o en borrador.
- **RN-23**: Anular un pago genera una contrapartida de caja y deja el pago
  marcado como anulado; no se borra.
- **RN-24**: Anular una factura exige que no tenga pagos válidos.
- **RN-18**: Las retenciones reducen el valor neto de la factura y se reconocen
  como activo (venta) o pasivo (compra).
- **RN-19**: Los informes usan `afecta_resultado` para el P&L y `afecta_caja`
  (con override) para el flujo de caja.
- **RN-20**: Los códigos de sistema (`ventas`, `costo_ventas`,
  `iva_por_pagar`, `iva_descontable`, `inventario`, etc.) no se renombran.
- **RN-25**: Toda exportación de reportes respeta los filtros activos en pantalla.
  El CSV conserva los valores numéricos sin formato para poder sumarlos en Excel;
  el PDF es una vista imprimible que incluye metadatos, secciones y notas del
  reporte, y se guarda como PDF desde el diálogo de impresión del navegador.
- **RN-26**: En la conciliación bancaria cada línea del extracto tiene signo:
  positivo para entradas y negativo para salidas. El asiento del sistema se
  compara con el mismo criterio (ingreso/pasivo suma, gasto/activo resta).
- **RN-27**: Solo se cruzan líneas y asientos de la misma cuenta con el mismo
  importe firmado y un asiento vigente que afecte caja. Las sugerencias usan una
  tolerancia de fechas configurable; el cruce manual exige que el importe
  coincida exactamente.
- **RN-28**: Una conciliación se cierra cuando todas sus líneas están conciliadas
  o ignoradas con nota y el saldo final del extracto coincide con el inicial más
  sus líneas. Las partidas conciliatorias pendientes del sistema no impiden el
  cierre: se muestran como diferencia explicada.
- **RN-29**: Reabrir una conciliación no la borra: guarda el motivo, el usuario y
  la fecha, y deja el hecho en `audit_log`. Una conciliación cerrada no admite
  cambios en sus líneas.
- **RN-30**: La conciliación es un control de consistencia: no crea, modifica ni
  anula asientos contables. Cualquier diferencia debe resolverse con un
  movimiento financiero independiente y auditado.
- **RN-31**: Las alertas de cartera se calculan desde la misma cartera derivada
  del aging: no duplican saldos ni crean asientos. Una factura abierta genera una
  sola alerta según su mora: crítica (>90 días), alta (31-90), media (1-30 y sin
  fecha de vencimiento) o baja (vence en los próximos 7 días).
- **RN-32**: El seguimiento de una alerta guarda estado (`pendiente`, `recordado`,
  `promesa`, `escalado` o `resuelto`), nota y próximo contacto. Es único por
  factura, nunca se borra y cada cambio queda en `audit_log` con la entidad
  `receivable_followup`; una promesa exige fecha de próximo contacto.
- **RN-33**: Las alertas resueltas se ocultan por defecto, pero se pueden incluir
  con `incluir_resueltos=true`. El seguimiento no modifica la factura, los pagos
  ni la contabilidad, y solo se permite mientras la factura tenga saldo.
- **RN-34**: Un cierre de ejercicio cubre exactamente del 1 de enero al 31 de
  diciembre. Se guarda en `period_closures` con `tipo = 'ejercicio'` y `anio`, y
  comparte con los cierres de periodo el bloqueo de asientos, el snapshot y la
  reapertura auditada. Solo se permiten años entre 2000 y el año actual.
- **RN-35**: El cierre anual no genera asientos de cierre ni de apertura: congela
  en el snapshot el resultado del ejercicio (ingresos, costo de ventas, margen
  bruto, gastos y utilidad) y el balance al 31 de diciembre. El patrimonio del
  balance se sigue derivando de activo − pasivo.
- **RN-36**: Un año puede cerrarse, reabrirse y volver a cerrarse. Cada intento
  es una fila nueva: la reapertura no borra el cierre anterior. El cierre anual
  puede convivir con los cierres mensuales y reabrir el anual no reabre los meses.
- **RN-37**: Los filtros por fecha comparan la columna directamente
  (`created_at >= ?` y `< DATE_ADD(?, INTERVAL 1 DAY)`), sin envolverla en
  `DATE()`, para que MariaDB pueda usar el índice. Las consultas independientes de
  un mismo listado se ejecutan en paralelo.
- **RN-38**: El cliente carga cada página bajo demanda. El bundle inicial solo
  incluye autenticación, layout y enrutador; los módulos de finanzas, gráficos e
  impresión se descargan al entrar a su ruta.
- **RN-39**: El aviso de confirmación de factura muestra el movimiento real de
  caja: `base (subtotal − descuento) − retenciones de fuente/ICA` en venta y
  `−base + retenciones de fuente/ICA` en compra. El IVA (`IVA por pagar` en venta,
  `IVA descontable` en compra) y la retención de IVA nunca forman parte del
  movimiento. A crédito el movimiento es cero y el saldo queda en cartera por el
  total neto de retenciones.
- **RN-40**: La proyección de caja vive en `invoiceCashProjection`
  (`invoices.shared.ts`) y se expone en el detalle como `impacto_caja`; la UI no
  recompone la fórmula. Una prueba compara la proyección contra la suma de los
  asientos con `afecta_caja = 1` para evitar que vuelvan a divergir.
- **RN-41**: El resumen financiero usa periodos calendario: día (fecha), semana
  (lunes a domingo), mes y año. Los presets se guardan en la URL (`periodo`,
  `desde`, `hasta`) y la comparación usa el periodo calendario anterior; para un
  rango libre se compara un bloque de igual duración inmediatamente anterior.
  `capital_disponible` sigue siendo un saldo acumulado a la fecha final y no se
  compara contra el periodo previo.

## 6. Criterios de aceptación transversales

- `server`: `npm run typecheck` y `npm test` en verde.
- `client`: `npx tsc --noEmit` y `npm run build` en verde.
- Migraciones idempotentes y aplicables sobre datos existentes.
- Documentación actualizada en este archivo y en `docs/REQUISITOS-FINANZAS.md`.
- Sin secretos ni datos reales de terceros en el repositorio.

## 7. Bitácora de implementación

| Fecha | Bloque | Commit | Notas |
|---|---|---|---|
| 2026-11-11 | Plan y rama | — | Rama `feat/contabilidad-analitica` creada desde `main` con el PR #27 fusionado |
| 2026-11-11 | Fase 0 (QW-1..QW-5) | — | Migración `V017`; categorías por código; IVA neto; inventario al costo; dashboard mensual; rango en URL; imports `quoteUtils` normalizados |
| 2026-11-11 | C1 (terceros) | — | Migración `V018`; CRUD `/api/third-parties`; página Terceros; vínculo `invoices.party_id`; condición de pago y vencimiento; ventas/compras a crédito no mueven caja |
| 2026-11-11 | C2 (cartera y pagos) | — | Migración `V019`; cartera derivada con pagos parciales y anulación; `/api/invoices/cartera` y `/payments`; página Cartera; tarjeta de pagos en el detalle; `ingresos_totales` en el resumen |
| 2026-11-11 | C3 (aging y DSO) | — | `/api/invoices/cartera/aging`; tramos corriente a +90 días, DSO simple, saldo vencido, por vencer en 7 días y principales deudores; panel en la página de Cartera |
| 2026-11-11 | C4 (retenciones) | — | Asientos de retenciones a favor (venta) y por pagar (compra); fuente e ICA mueven caja, IVA retenido no; validación de retenciones ≤ total y pruebas de API |
| 2026-11-11 | C5 (cierres) | — | Migración `V020`; `/api/period-closures` con snapshot, bloqueo de asientos, superposición controlada y reapertura auditada; página Cierres con detalle del snapshot |
| 2026-11-11 | R1 (P&L) | — | `/api/finance/pnl`; ingresos, costo de ventas, margen bruto, gastos operativos y utilidad por categoría; comparativo contra el periodo anterior con variaciones; página Resultados |
| 2026-11-11 | R2 (flujo de caja) | — | `/api/finance/cash-flow`; saldo inicial del rango, entradas, salidas y neto por cuenta y por mes, con filtro por cuenta y meses sin movimiento en cero; página Flujo de caja |
| 2026-11-11 | R3 (balance) | — | `/api/finance/balance`; activo (caja, inventario al costo, cartera, IVA y retenciones a favor), pasivo, patrimonio derivado y ecuación de cuadre; página Balance a una fecha |
| 2026-11-11 | A1 (rentabilidad) | — | `/api/finance/profitability` por producto, categoría y cliente usando `transaction_allocations` con costo histórico; margen, participación, unidades y facturas; página Rentabilidad |
| 2026-11-11 | A2 (rotación y ABC) | — | `/api/finance/inventory-analytics` con rotación, días de inventario, stock muerto configurable y clasificación ABC por ingresos; última venta y alertas de costo faltante; página Rotación |
| 2026-11-11 | A3 (embudo) | — | `/api/finance/quotes-funnel` con embudo acumulativo creadas → enviadas → aprobadas → entregadas, conversiones, estados actuales, tiempos de aprobación/entrega/ciclo y detalle por cotización; página Embudo |
| 2026-11-11 | A4 (tendencias) | — | `/api/finance/trends` con serie mensual de resultado (ingresos, costo, margen, gastos, utilidad) y caja (entradas, salidas, neto, saldo acumulado), meses sin movimiento en cero y comparación contra el periodo anterior de igual duración y el mismo rango del año anterior; página Tendencias con gráficos y tabla |
| 2026-11-11 | G1 (auditoría) | — | `/api/audit` de solo lectura con filtros por entidad, entidad_id, acción, usuario y fechas, paginación, resumen por entidad y valores antes/después; página Auditoría con filas expandibles |
| 2026-11-11 | G2 (salud de datos) | — | `/api/finance/data-health` con comprobaciones de asientos huérfanos, pagos sin asiento vigente, stock negativo y productos sin costo; estado global, resumen y detalle por hallazgo; página Salud de datos |
| 2026-11-11 | G3 (índices e invariantes) | — | Migración `V021` con índices compuestos para facturas, ítems, pagos, productos y cierres; pruebas de invariantes de totales, retenciones, asientos vigentes, anulaciones, cartera, pagos, asignaciones y ecuación del balance |
| 2026-11-11 | C6 (notas crédito/débito) | — | Migración `V022`; tablas `invoice_adjustments` y `invoice_adjustment_items`; asientos con signo negativo para notas crédito; cartera, P&L, balance, aging y presupuestos netean automáticamente; UI en el detalle de factura con creación y anulación auditada |
| 2026-11-12 | R4 (exportación) | — | Utilidad común `reportExport` con documentos por secciones; CSV sin formato numérico (Excel) y PDF mediante vista imprimible del navegador; botón **Exportar** en resultados, flujo de caja, balance, cartera, tendencias, rentabilidad, rotación y embudo, respetando filtros y exportando todas las páginas de la cartera |
| 2026-11-12 | R5 (conciliación bancaria) | - | Migración `V023`; tablas `bank_reconciliations` y `bank_statement_lines`; líneas con signo, sugerencias por importe y tolerancia de fechas, cruce/desconciliación, líneas ignoradas con nota, cierre con snapshot y reapertura auditada; página Conciliación con saldos, avance y partidas conciliatorias |
| 2026-11-12 | R6 (alertas de cartera) | - | Migración `V024`; tabla `receivable_followups`; alertas calculadas desde la cartera (mora crítica/alta/media, vencimiento próximo y sin fecha), resumen por severidad, clientes críticos y seguimiento auditado; panel en Cartera con filtros y modal de gestión |
| 2026-11-12 | R7 (cierre de ejercicio) | - | Migración `V025`; `tipo` y `anio` en `period_closures`; vista previa sin persistir, cierre anual con resultado y balance congelados, bloqueo del año, duplicado controlado y recierre con historial; pestaña **Ejercicio** en Cierres con detalle anual |
| 2026-11-12 | R8 (rendimiento) | - | Migración `V026` con índices para cartera, DSO, dashboard, auditoría y embudo; filtros de fecha sin `DATE()`; listados con consultas en paralelo; páginas del cliente cargadas con `React.lazy` y `Suspense`; prueba de regresión de índices |
| 2026-11-12 | Claridad de caja e IVA | - | `invoiceCashProjection` y `impacto_caja` en el detalle; aviso de confirmación con base, IVA, retenciones y movimiento neto separados; a crédito sin movimiento y cartera por el neto; pruebas de coherencia con los asientos y documentación de IVA por pagar/descontable |
| 2026-11-13 | Resumen financiero por periodo | - | Atajos día/semana/mes/año, navegación anterior/actual/siguiente y rango personalizado persistidos en la URL; comparación contra el periodo calendario anterior; enlaces a Resultados, Flujo de caja, Tendencias y Transacciones conservando el rango |
| 2026-11-13 | Selector de periodo compartido | - | `useDateRange` y `PeriodRangePicker` reutilizables: presets, navegación, rango personalizado y limpieza; aplicados a Resultados, Flujo de caja, Tendencias, Rentabilidad, Rotación, Embudo, Transacciones, Auditoría, Movimientos, Facturas, Cotizaciones y Cartera, con `desde`/`hasta`/`periodo` en la URL |
| 2026-11-13 | Terceros en cotizaciones | - | Migración `V027`; `quotes.party_id` con FK a `third_parties` e índice; validación de cliente activo (se rechazan proveedores e inactivos); el formulario autollena nombre, documento y email y guarda snapshot editable; el detalle y la lista muestran el vínculo y duplicar lo conserva; el vínculo entra en la auditoría de la cotización |
| 2026-11-14 | Duplicados de producto en líneas | - | En cotizaciones y facturas, los productos ya usados en otra línea aparecen deshabilitados con la marca «ya agregado»; la lista valida duplicados antes de guardar. El servidor conserva RN-P03 y la validación de facturas como última barrera |
| 2026-11-14 | Cotización vs. factura: montos independientes | - | Se retiró el 409 que impedía confirmar una factura por superar el total cotizado: la cotización es una propuesta comercial y la factura el documento legal de la venta. `getQuote` expone `facturado` y `saldo_por_facturar`; el detalle muestra el seguimiento y permite facturar por hitos; el formulario de factura avisa (sin bloquear) cuando supera el saldo. “Pendiente de facturar” pasa a significar saldo sin cubrir |
| 2026-11-14 | Stock en cotización entregada | - | `getInvoice` expone `quote_estado`; el formulario de factura marca las líneas como «Entregado en cotización» («Agregado tras la entrega» si el producto no estaba), suprime la alerta de stock y avisa que confirmar no mueve inventario; los textos de confirmación y anulación del detalle distinguen este caso |
| 2026-11-14 | Entrega desde la factura | - | Se retiró el botón «Entregar» de la cotización; el timeline conserva el paso «Entregado» y explica que se alcanza al confirmar la factura de venta. El endpoint `/quotes/:id/deliver` se conserva para una futura entrega de almacén |
| 2026-11-14 | Descuento de compra y costo de venta | - | Prueba RF-14: el descuento de compra reduce la caja y el activo Inventario (base neta) y queda como costo histórico de la entrada, pero no modifica `products.costo`; el costo de venta usa el costo unitario del producto y es un gasto con `afecta_caja = 0`. Aviso explicativo en el formulario de compra |
| 2026-11-14 | Conciliacion entrega vs. factura | - | `quoteDeliveryReconciliation` y `conciliacion_entrega` en `getInvoice`; al confirmar una factura vinculada a una cotizacion entregada se descuenta el excedente facturado y se devuelve lo entregado no facturado solo al cerrar el saldo cotizado; notas credito reducen lo facturado acumulado. Pruebas RF-15 y RF-16; anular revierte los ajustes sin tocar la entrega original |

## 8. Exportación de reportes (R4)

- **Cobertura**: Estado de resultados, flujo de caja, balance simplificado,
  cartera (incluido aging y principales deudores), tendencias, rentabilidad,
  rotación de inventario y embudo de cotizaciones.
- **CSV**: cada reporte genera un archivo con las secciones visibles, separadas
  por una línea en blanco. Los importes, porcentajes y unidades se escriben como
  números sin símbolos ni separadores para que Excel los pueda sumar. Se usa
  `;` como separador y BOM UTF-8, igual que las exportaciones de listas.
- **PDF**: se abre una vista imprimible con título, periodo, metadatos, tablas y
  notas; desde el diálogo del navegador se elige *Guardar como PDF*. No se añade
  una dependencia de PDF al cliente.
- **Filtros**: la exportación usa el rango de fechas y los filtros activos. La
  cartera descarga todas las páginas del filtro (no solo la visible) y usa el
  resumen del servidor y el aging vigente.
- **Ventanas emergentes**: el PDF abre la ventana al hacer clic para que el
  navegador no la bloquee; si el usuario las bloquea, se muestra un mensaje de
  error y no se pierde el gesto original.
- **Componentes**: `client/src/utils/reportExport.ts` (documento, CSV y HTML
  imprimible) y `client/src/components/ReportExport.tsx` (botón común).

## 9. Conciliación bancaria (R5)

- **Tablas**: `bank_reconciliations` guarda la cabecera (cuenta, periodo, saldos
  inicial y final del extracto, estado, cierre y reapertura) y
  `bank_statement_lines` las líneas informadas por el banco. Una línea tiene
  fecha, descripción, referencia, importe con signo, estado
  (`pendiente`/`conciliada`/`ignorada`), nota y el asiento del sistema al que se
  cruzó.
- **Saldos**: el sistema calcula el saldo de la cuenta a la fecha de inicio con
  su saldo inicial y todos los asientos vigentes que afectan caja; luego suma los
  movimientos del periodo. El extracto se calcula con su saldo inicial más las
  líneas. La diferencia principal es `saldo_extracto_final - saldo_sistema`.
- **Partidas conciliatorias**: se separan las líneas del extracto pendientes o
  ignoradas (banco sin registrar en el sistema) de los movimientos del sistema
  que no aparecen en el extracto. La diferencia no explicada debería ser cero si
  los saldos iniciales coinciden.
- **Sugerencias**: para cada línea pendiente se buscan asientos vigentes de la
  misma cuenta, que afectan caja y tienen el mismo importe firmado, dentro de una
  tolerancia de fechas de ±3, ±7, ±15 o ±30 días. El cruce manual exige importe
  exacto y cuenta correcta.
- **Cierre**: exige que todas las líneas estén conciliadas o ignoradas con nota y
  que el saldo final del extracto cuadre con el inicial más sus líneas. Guarda un
  `snapshot` JSON con los totales y las partidas del momento.
- **Reapertura**: no borra el cierre; deja el motivo, el usuario y la fecha, y
  registra el hecho en `audit_log` con la entidad `bank_reconciliation`.
- **Alcance contable**: la conciliación no crea ni modifica asientos. Si el
  banco muestra una comisión o un cargo no registrado, se ignora con una nota o
  se registra aparte como gasto; la conciliación solo deja evidencia.
- **API**: `GET/POST /api/finance/reconciliations`,
  `GET/PUT /api/finance/reconciliations/:id`,
  `GET /api/finance/reconciliations/:id/suggestions`,
  `POST /api/finance/reconciliations/:id/lines`,
  `PUT/DELETE /api/finance/reconciliations/:id/lines/:lineId`,
  `POST /lines/:lineId/match`, `/unmatch`, `/ignore`, `/close` y `/reopen`.
- **UI**: página **Conciliación** en Finanzas con listado, avance por líneas,
  detalle con saldos y partidas conciliatorias, alta/edición de líneas y modales
  de cruce, ignorar, cerrar y reabrir.

## 10. Alertas de cartera (R6)

- **Origen**: se calculan al vuelo sobre `CARTERA_DERIVED`, la misma consulta que
  alimenta la cartera y el aging. Por eso el saldo vencido de las alertas coincide
  con el del aging y no se duplica información.
- **Reglas por factura abierta**:
  - `mora_90` (crítica): más de 90 días vencida.
  - `mora_31_90` (alta): entre 31 y 90 días vencida.
  - `mora_1_30` (media): entre 1 y 30 días vencida.
  - `por_vencer_7d` (baja): vence hoy o en los próximos 7 días.
  - `sin_vencimiento` (media): factura a crédito sin fecha de vencimiento.
  - Las facturas que vencen en más de 7 días no generan alerta.
- **Salida**: cada alerta incluye severidad, regla, cliente, factura, vencimiento,
  días de mora, saldo, título, detalle, acción sugerida y el seguimiento si
  existe. El reporte añade un resumen por severidad, saldo vencido, saldo por
  vencer, clientes afectados, alertas sin gestionar, contactos vencidos y
  promesas, más un top de clientes críticos.
- **Seguimiento**: tabla `receivable_followups` con un registro por factura.
  Estados: `pendiente`, `recordado`, `promesa`, `escalado` y `resuelto`; guarda
  nota, próximo contacto, usuario y fechas. Es append-only en la práctica: se
  actualiza, nunca se borra, y cada cambio queda en `audit_log` como
  `receivable_followup` con el id de la factura.
- **Filtros**: `tipo` (venta/compra), `severidad`, `q` y `incluir_resueltos`.
  El resumen no se reduce al filtrar por severidad para no perder la magnitud del
  problema; las alertas resueltas se ocultan salvo que se pidan expresamente.
- **API**: `GET /api/invoices/cartera/alertas` y
  `PUT /api/invoices/cartera/alertas/:id/seguimiento` (id de factura).
- **UI**: panel **Alertas de cobro/pago** en la página Cartera, antes del aging,
  con etiquetas de severidad, filtros, resumen, tabla priorizada y modal de
  gestión. Solo admin y contador pueden guardar seguimiento.
- **Alcance**: el seguimiento es gestión comercial, no contable. No crea pagos,
  no cambia saldos y no modifica asientos.

## 11. Cierre de ejercicio (R7)

- **Modelo**: reutiliza `period_closures`. La migración `V025` añade
  `tipo ENUM('periodo', 'ejercicio')` y `anio SMALLINT UNSIGNED NULL`, más el
  índice `(tipo, anio, estado)`. Los cierres anteriores quedan como `periodo`.
- **Rango**: siempre del 1 de enero al 31 de diciembre del año elegido. Se admiten
  años entre 2000 y el año actual; un año futuro se rechaza con 400.
- **Vista previa**: `GET /api/period-closures/ejercicios/:anio/preview` calcula
  resultado, balance, meses cerrados y si ya existe un cierre vigente, sin guardar
  nada. La UI la muestra antes de confirmar y deshabilita el botón si el año ya
  está cerrado.
- **Snapshot**: parte del snapshot de periodo (resumen, facturas, cartera,
  transacciones y retenciones) y añade:
  - `resultado`: ingresos, costo de ventas, margen bruto, gastos, utilidad y
    utilidad porcentual.
  - `balance`: activo, pasivo, patrimonio derivado, caja y bancos, inventario,
    cartera por cobrar/pagar, IVA por pagar/a favor y la marca `cuadra`.
  - `meses_cerrados`: cierres mensuales vigentes contenidos en el año.
- **Sin asientos**: el cierre anual no crea asientos de cierre ni de apertura. El
  resultado se congela en el snapshot y el patrimonio se sigue derivando en el
  balance; no se reescriben cuentas ni se ponen saldos a cero.
- **Bloqueo**: al quedar vigente, `assertPeriodOpen` impide registrar
  transacciones con fecha dentro del año, igual que un cierre mensual.
- **Convivencia**: puede existir junto a cierres mensuales. Los meses conservan
  su propio estado: reabrir el ejercicio no reabre los meses y estos siguen
  bloqueando sus fechas.
- **Duplicados e historial**: un mismo año no admite dos cierres vigentes (409).
  Tras reabrir, se puede volver a cerrar; se inserta una fila nueva y se conserva
  la anterior como `reabierto`, con motivo, usuario y fecha.
- **Auditoría**: el cierre registra `cerrar_ejercicio` y la reapertura `reabrir`
  en `audit_log` con entidad `period_closure`, incluyendo `tipo` y `anio`.
- **API**: `GET /api/period-closures/ejercicios/:anio/preview` (admin, contador,
  consulta) y `POST /api/period-closures/ejercicios` (admin, contador).
- **UI**: pestaña **Cierres de ejercicio** en la página Cierres, con aviso de que
  no se generan asientos, tabla de años, resultado, patrimonio, meses cerrados,
  estado del balance y detalle ampliado del snapshot anual.

## 12. Rendimiento (R8)

- **Diagnóstico**: se revisaron los planes de consulta de cartera, DSO, dashboard,
  auditoría, embudo y listados. Los principales problemas eran índices cuyo
  prefijo no coincidía con el filtro, filtros `DATE(columna)` que impedían usarlos
  y consultas independientes ejecutadas una tras otra.
- **Índices nuevos** (migración `V026`, idempotentes):
  - `invoices (estado, condicion_pago, fecha_vencimiento)`: cartera y alertas.
  - `invoices (tipo, estado, condicion_pago, fecha)`: DSO y ventas a crédito.
  - `stock_movements (created_at, tipo)`: dashboard de stock.
  - `audit_log (entidad, created_at)`: listado de auditoría por entidad y fecha.
  - `quotes (created_at)`: listado y embudo de cotizaciones.
- **Filtros de fecha**: donde había `DATE(columna) >= ?` / `<= ?` se reemplazó por
  `columna >= ?` y `columna < DATE_ADD(?, INTERVAL 1 DAY)`. El resultado funcional
  es el mismo (incluye el día final), pero el rango puede usar el índice.
- **Consultas en paralelo**: los listados de transacciones, facturas, cartera,
  aging, auditoría y tendencias lanzan sus consultas independientes con
  `Promise.all`. En facturas se eliminó el `COUNT(*)` extra: el total se deriva del
  resumen por tipo.
- **Flujo de caja**: el `LEFT JOIN` de transacciones ahora se limita con
  `t.fecha <= hasta`, así no procesa movimientos futuros o posteriores al rango.
- **Cliente**: todas las páginas de `App.tsx` usan `React.lazy` + `Suspense`. El
  bundle inicial pasó de un único archivo de ~2.204 kB a un núcleo de ~195 kB;
  los módulos pesados (tablas, gráficos, impresión) se cargan por ruta. El build
  dejó de advertir por chunks mayores a 500 kB.
- **Prueba**: `server/tests/performance-indexes.test.ts` verifica que los índices
  de `V026` existan con sus columnas en el orden correcto.
- **Compatibilidad**: no cambia contratos de API ni resultados de negocio; las
  pruebas funcionales existentes siguen cubriendo los mismos totales.
