-- V019: cartera CxC/CxP y pagos/cobros parciales.
--
-- Una factura a crédito reconoce el ingreso/activo al confirmarse, pero el
-- dinero entra o sale cuando se registra un pago. Cada pago genera un asiento
-- de caja con la categoría de sistema `cobro_cartera` o `pago_cartera`, que
-- mueve caja pero no vuelve a afectar el resultado.
--
-- Los pagos no se borran: se anulan con una contrapartida contable y quedan
-- con estado `anulado` para conservar la trazabilidad.

CREATE TABLE IF NOT EXISTS invoice_payments (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id     INT UNSIGNED NOT NULL,
  fecha          DATE NOT NULL,
  monto          DECIMAL(18,2) NOT NULL,
  account_id     INT UNSIGNED NULL,
  metodo         ENUM('efectivo', 'transferencia', 'tarjeta', 'otro') NOT NULL DEFAULT 'transferencia',
  referencia     VARCHAR(100) NULL,
  notas          VARCHAR(500) NULL,
  transaction_id INT UNSIGNED NULL,
  estado         ENUM('valido', 'anulado') NOT NULL DEFAULT 'valido',
  anulada_at     TIMESTAMP NULL,
  anulada_by     INT UNSIGNED NULL,
  created_by     INT UNSIGNED NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payments_invoice (invoice_id, estado),
  INDEX idx_payments_fecha (fecha),
  CONSTRAINT fk_payments_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_payments_account
    FOREIGN KEY (account_id) REFERENCES finance_accounts(id),
  CONSTRAINT fk_payments_transaction
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  CONSTRAINT fk_payments_anulada_by
    FOREIGN KEY (anulada_by) REFERENCES users(id),
  CONSTRAINT fk_payments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_payments_monto CHECK (monto > 0)
) ENGINE=InnoDB;
