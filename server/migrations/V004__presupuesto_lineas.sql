CREATE TABLE quote_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quote_id        INT UNSIGNED  NOT NULL,
  product_id      INT UNSIGNED  NOT NULL,
  sku             VARCHAR(50)   NOT NULL,
  nombre          VARCHAR(150)  NOT NULL,
  cantidad        INT           NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  descuento_pct   DECIMAL(5,2)  NOT NULL DEFAULT 0,
  impuesto_pct    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  total_linea     DECIMAL(14,2) NOT NULL,
  UNIQUE KEY uq_quote_items_product (quote_id, product_id),
  CONSTRAINT fk_quote_items_quote
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_items_product
    FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_quote_items_cantidad CHECK (cantidad > 0),
  CONSTRAINT chk_quote_items_precio CHECK (precio_unitario > 0),
  CONSTRAINT chk_quote_items_pct CHECK (
    descuento_pct BETWEEN 0 AND 100 AND impuesto_pct BETWEEN 0 AND 100
  )
) ENGINE=InnoDB;
