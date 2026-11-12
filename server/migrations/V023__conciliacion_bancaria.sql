-- V023: conciliación bancaria.
--
-- Una conciliación cruza el extracto del banco (líneas que informa la entidad)
-- contra los movimientos de caja registrados en el sistema para una cuenta y un
-- rango de fechas. No altera la contabilidad: es un control de consistencia.
--
-- Reglas:
--   * Cada línea del extracto tiene signo: positivo = entrada, negativo = salida.
--   * Una línea puede quedar pendiente, conciliada contra un asiento del sistema
--     o ignorada con una nota (por ejemplo, una comisión bancaria aún no
--     registrada).
--   * Una conciliación cerrada queda congelada; reabrirla exige motivo y deja
--     rastro en audit_log. Nunca se borra.
--   * Las líneas se pueden corregir o eliminar mientras la conciliación esté
--     abierta y la línea no esté conciliada.

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id             INT UNSIGNED NOT NULL,
  nombre                 VARCHAR(120) NOT NULL,
  fecha_inicio           DATE NOT NULL,
  fecha_fin              DATE NOT NULL,
  saldo_extracto_inicial DECIMAL(18,2) NOT NULL DEFAULT 0,
  saldo_extracto_final   DECIMAL(18,2) NOT NULL DEFAULT 0,
  estado                 ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  snapshot               JSON NULL,
  cerrada_by             INT UNSIGNED NULL,
  cerrada_at             TIMESTAMP NULL,
  reabierta_by           INT UNSIGNED NULL,
  reabierta_at           TIMESTAMP NULL,
  motivo_reapertura      VARCHAR(500) NULL,
  created_by             INT UNSIGNED NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_reconciliations_account (account_id, fecha_inicio, fecha_fin),
  INDEX idx_reconciliations_estado (estado),
  INDEX idx_reconciliations_fechas (fecha_inicio, fecha_fin),

  CONSTRAINT fk_reconciliations_account
    FOREIGN KEY (account_id) REFERENCES finance_accounts(id),
  CONSTRAINT fk_reconciliations_cerrada_by
    FOREIGN KEY (cerrada_by) REFERENCES users(id),
  CONSTRAINT fk_reconciliations_reabierta_by
    FOREIGN KEY (reabierta_by) REFERENCES users(id),
  CONSTRAINT fk_reconciliations_created_by
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_reconciliations_rango CHECK (fecha_inicio <= fecha_fin)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reconciliation_id INT UNSIGNED NOT NULL,
  fecha             DATE NOT NULL,
  descripcion       VARCHAR(255) NOT NULL,
  referencia        VARCHAR(100) NULL,
  monto             DECIMAL(18,2) NOT NULL,
  estado            ENUM('pendiente', 'conciliada', 'ignorada') NOT NULL DEFAULT 'pendiente',
  transaction_id    INT UNSIGNED NULL,
  nota              VARCHAR(500) NULL,
  conciliada_by     INT UNSIGNED NULL,
  conciliada_at     TIMESTAMP NULL,
  created_by        INT UNSIGNED NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_statement_lines_reconciliation (reconciliation_id, fecha),
  INDEX idx_statement_lines_estado (reconciliation_id, estado),
  INDEX idx_statement_lines_transaction (transaction_id),

  -- Un asiento del sistema no se puede conciliar dos veces en la misma
  -- conciliación. En MySQL/MariaDB los NULL no colisionan en un índice único.
  UNIQUE KEY uq_statement_lines_transaction (reconciliation_id, transaction_id),

  CONSTRAINT fk_statement_lines_reconciliation
    FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id),
  CONSTRAINT fk_statement_lines_transaction
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  CONSTRAINT fk_statement_lines_conciliada_by
    FOREIGN KEY (conciliada_by) REFERENCES users(id),
  CONSTRAINT fk_statement_lines_created_by
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_statement_lines_monto CHECK (monto <> 0),
  CONSTRAINT chk_statement_lines_conciliada
    CHECK (estado <> 'conciliada' OR transaction_id IS NOT NULL)
) ENGINE=InnoDB;
