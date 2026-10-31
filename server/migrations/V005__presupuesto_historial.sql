CREATE TABLE quote_status_history (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quote_id        INT UNSIGNED NOT NULL,
  estado_anterior ENUM('borrador', 'enviado', 'aprobado', 'rechazado', 'entregado') NULL,
  estado_nuevo    ENUM('borrador', 'enviado', 'aprobado', 'rechazado', 'entregado') NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_quote_history_quote (quote_id, created_at),
  CONSTRAINT fk_quote_history_quote
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_history_user
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
