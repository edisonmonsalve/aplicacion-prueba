-- V012: contabilidad con IVA, trazabilidad documental y presupuesto por categoría de producto
--
-- Decisiones aplicadas:
--  1. IVA opción B: ingreso/gasto neto + IVA por pagar (pasivo) / IVA descontable (activo).
--  2. Asientos de cabecera agrupados por factura, con vínculo invoice_id.
--  3. Costo histórico en salidas + precio de venta separado.
--  4. Ciclo documental: la cotización no genera contabilidad; la factura sí.
--  5. Orden de compra solo como referencia.
--  6. Retenciones informativas en la factura.
--  7. Precio de venta restringido por rol en movimientos.
--  8. Vínculo cotización -> factura para evitar doble reconocimiento.

-- 1. Ampliar la naturaleza de categorías y transacciones
ALTER TABLE finance_categories
  MODIFY COLUMN tipo ENUM('ingreso', 'gasto', 'activo', 'pasivo') NOT NULL;

ALTER TABLE transactions
  MODIFY COLUMN tipo ENUM('ingreso', 'gasto', 'activo', 'pasivo') NOT NULL;

-- 2. Categorías contables de IVA
INSERT INTO finance_categories (nombre, tipo) VALUES
  ('IVA por pagar', 'pasivo'),
  ('IVA descontable', 'activo')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- 3. Vínculo de transacciones con la factura
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS invoice_id INT UNSIGNED NULL AFTER quote_id,
  ADD CONSTRAINT fk_transactions_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id);

CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_id);

-- 4. Trazabilidad en movimientos de stock
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(18,2) NULL AFTER costo_unitario,
  ADD COLUMN IF NOT EXISTS invoice_id INT UNSIGNED NULL AFTER motivo,
  ADD COLUMN IF NOT EXISTS quote_id INT UNSIGNED NULL AFTER invoice_id,
  ADD CONSTRAINT fk_movements_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  ADD CONSTRAINT fk_movements_quote
    FOREIGN KEY (quote_id) REFERENCES quotes(id);

CREATE INDEX IF NOT EXISTS idx_movements_invoice ON stock_movements(invoice_id);
CREATE INDEX IF NOT EXISTS idx_movements_quote ON stock_movements(quote_id);

-- 5. Desglose tributario y referencias documentales de la factura
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS quote_id INT UNSIGNED NULL AFTER id,
  ADD COLUMN IF NOT EXISTS orden_compra VARCHAR(50) NULL AFTER documento,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER estado,
  ADD COLUMN IF NOT EXISTS descuento_total DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER subtotal,
  ADD COLUMN IF NOT EXISTS impuesto_total DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER descuento_total,
  ADD COLUMN IF NOT EXISTS retencion_fuente DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER total,
  ADD COLUMN IF NOT EXISTS retencion_iva DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER retencion_fuente,
  ADD COLUMN IF NOT EXISTS retencion_ica DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER retencion_iva,
  ADD COLUMN IF NOT EXISTS total_neto DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER retencion_ica,
  ADD CONSTRAINT fk_invoices_quote
    FOREIGN KEY (quote_id) REFERENCES quotes(id);

CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);

-- 6. Costo anterior por línea de factura (para revertir costo en compras)
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS costo_anterior DECIMAL(18,2) NULL AFTER precio_unitario;

-- 7. Presupuesto por categoría de producto
-- Primero se agregan las columnas y un índice de respaldo para la FK de
-- budget_id; luego se puede retirar la clave única anterior sin romperla.
ALTER TABLE budget_lines ADD COLUMN product_category_id INT UNSIGNED NULL AFTER product_id;
ALTER TABLE budget_lines ADD COLUMN scope_key VARCHAR(32) GENERATED ALWAYS AS (
  CASE
    WHEN product_id IS NOT NULL THEN CONCAT('P:', product_id)
    WHEN product_category_id IS NOT NULL THEN CONCAT('C:', product_category_id)
    ELSE 'ALL'
  END
) VIRTUAL;
ALTER TABLE budget_lines ADD INDEX idx_budget_lines_budget (budget_id);
ALTER TABLE budget_lines DROP INDEX uq_budget_lines;
ALTER TABLE budget_lines DROP COLUMN product_key;
ALTER TABLE budget_lines
  ADD UNIQUE KEY uq_budget_lines_scope (budget_id, finance_category_id, scope_key);
ALTER TABLE budget_lines
  ADD CONSTRAINT fk_budget_lines_product_category
    FOREIGN KEY (product_category_id) REFERENCES categories(id);

-- 8. Distribución analítica de asientos de cabecera por línea/producto
CREATE TABLE IF NOT EXISTS transaction_allocations (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  transaction_id  INT UNSIGNED  NOT NULL,
  invoice_item_id INT UNSIGNED  NULL,
  product_id      INT UNSIGNED  NULL,
  monto           DECIMAL(18,2) NOT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alloc_transaction (transaction_id),
  INDEX idx_alloc_invoice_item (invoice_item_id),
  INDEX idx_alloc_product (product_id),
  CONSTRAINT fk_alloc_transaction
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_invoice_item
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_product
    FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_alloc_monto CHECK (monto >= 0)
) ENGINE=InnoDB;
