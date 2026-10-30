-- Esquema inicial: Usuarios e Inventario (MariaDB)
CREATE DATABASE IF NOT EXISTS inventario
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inventario;

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  rol           ENUM('admin', 'operador') NOT NULL DEFAULT 'operador',
  activo        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_categories_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE products (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku          VARCHAR(50)   NOT NULL,
  nombre       VARCHAR(150)  NOT NULL,
  category_id  INT UNSIGNED  NOT NULL,
  precio       DECIMAL(12,2) NOT NULL,
  stock_actual INT           NOT NULL DEFAULT 0,
  stock_minimo INT           NOT NULL DEFAULT 0,
  activo       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_sku (sku),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT chk_products_precio CHECK (precio > 0),
  CONSTRAINT chk_products_stock CHECK (stock_actual >= 0 AND stock_minimo >= 0)
) ENGINE=InnoDB;

CREATE TABLE stock_movements (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  tipo       ENUM('entrada', 'salida') NOT NULL,
  cantidad   INT          NOT NULL,
  motivo     VARCHAR(255) NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_movements_product (product_id, created_at),
  CONSTRAINT fk_movements_product
    FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_movements_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_movements_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;