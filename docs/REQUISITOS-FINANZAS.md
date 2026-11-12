
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

## Alertas de cartera

- **RF-ALR-1**: La cartera ofrece alertas priorizadas por factura abierta:
  mora crítica (>90 días), alta (31-90), media (1-30), vencimiento próximo
  (hoy o en 7 días) y factura sin fecha de vencimiento (media).
- **RF-ALR-2**: Cada alerta indica severidad, regla, cliente, factura,
  vencimiento, días de mora, saldo, acción sugerida y seguimiento. El reporte
  incluye resumen por severidad, montos vencido y por vencer, clientes afectados,
  alertas sin gestionar, contactos vencidos y promesas.
- **RF-ALR-3**: El seguimiento de una alerta admite los estados `pendiente`,
  `recordado`, `promesa`, `escalado` y `resuelto`, con nota y fecha de próximo
  contacto. Una promesa exige fecha. Es único por factura y se actualiza sin
  duplicarse.
- **RF-ALR-4**: Cada alta o cambio de seguimiento queda en `audit_log` con la
  entidad `receivable_followup` y el id de la factura. El historial no se borra.
- **RF-ALR-5**: Se puede filtrar por tipo (venta/compra), severidad, texto y
  `incluir_resueltos`. Las alertas resueltas se ocultan por defecto. El resumen
  conserva los totales globales al filtrar por severidad.
- **RN-31**: Las alertas se calculan desde la misma cartera derivada del aging;
  no duplican saldos ni crean asientos.
- **RN-32**: El seguimiento es gestión de cobro: no modifica facturas, pagos ni
  contabilidad, y solo se permite sobre facturas confirmadas a crédito con saldo.
- **RN-33**: Solo admin y contador pueden guardar seguimiento; consulta puede
  verlo. El endpoint de lectura exige rol financiero.
- Migración `V024` crea `receivable_followups` con unicidad por factura, índice
  por estado y próximo contacto, y la restricción de promesa con fecha.

## Cierre de ejercicio

- **RF-EJE-1**: Se puede cerrar un ejercicio completo, del 1 de enero al 31 de
  diciembre. Se admiten años entre 2000 y el año actual; un año futuro se rechaza.
- **RF-EJE-2**: Antes de cerrar, la vista previa muestra ingresos, costo de
  ventas, margen bruto, gastos, utilidad y utilidad porcentual del año, además del
  balance al 31 de diciembre y los meses cerrados incluidos. La vista previa no
  guarda nada.
- **RF-EJE-3**: El cierre guarda un snapshot inmutable con el resultado del
  ejercicio y el balance (activo, pasivo, patrimonio, caja, inventario, cartera e
  IVA). No genera asientos de cierre ni de apertura.
- **RF-EJE-4**: Mientras el ejercicio esté cerrado, no se pueden registrar
  transacciones con fecha dentro del año. Otros años siguen abiertos.
- **RF-EJE-5**: Un año no admite dos cierres vigentes. Tras reabrir el cierre con
  un motivo, el año puede volver a cerrarse; se conserva el historial y el cierre
  anterior queda como reabierto con usuario, fecha y motivo.
- **RF-EJE-6**: El cierre anual puede convivir con cierres mensuales. Los meses
  mantienen su estado: reabrir el ejercicio no reabre los meses ni sus bloqueos.
- **RF-EJE-7**: El cierre y la reapertura quedan en `audit_log` con la entidad
  `period_closure` y las acciones `cerrar_ejercicio` y `reabrir`, incluyendo el
  tipo y el año.
- **RF-EJE-8**: Solo admin y contador pueden cerrar o reabrir; consulta puede ver
  el listado y la vista previa; operador no accede a cierres.
- **RN-34**: El cierre de ejercicio se guarda en `period_closures` con
  `tipo = 'ejercicio'` y `anio`, reutilizando el bloqueo y la reapertura de los
  cierres de periodo.
- **RN-35**: El resultado y el balance se congelan en el snapshot; el patrimonio
  se sigue derivando de activo − pasivo y no se reescriben cuentas.
- **RN-36**: Cada recierre crea una fila nueva; nunca se sobrescribe ni se borra
  un cierre anterior.
- Migración `V025` añade `tipo` y `anio` a `period_closures` con el índice
  `(tipo, anio, estado)`. Los cierres existentes quedan como `periodo`.
