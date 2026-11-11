-- V018: maestro de terceros y condiciones de pago de la factura.
--
-- 1. `third_parties` centraliza clientes y proveedores. La factura conserva
--    `contraparte` y `documento` como snapshot histórico, pero se vincula al
--    tercero con `party_id` para cartera, analítica y reutilización.
-- 2. La factura declara su condición de pago:
--      contado -> el dinero se mueve al confirmar (comportamiento histórico).
--      credito -> se reconoce el ingreso/activo, pero la caja se mueve al
--                 registrar el cobro/pago (fase C2).
-- 3. `fecha_vencimiento` alimenta el aging y las alertas de cobro.

CREATE TABLE IF NOT EXISTS third_parties (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo           ENUM('cliente', 'proveedor', 'ambos') NOT NULL DEFAULT 'cliente',
  tipo_documento ENUM('NIT', 'CC', 'CE', 'PASAPORTE', 'OTRO') NOT NULL DEFAULT 'NIT',
  documento      VARCHAR(30)  NULL,
  nombre         VARCHAR(200) NOT NULL,
  email          VARCHAR(150) NULL,
  telefono       VARCHAR(50)  NULL,
  direccion      VARCHAR(250) NULL,
  ciudad         VARCHAR(100) NULL,
  condicion_pago ENUM('contado', 'credito') NOT NULL DEFAULT 'contado',
  dias_credito   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  notas          VARCHAR(1000) NULL,
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_third_parties_documento (documento),
  KEY idx_third_parties_nombre (nombre),
  KEY idx_third_parties_tipo (tipo, activo)
) ENGINE=InnoDB;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS party_id INT UNSIGNED NULL AFTER quote_id,
  ADD COLUMN IF NOT EXISTS condicion_pago ENUM('contado', 'credito') NOT NULL DEFAULT 'contado' AFTER party_id,
  ADD COLUMN IF NOT EXISTS dias_credito SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER condicion_pago,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE NULL AFTER dias_credito,
  ADD CONSTRAINT fk_invoices_party
    FOREIGN KEY (party_id) REFERENCES third_parties(id);

CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices(party_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vencimiento ON invoices(fecha_vencimiento);

-- Las facturas históricas se consideran de contado y vencen en su fecha.
UPDATE invoices
SET fecha_vencimiento = fecha
WHERE fecha_vencimiento IS NULL;
