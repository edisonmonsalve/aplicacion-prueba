-- Fase 0: base financiera

ALTER TABLE products
  ADD COLUMN costo DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER precio;

ALTER TABLE stock_movements
  ADD COLUMN costo_unitario DECIMAL(18,2) NULL AFTER cantidad;

ALTER TABLE users
  MODIFY COLUMN rol ENUM('admin', 'contador', 'operador', 'consulta') NOT NULL DEFAULT 'operador';

CREATE TABLE finance_accounts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100)  NOT NULL,
  tipo          ENUM('caja', 'banco') NOT NULL DEFAULT 'caja',
  saldo_inicial DECIMAL(18,2) NOT NULL DEFAULT 0,
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_accounts_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE finance_categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  tipo       ENUM('ingreso', 'gasto') NOT NULL,
  activo     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_categories_nombre_tipo (nombre, tipo)
) ENGINE=InnoDB;

INSERT INTO finance_categories (nombre, tipo) VALUES
  ('Ventas', 'ingreso'),
  ('Otros ingresos', 'ingreso'),
  ('Compra de inventario', 'gasto'),
  ('Servicios', 'gasto'),
  ('Nómina', 'gasto'),
  ('Arriendo', 'gasto'),
  ('Impuestos', 'gasto'),
  ('Otros gastos', 'gasto');

INSERT INTO finance_accounts (nombre, tipo) VALUES ('Caja principal', 'caja');

CREATE TABLE audit_log (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NULL,
  entidad    VARCHAR(50)  NOT NULL,
  entidad_id INT UNSIGNED NOT NULL,
  accion     VARCHAR(30)  NOT NULL,
  antes      JSON NULL,
  despues    JSON NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entidad (entidad, entidad_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;