-- V031: datos fiscales de la factura (Art. 617 del Estatuto Tributario).
--
-- La factura ya guardaba contraparte y documento, pero no la hora de
-- expedición, la resolución autorizada, el tipo de documento del adquirente,
-- el medio de pago ni una descripción propia por línea. Tampoco discriminaba
-- INC ni otros tributos: `impuesto_total` seguía siendo solo IVA.
--
-- Reglas:
--   * Los datos nuevos son un snapshot por documento: cambiar la empresa o la
--     resolución no reescribe facturas ya emitidas.
--   * `prefijo` también entra en la serie del contador, para que cada resolución
--     tenga su propio consecutivo sin romper las FAC/COM históricas.
--   * Las facturas antiguas reciben valores de referencia para poder
--     reimprimirse; la interfaz exige capturar los datos reales en las nuevas.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS hora_expedicion TIME NULL AFTER fecha,
  ADD COLUMN IF NOT EXISTS tipo_documento_adquirente
    ENUM('NIT', 'CC', 'CE', 'PASAPORTE', 'OTRO') NULL AFTER documento,
  ADD COLUMN IF NOT EXISTS prefijo VARCHAR(10) NULL AFTER numero,
  ADD COLUMN IF NOT EXISTS resolucion_numero VARCHAR(40) NULL AFTER prefijo,
  ADD COLUMN IF NOT EXISTS resolucion_fecha DATE NULL AFTER resolucion_numero,
  ADD COLUMN IF NOT EXISTS rango_desde INT UNSIGNED NULL AFTER resolucion_fecha,
  ADD COLUMN IF NOT EXISTS rango_hasta INT UNSIGNED NULL AFTER rango_desde,
  ADD COLUMN IF NOT EXISTS medio_pago
    ENUM('efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro') NULL AFTER condicion_pago,
  ADD COLUMN IF NOT EXISTS inc_total DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER impuesto_total,
  ADD COLUMN IF NOT EXISTS otros_impuestos_total DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER inc_total;

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS descripcion VARCHAR(300) NULL AFTER product_id,
  ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(20) NOT NULL DEFAULT 'UND' AFTER descripcion,
  ADD COLUMN IF NOT EXISTS base_imponible DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER precio_unitario,
  ADD COLUMN IF NOT EXISTS inc_pct DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER impuesto_pct,
  ADD COLUMN IF NOT EXISTS otro_impuesto_nombre VARCHAR(60) NULL AFTER inc_pct,
  ADD COLUMN IF NOT EXISTS otro_impuesto_pct DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER otro_impuesto_nombre,
  ADD COLUMN IF NOT EXISTS impuesto_valor DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER total_linea;

ALTER TABLE invoice_counters
  ADD COLUMN IF NOT EXISTS prefijo VARCHAR(10) NOT NULL DEFAULT '' AFTER tipo;

-- Los contadores existentes conservan su serie histórica antes de cambiar la llave.
UPDATE invoice_counters
SET prefijo = CASE tipo WHEN 'venta' THEN 'FAC' ELSE 'COM' END
WHERE prefijo = '';

ALTER TABLE invoice_counters
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (tipo, prefijo);

-- Backfill de facturas e ítems anteriores a V031.
UPDATE invoices
SET hora_expedicion = '12:00:00',
    tipo_documento_adquirente = 'NIT',
    prefijo = CASE tipo WHEN 'venta' THEN 'FAC' ELSE 'COM' END,
    resolucion_numero = 'RES-0001',
    resolucion_fecha = fecha,
    rango_desde = 1,
    rango_hasta = 9999,
    medio_pago = 'efectivo'
WHERE hora_expedicion IS NULL;

UPDATE invoice_items ii
JOIN products p ON p.id = ii.product_id
SET ii.descripcion = p.nombre
WHERE ii.descripcion IS NULL OR ii.descripcion = '';

UPDATE invoice_items
SET base_imponible = ROUND(cantidad * precio_unitario * (1 - descuento_pct / 100), 2),
    impuesto_valor = ROUND(total_linea - (cantidad * precio_unitario * (1 - descuento_pct / 100)), 2)
WHERE base_imponible = 0;

CREATE INDEX IF NOT EXISTS idx_invoices_prefijo ON invoices(prefijo, numero);
