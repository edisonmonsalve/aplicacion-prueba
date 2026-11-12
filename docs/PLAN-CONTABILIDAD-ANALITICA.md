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
