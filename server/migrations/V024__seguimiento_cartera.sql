-- V024: seguimiento de alertas de cartera.
--
-- Las alertas (mora, próximos vencimientos y facturas sin fecha de vencimiento)
-- se calculan al vuelo desde la cartera derivada; no se guardan para evitar
-- duplicar saldos. Lo que sí se conserva es la gestión que hace el usuario de
-- cada alerta: recordatorio enviado, promesa de pago, escalamiento o cierre.
--
-- Reglas:
--   * Hay como máximo un seguimiento por factura (se actualiza, no se duplica).
--   * Nunca se borra: volver a "pendiente" limpia la gestión pero conserva el
--     registro y deja rastro en audit_log.
--   * Una promesa de pago exige una fecha de próximo contacto.
--   * El seguimiento no modifica la factura, los pagos ni la contabilidad.

CREATE TABLE IF NOT EXISTS receivable_followups (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id       INT UNSIGNED NOT NULL,
  estado           ENUM('pendiente', 'recordado', 'promesa', 'escalado', 'resuelto')
                     NOT NULL DEFAULT 'pendiente',
  nota             VARCHAR(500) NULL,
  proximo_contacto DATE NULL,
  created_by       INT UNSIGNED NOT NULL,
  updated_by       INT UNSIGNED NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_receivable_followups_invoice (invoice_id),
  INDEX idx_receivable_followups_estado (estado, proximo_contacto),

  CONSTRAINT fk_receivable_followups_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_receivable_followups_created_by
    FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_receivable_followups_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT chk_receivable_followups_promesa
    CHECK (estado <> 'promesa' OR proximo_contacto IS NOT NULL)
) ENGINE=InnoDB;
