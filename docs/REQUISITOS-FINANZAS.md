
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
