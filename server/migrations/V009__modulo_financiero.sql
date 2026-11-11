-- V009: módulo financiero
-- Presupuestos por periodo, líneas planeadas y transacciones reales.

CREATE TABLE budgets (
  id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(150)  NOT NULL,
  tipo_periodo ENUM('dia', 'semana', 'mes', 'anio') NOT NULL,
  fecha_inicio DATE          NOT NULL,
  fecha_fin    DATE          NOT NULL,
  ingreso_meta DECIMAL(18,2) NOT NULL DEFAULT 0,
  alerta_pct   DECIMAL(5,2)  NOT NULL DEFAULT 80,
  estado       ENUM('borrador', 'activo', 'cerrado') NOT NULL DEFAULT 'borrador',
  created_by   INT UNSIGNED  NOT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  -- RN-03: solo puede existir un presupuesto activo por periodo.
  -- Las filas no activas dejan la clave en NULL y no colisionan.
  activo_key   VARCHAR(64) GENERATED ALWAYS AS (
    CASE
      WHEN estado = 'activo'
      THEN CONCAT(tipo_periodo, ':', fecha_inicio, ':', fecha_fin)
      ELSE NULL
    END
  ) VIRTUAL,
  UNIQUE KEY uq_budgets_activo (activo_key),
  INDEX idx_budgets_periodo (tipo_periodo, fecha_inicio, fecha_fin),
  INDEX idx_budgets_estado (estado),
  CONSTRAINT fk_budgets_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_budgets_fechas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT chk_budgets_meta CHECK (ingreso_meta >= 0),
  CONSTRAINT chk_budgets_alerta CHECK (alerta_pct > 0 AND alerta_pct <= 100)
) ENGINE=InnoDB;

CREATE TABLE budget_lines (
  id                  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  budget_id           INT UNSIGNED  NOT NULL,
  finance_category_id INT UNSIGNED  NOT NULL,
  product_id          INT UNSIGNED  NULL,
  monto_planeado      DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- COALESCE evita que product_id NULL permita duplicados:
  -- una línea por categoría y, opcionalmente, por producto.
  product_key         INT UNSIGNED GENERATED ALWAYS AS (COALESCE(product_id, 0)) VIRTUAL,
  UNIQUE KEY uq_budget_lines (budget_id, finance_category_id, product_key),
  INDEX idx_budget_lines_category (finance_category_id),
  INDEX idx_budget_lines_product (product_id),
  CONSTRAINT fk_budget_lines_budget
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_lines_category
    FOREIGN KEY (finance_category_id) REFERENCES finance_categories(id),
  CONSTRAINT fk_budget_lines_product
    FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_budget_lines_monto CHECK (monto_planeado >= 0)
) ENGINE=InnoDB;

CREATE TABLE transactions (
  id                  INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  tipo                ENUM('ingreso', 'gasto') NOT NULL,
  monto               DECIMAL(18,2) NOT NULL,
  fecha               DATE          NOT NULL,
  finance_category_id INT UNSIGNED  NOT NULL,
  account_id          INT UNSIGNED  NOT NULL,
  product_id          INT UNSIGNED  NULL,
  quote_id            INT UNSIGNED  NULL,
  stock_movement_id   INT UNSIGNED  NULL,
  descripcion         VARCHAR(255)  NULL,
  anulada_de          INT UNSIGNED  NULL,
  created_by          INT UNSIGNED  NOT NULL,
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_transactions_fecha (fecha),
  INDEX idx_transactions_tipo_fecha (tipo, fecha),
  INDEX idx_transactions_category (finance_category_id, fecha),
  INDEX idx_transactions_account (account_id, fecha),
  INDEX idx_transactions_product (product_id, fecha),

  -- Idempotencia de los asientos automáticos:
  -- una cotización genera como máximo un ingreso y un costo de ventas.
  UNIQUE KEY uq_transactions_quote_tipo (quote_id, tipo),
  -- una entrada de stock genera como máximo un egreso.
  UNIQUE KEY uq_transactions_movement (stock_movement_id),
  -- una transacción solo puede anularse una vez.
  UNIQUE KEY uq_transactions_anulada (anulada_de),

  CONSTRAINT fk_transactions_category
    FOREIGN KEY (finance_category_id) REFERENCES finance_categories(id),
  CONSTRAINT fk_transactions_account
    FOREIGN KEY (account_id) REFERENCES finance_accounts(id),
  CONSTRAINT fk_transactions_product
    FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_transactions_quote
    FOREIGN KEY (quote_id) REFERENCES quotes(id),
  CONSTRAINT fk_transactions_movement
    FOREIGN KEY (stock_movement_id) REFERENCES stock_movements(id),
  CONSTRAINT fk_transactions_anulada
    FOREIGN KEY (anulada_de) REFERENCES transactions(id),
  CONSTRAINT fk_transactions_user
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_transactions_monto CHECK (monto > 0)
) ENGINE=InnoDB;
