-- Sesiones renovables y bloqueo temporal por intentos fallidos.
--
-- - `refresh_tokens` guarda solo el hash SHA-256 del token: si se filtra la base,
--   los valores no se pueden reutilizar. Cada rotación revoca el anterior.
-- - `failed_attempts` y `locked_until` viven en `users` para que el bloqueo
--   sobreviva a un reinicio del API.

ALTER TABLE users
  ADD COLUMN failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN locked_until DATETIME NULL;

CREATE TABLE refresh_tokens (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL,
  expires_at DATETIME     NOT NULL,
  revoked_at DATETIME     NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id),
  KEY idx_refresh_expira (expires_at),
  CONSTRAINT fk_refresh_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
