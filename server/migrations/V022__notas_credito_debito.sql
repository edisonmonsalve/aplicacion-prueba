-- V022: notas crédito y débito sobre facturas confirmadas.
--
-- Una nota es un documento nuevo que corrige parcialmente una factura sin
-- anularla. No duplica saldos: la cartera resta las notas crédito y suma las
-- notas débito, y la contabilidad usa el mismo asiento con signo negativo para
-- las notas crédito. Así todos los informes que suman por categoría netean
-- solos (ventas, IVA, costo de ventas, inventario y retenciones).
--
-- Reglas:
--   * Solo se emiten sobre facturas confirmadas.
--   * No se borran: se anulan con contrapartidas contables y de stock.
--   * Una nota crédito devuelve stock por defecto; una débito no mueve stock
--     salvo que se indique explícitamente.
--   * Las notas crédito no pueden superar el total de la factura ni devolver
--     más cantidad que la facturada.

-- 1. Los asientos y sus distribuciones analíticas admiten signo. El cero sigue
--    prohibido para no crear movimientos vacíos.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_monto;
ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_monto CHECK (monto <> 0);

ALTER TABLE transaction_allocations DROP CONSTRAINT IF EXISTS chk_alloc_monto;
ALTER TABLE transaction_allocations
  ADD CONSTRAINT chk_alloc_monto
  CHECK (monto >= -9999999999999999.99 AND monto <= 9999999999999999.99);

-- 2. Consecutivo propio de notas: NC-0001 / ND-0001.
CREATE TABLE IF NOT EXISTS adjustment_counters (
  tipo        ENUM('credito', 'debito') PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT IGNORE INTO adjustment_counters (tipo, last_number)
VALUES ('credito', 0), ('debito', 0);

-- 3. Cabecera de la nota.
CREATE TABLE IF NOT EXISTS invoice_adjustments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id      INT UNSIGNED NOT NULL,
  tipo            ENUM('credito', 'debito') NOT NULL,
  numero          VARCHAR(20) NOT NULL,
  fecha           DATE NOT NULL,
  motivo          VARCHAR(500) NULL,
  subtotal        DECIMAL(14,2) NOT NULL DEFAULT 0,
  descuento_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  impuesto_total  DECIMAL(14,2) NOT NULL DEFAULT 0,
  retencion_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  total           DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_neto      DECIMAL(14,2) NOT NULL DEFAULT 0,
  afecta_stock    TINYINT(1) NOT NULL DEFAULT 0,
  estado          ENUM('confirmada', 'anulada') NOT NULL DEFAULT 'confirmada',
  anulada_at      TIMESTAMP NULL,
  anulada_by      INT UNSIGNED NULL,
  created_by      INT UNSIGNED NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_adjustments_numero (numero),
  INDEX idx_adjustments_invoice (invoice_id, estado),
  INDEX idx_adjustments_fecha (fecha),
  CONSTRAINT fk_adjustments_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_adjustments_anulada_by
    FOREIGN KEY (anulada_by) REFERENCES users(id),
  CONSTRAINT fk_adjustments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_adjustments_totales CHECK (total >= 0 AND total_neto >= 0)
) ENGINE=InnoDB;

-- 4. Líneas de la nota. Cada línea referencia la línea original de la factura
--    para poder validar cantidades y recuperar el costo histórico.
CREATE TABLE IF NOT EXISTS invoice_adjustment_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  adjustment_id   INT UNSIGNED NOT NULL,
  invoice_item_id INT UNSIGNED NOT NULL,
  product_id      INT UNSIGNED NOT NULL,
  cantidad        INT NOT NULL,
  precio_unitario DECIMAL(14,2) NOT NULL,
  descuento_pct   DECIMAL(5,2) NOT NULL DEFAULT 0,
  impuesto_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_linea     DECIMAL(14,2) NOT NULL,
  INDEX idx_adjustment_items_adjustment (adjustment_id),
  INDEX idx_adjustment_items_invoice_item (invoice_item_id),
  CONSTRAINT fk_adjustment_items_adjustment
    FOREIGN KEY (adjustment_id) REFERENCES invoice_adjustments(id) ON DELETE CASCADE,
  CONSTRAINT fk_adjustment_items_invoice_item
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id),
  CONSTRAINT fk_adjustment_items_product
    FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_adjustment_items_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

-- 5. Trazabilidad del asiento y del movimiento de stock hacia la nota.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS invoice_adjustment_id INT UNSIGNED NULL AFTER invoice_id,
  ADD CONSTRAINT fk_transactions_adjustment
    FOREIGN KEY (invoice_adjustment_id) REFERENCES invoice_adjustments(id);

CREATE INDEX IF NOT EXISTS idx_transactions_adjustment
  ON transactions(invoice_adjustment_id);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS invoice_adjustment_id INT UNSIGNED NULL AFTER invoice_id,
  ADD CONSTRAINT fk_movements_adjustment
    FOREIGN KEY (invoice_adjustment_id) REFERENCES invoice_adjustments(id);

CREATE INDEX IF NOT EXISTS idx_movements_adjustment
  ON stock_movements(invoice_adjustment_id);
