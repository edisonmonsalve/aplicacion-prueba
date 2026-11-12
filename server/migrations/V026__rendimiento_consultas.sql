-- V026: índices y filtros para las consultas más pesadas.
--
-- La cartera, el DSO, el dashboard, la auditoría y el embudo filtran por
-- combinaciones que no tenían un índice con ese prefijo. Estos índices son
-- idempotentes para poder reaplicar la migración sin duplicarlos.
--
-- También se corrigen filtros posteriores en el código para comparar la
-- columna de fecha directamente (sin DATE(columna)), de modo que MariaDB pueda
-- usar el índice en lugar de recorrer toda la tabla.

-- Cartera: facturas confirmadas a crédito ordenadas por vencimiento.
CREATE INDEX IF NOT EXISTS idx_invoices_estado_condicion_vencimiento
  ON invoices (estado, condicion_pago, fecha_vencimiento);

-- DSO: ventas a crédito confirmadas dentro de un rango de fechas.
CREATE INDEX IF NOT EXISTS idx_invoices_tipo_estado_condicion_fecha
  ON invoices (tipo, estado, condicion_pago, fecha);

-- Dashboard de stock: movimientos por fecha de creación y tipo.
CREATE INDEX IF NOT EXISTS idx_movements_created_tipo
  ON stock_movements (created_at, tipo);

-- Auditoría: entidad y fecha para el listado paginado.
CREATE INDEX IF NOT EXISTS idx_audit_entidad_created
  ON audit_log (entidad, created_at);

-- Cotizaciones: listado y embudo por fecha de creación.
CREATE INDEX IF NOT EXISTS idx_quotes_created
  ON quotes (created_at);
