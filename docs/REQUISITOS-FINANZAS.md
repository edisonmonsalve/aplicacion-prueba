
## invoice_adjustments — notas crédito y débito

- Tablas `invoice_adjustments` (cabecera) e `invoice_adjustment_items` (líneas que referencian la línea original de la factura).
- `tipo`: credito | debito. `numero`: NC-0001 / ND-0001 con consecutivo propio.
- `total`, `subtotal`, `descuento_total`, `impuesto_total`, `retencion_total`, `total_neto`, `afecta_stock`, `estado` (confirmada | anulada).
- Solo se emiten sobre facturas confirmadas. No se borran: se anulan con contrapartida contable y de stock.
- Una nota crédito devuelve stock por defecto (entrada para ventas, salida para compras) y revierte el costo de ventas; una débito solo mueve stock si `afecta_stock = true`.
- Las notas crédito no pueden superar el total de la factura ni devolver más cantidad que la facturada; las débito no tienen tope.
- La cartera resta las notas crédito y suma las débito sobre `total_neto`. El saldo pendiente y el estado se derivan.
- La contabilidad usa el mismo asiento con signo negativo para las notas crédito (ventas, IVA por pagar, costo de ventas, retenciones a favor; inventario, IVA descontable y retenciones por pagar en compras), de modo que P&L, flujo, balance, rentabilidad y presupuestos netean automáticamente.
- Cada nota y su anulación quedan en `audit_log` con la entidad `invoice_adjustment`.
- Migración `V022` relaja `chk_transactions_monto` y `chk_alloc_monto` para admitir montos con signo (el cero sigue prohibido) y añade `invoice_adjustment_id` a `transactions` y `stock_movements`.

## Exportación de reportes (CSV y PDF)

- **RF-EXP-1**: Los reportes de resultados, flujo de caja, balance, cartera,
  tendencias, rentabilidad, rotación y embudo ofrecen un botón **Exportar** con
  las opciones CSV y PDF.
- **RF-EXP-2**: La exportación usa el rango de fechas y los filtros activos del
  reporte, no un rango por defecto.
- **RF-EXP-3**: El CSV incluye todas las secciones del reporte, con los valores
  numéricos sin formato monetario para que puedan sumarse en una hoja de cálculo.
  Usa `;` como separador y BOM UTF-8.
- **RF-EXP-4**: El PDF se genera como vista imprimible (título, periodo,
  metadatos, tablas y notas) y el usuario lo guarda como PDF desde el diálogo de
  impresión. No requiere dependencias adicionales en el cliente.
- **RF-EXP-5**: En cartera se exportan todas las facturas que cumplen el filtro,
  no solo la página visible, junto con el aging y los principales deudores.
- **RN-25**: La exportación es de solo lectura: no modifica datos ni estados, y
  no incluye información de terceros ajena a los filtros solicitados.

## Conciliación bancaria

- Tablas `bank_reconciliations` (cabecera) y `bank_statement_lines` (extracto).
- `bank_reconciliations`: `account_id`, `nombre`, `fecha_inicio`, `fecha_fin`,
  `saldo_extracto_inicial`, `saldo_extracto_final`, `estado` (abierta | cerrada),
  `snapshot`, datos de cierre y de reapertura (`motivo_reapertura`).
- `bank_statement_lines`: `fecha`, `descripcion`, `referencia`, `monto` con
  signo (positivo entrada, negativo salida), `estado` (pendiente | conciliada |
  ignorada), `transaction_id`, `nota` y datos de conciliación.
- **RF-CON-1**: Se puede crear una conciliación por cuenta y periodo, con saldos
  inicial y final del extracto. No se permiten dos conciliaciones abiertas
  superpuestas de la misma cuenta.
- **RF-CON-2**: Las líneas del extracto se agregan, editan y eliminan mientras la
  conciliación esté abierta y la línea no esté conciliada.
- **RF-CON-3**: El sistema sugiere cruces por cuenta, importe firmado exacto y
  tolerancia de fechas configurable. El cruce manual valida cuenta, importe,
  vigencia y que el asiento afecte caja; un asiento no se cruza dos veces.
- **RF-CON-4**: Una línea se puede ignorar con una nota obligatoria. Conciliar,
  desconciliar e ignorar quedan en `audit_log` con la entidad
  `bank_reconciliation`.
- **RF-CON-5**: El detalle muestra saldo del sistema, saldo del extracto,
  diferencia, avance, líneas pendientes y partidas conciliatorias (extracto sin
  sistema y sistema sin extracto).
- **RF-CON-6**: El cierre exige que todas las líneas estén resueltas y que el
  saldo final del extracto sea igual al inicial más sus líneas. Guarda un
  `snapshot` de los totales. La reapertura exige motivo y conserva el historial.
- **RN-30**: La conciliación no crea, modifica ni anula asientos contables; solo
  cruza información y deja evidencia. Las diferencias se resuelven con
  transacciones independientes.
- Migración `V023` crea ambas tablas con índices por cuenta, periodo, estado y
  transacción, y restricciones para impedir líneas en cero y líneas conciliadas
  sin asiento.
