CREATE TABLE quotes (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_nombre    VARCHAR(150)  NOT NULL,
  customer_documento VARCHAR(50)   NULL,
  customer_email     VARCHAR(150)  NULL,
  estado             ENUM('borrador', 'enviado', 'aprobado', 'rechazado', 'entregado')
                     NOT NULL DEFAULT 'borrador',
  fecha_validez      DATE          NOT NULL,
  notas              TEXT          NULL,
  subtotal           DECIMAL(14,2) NOT NULL DEFAULT 0,
  descuento_total    DECIMAL(14,2) NOT NULL DEFAULT 0,
  impuesto_total     DECIMAL(14,2) NOT NULL DEFAULT 0,
  total              DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by         INT UNSIGNED  NOT NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_quotes_estado (estado, created_at),
  INDEX idx_quotes_creator (created_by),
  CONSTRAINT fk_quotes_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_quotes_totales CHECK (
    subtotal >= 0 AND descuento_total >= 0 AND impuesto_total >= 0 AND total >= 0
  )
) ENGINE=InnoDB;
