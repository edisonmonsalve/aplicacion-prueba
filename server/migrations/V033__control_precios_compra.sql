-- V033: control de precios de compra (MEJ-003).
--
-- El precio de compra se controla en su propio historial: `products.costo` es el
-- costo de referencia que solo edita el usuario y esta migración NO lo toca.
-- - `purchase_price_settings` es un singleton con el umbral de variación y si
--   hace falta adjunto. La configuración por defecto exige PDF/XML.
-- - `product_supplier_prices` guarda el último precio por producto y proveedor;
--   `product_supplier_price_history` conserva todos los precios confirmados.
-- - `purchase_price_approvals` gestiona las aprobaciones de admin/contador.
-- - `purchase_invoice_attachments` guarda los PDF/XML validados al subirlos.
-- - `purchase_invoice_index` detecta duplicados por proveedor + prefijo + número.
--
-- El backfill se deriva de facturas de compra confirmadas, sus líneas y los
-- movimientos de entrada de stock. Los registros históricos se marcan como
-- `backfill` y no alteran ninguna cifra contable ya existente.

CREATE TABLE IF NOT EXISTS purchase_price_settings (
  id               TINYINT UNSIGNED NOT NULL,
  umbral_pct       DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  requiere_adjunto TINYINT(1)   NOT NULL DEFAULT 1,
  updated_by       INT UNSIGNED NULL,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_purchase_price_settings_singleton CHECK (id = 1),
  CONSTRAINT chk_purchase_price_settings_umbral CHECK (umbral_pct >= 0 AND umbral_pct <= 100)
) ENGINE=InnoDB;

INSERT IGNORE INTO purchase_price_settings (id, umbral_pct, requiere_adjunto)
VALUES (1, 10.00, 1);

CREATE TABLE IF NOT EXISTS product_supplier_prices (
  product_id      INT UNSIGNED NOT NULL,
  supplier_key    VARCHAR(191) NOT NULL,
  precio_unitario DECIMAL(14,2) NOT NULL,
  invoice_id      INT UNSIGNED NULL,
  confirmed_at    DATETIME     NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, supplier_key),
  KEY idx_psp_supplier (supplier_key),
  CONSTRAINT fk_psp_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_supplier_price_history (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      INT UNSIGNED NOT NULL,
  supplier_key    VARCHAR(191) NOT NULL,
  precio_unitario DECIMAL(14,2) NOT NULL,
  precio_anterior DECIMAL(14,2) NULL,
  variacion_pct   DECIMAL(7,2)  NULL,
  invoice_id      INT UNSIGNED NULL,
  invoice_item_id INT UNSIGNED NULL,
  origen          ENUM('compra', 'backfill') NOT NULL DEFAULT 'compra',
  created_by      INT UNSIGNED NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_psph_product_supplier (product_id, supplier_key, id),
  KEY idx_psph_invoice (invoice_id),
  CONSTRAINT fk_psph_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_psph_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_price_approvals (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id     INT UNSIGNED NOT NULL,
  estado         ENUM('pendiente', 'aprobada', 'rechazada', 'invalida') NOT NULL DEFAULT 'pendiente',
  motivo         VARCHAR(500) NULL,
  solicitada_por INT UNSIGNED NOT NULL,
  revisada_por   INT UNSIGNED NULL,
  revisada_at    DATETIME     NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ppa_invoice (invoice_id, id),
  KEY idx_ppa_estado (estado),
  CONSTRAINT fk_ppa_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_invoice_attachments (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id       INT UNSIGNED NOT NULL,
  nombre           VARCHAR(200) NOT NULL,
  mime             VARCHAR(100) NOT NULL,
  tamano_bytes     INT UNSIGNED NOT NULL,
  contenido_base64 MEDIUMTEXT   NOT NULL,
  uploaded_by      INT UNSIGNED NOT NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pia_invoice (invoice_id, id),
  CONSTRAINT fk_pia_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_invoice_index (
  invoice_id    INT UNSIGNED PRIMARY KEY,
  supplier_key  VARCHAR(191) NOT NULL,
  prefijo       VARCHAR(10)  NOT NULL,
  numero        VARCHAR(20)  NOT NULL,
  total_neto    DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pii_proveedor_documento (supplier_key, prefijo, numero),
  KEY idx_pii_supplier (supplier_key),
  CONSTRAINT fk_pii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Backfill: el proveedor se toma del documento (NIT) si existe y, si no, del
-- nombre de la contraparte. La normalización coincide con `supplierKey` del
-- servidor: minúsculas, espacios colapsados y sin espacios de borde.
INSERT IGNORE INTO purchase_invoice_index (invoice_id, supplier_key, prefijo, numero, total_neto)
SELECT i.id,
       CASE
         WHEN NULLIF(TRIM(COALESCE(i.documento, '')), '') IS NOT NULL
           THEN CONCAT('doc:', LOWER(TRIM(REGEXP_REPLACE(i.documento, '[[:space:]]+', ' '))))
         ELSE CONCAT('nom:', LOWER(TRIM(REGEXP_REPLACE(COALESCE(i.contraparte, ''), '[[:space:]]+', ' '))))
       END,
       COALESCE(NULLIF(TRIM(i.prefijo), ''), 'COM'),
       i.numero,
       COALESCE(i.total_neto, i.total)
FROM invoices i
WHERE i.tipo = 'compra' AND i.estado = 'confirmada';

-- Precios históricos de las líneas de compra ya confirmadas.
INSERT INTO product_supplier_price_history
  (product_id, supplier_key, precio_unitario, precio_anterior, variacion_pct,
   invoice_id, invoice_item_id, origen, created_at)
SELECT ii.product_id, pii.supplier_key, ii.precio_unitario, NULL, NULL,
       i.id, ii.id, 'backfill', i.fecha
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
JOIN purchase_invoice_index pii ON pii.invoice_id = i.id
WHERE i.tipo = 'compra' AND i.estado = 'confirmada';

-- Entradas de stock por compra que no provienen de una factura: se conserva el
-- costo histórico del movimiento con una clave de proveedor no identificada.
INSERT INTO product_supplier_price_history
  (product_id, supplier_key, precio_unitario, precio_anterior, variacion_pct,
   invoice_id, invoice_item_id, origen, created_at)
SELECT sm.product_id, 'sin-proveedor', sm.costo_unitario, NULL, NULL,
       NULL, NULL, 'backfill', sm.created_at
FROM stock_movements sm
WHERE sm.origen = 'compra' AND sm.tipo = 'entrada' AND sm.invoice_id IS NULL
  AND sm.costo_unitario > 0;

-- Último precio por producto + proveedor: el registro más reciente del
-- historial (el id alto gana cuando hay varias líneas del mismo documento).
INSERT INTO product_supplier_prices
  (product_id, supplier_key, precio_unitario, invoice_id, confirmed_at)
SELECT h.product_id, h.supplier_key, h.precio_unitario, h.invoice_id, h.created_at
FROM product_supplier_price_history h
WHERE h.id = (
  SELECT MAX(h2.id)
  FROM product_supplier_price_history h2
  WHERE h2.product_id = h.product_id AND h2.supplier_key = h.supplier_key
)
ON DUPLICATE KEY UPDATE
  precio_unitario = VALUES(precio_unitario),
  invoice_id = VALUES(invoice_id),
  confirmed_at = VALUES(confirmed_at);
