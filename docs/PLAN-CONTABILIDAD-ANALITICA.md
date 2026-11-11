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
- **`period_closures`** (fase de cierre): snapshot de totales por periodo,
  responsable, fecha y estado (`cerrado | reabierto`).

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
| C5 | Cierre de periodo formal con snapshot y reapertura auditada | Pendiente |

### Fase 2 — Informes y analítica

| ID | Mejora | Estado |
|---|---|---|
| R1 | Estado de resultados (P&L) por periodo y comparativo | Pendiente |
| R2 | Flujo de caja por cuenta y por mes | Pendiente |
| R3 | Balance simplificado (caja, inventario, cartera, impuestos) | Pendiente |
| A1 | Rentabilidad por producto, categoría y cliente | Pendiente |
| A2 | Rotación, días de inventario, stock muerto y ABC | Pendiente |
| A3 | Embudo de cotizaciones y tiempo de cierre | Pendiente |
| A4 | Tendencias mensuales y comparación de periodos | Pendiente |

### Fase 3 — Gobierno del dato

| ID | Mejora | Estado |
|---|---|---|
| G1 | Visor de auditoría (`audit_log`) | Pendiente |
| G2 | Panel de salud de datos (asientos huérfanos, stock negativo, sin costo) | Pendiente |
| G3 | Índices analíticos y pruebas de invariantes contables | Pendiente |

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
