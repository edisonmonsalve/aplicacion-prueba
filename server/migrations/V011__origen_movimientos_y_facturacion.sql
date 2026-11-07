-- V011: origen de movimientos + modulo de facturacion

-- 1. Origen en movimientos de stock
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS origen ENUM('compra','venta','entrega','merma','ajuste') NOT NULL DEFAULT 'ajuste'
  AFTER tipo;

-- 2. Contador consecutivo por tipo de factura
CREATE TABLE IF NOT EXISTS invoice_counters (
  tipo ENUM('venta','compra') PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);
INSERT IGNORE INTO invoice_counters (tipo, last_number) VALUES ('venta', 0), ('compra', 0);

-- 3. Cabecera de factura/pedido
CREATE TABLE IF NOT EXISTS invoices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('venta','compra') NOT NULL,
  numero VARCHAR(20) NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  contraparte VARCHAR(200) NOT NULL,
  documento VARCHAR(50) NULL,
  email VARCHAR(150) NULL,
  estado ENUM('borrador','confirmada','anulada') NOT NULL DEFAULT 'borrador',
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  notas TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_user FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 4. Lineas de factura
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(14,2) NOT NULL,
  descuento_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  impuesto_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_linea DECIMAL(14,2) NOT NULL,
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tipo_estado ON invoices(tipo, estado);
CREATE INDEX IF NOT EXISTS idx_invoices_fecha ON invoices(fecha);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);