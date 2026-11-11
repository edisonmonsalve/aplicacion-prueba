-- V021: índices para los informes y paneles analíticos.
--
-- Las consultas de P&L, cartera, rentabilidad, rotación, embudo, tendencias y
-- salud de datos filtran por estado/tipo y rango de fechas. Estos índices
-- compuestos evitan escaneos completos cuando el volumen crece y son
-- idempotentes para poder reaplicar la migración sin duplicarlos.

-- Facturas: informes por tipo (venta/compra), estado y fecha.
CREATE INDEX IF NOT EXISTS idx_invoices_tipo_estado_fecha
  ON invoices (tipo, estado, fecha);

-- Ítems: join factura + producto para rentabilidad y rotación.
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_product
  ON invoice_items (invoice_id, product_id);

-- Pagos: conciliación por estado y fecha, además de la búsqueda por factura.
CREATE INDEX IF NOT EXISTS idx_payments_estado_fecha
  ON invoice_payments (estado, fecha);

-- Productos: salud de datos y listados de catálogo por activo y existencias.
CREATE INDEX IF NOT EXISTS idx_products_activo_stock
  ON products (activo, stock_actual);

-- Cierres: bloqueo de periodos y consulta de cierres vigentes por rango.
CREATE INDEX IF NOT EXISTS idx_period_closures_estado_fechas
  ON period_closures (estado, fecha_inicio, fecha_fin);
