-- V016: cuenta financiera (caja/banco) por factura.
--
-- Permite decidir, al registrar una compra o una venta, si el dinero sale o
-- entra por caja (efectivo) o por banco (transferencia). Si la factura no
-- define cuenta, los asientos automáticos usan la primera cuenta activa.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS account_id INT UNSIGNED NULL AFTER quote_id,
  ADD CONSTRAINT fk_invoices_account
    FOREIGN KEY (account_id) REFERENCES finance_accounts(id);

CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id);
