-- V029: datos de la empresa emisora configurables.
--
-- Hasta ahora la identidad que aparece en cotizaciones y facturas estaba fija
-- en el cliente (`client/src/config/company.ts`) y los documentos impresos
-- mostraban datos de ejemplo. Esta tabla guarda una única fila (id = 1) con los
-- datos reales de la empresa.
--
-- Reglas:
--   * Es una tabla singleton: solo existe la fila id = 1.
--   * El seed conserva los datos de ejemplo para que una instalación nueva
--     siga imprimiendo documentos coherentes hasta que el administrador los
--     reemplace desde «Empresa».
--   * Cada cambio queda auditado en `audit_log` (entidad `company_settings`).

CREATE TABLE IF NOT EXISTS company_settings (
  id               TINYINT UNSIGNED NOT NULL DEFAULT 1,
  nombre           VARCHAR(150) NOT NULL,
  eslogan          VARCHAR(150) NULL,
  nit              VARCHAR(40) NULL,
  regimen          VARCHAR(60) NULL,
  direccion        VARCHAR(200) NULL,
  telefono         VARCHAR(40) NULL,
  celular          VARCHAR(40) NULL,
  email            VARCHAR(120) NULL,
  web              VARCHAR(120) NULL,
  logo_url         VARCHAR(500) NULL,
  actualizado_por  INT UNSIGNED NULL,
  actualizado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO company_settings
  (id, nombre, eslogan, nit, regimen, direccion, telefono, celular, email, web)
VALUES
  (1, 'INVENTARIO S.A.S.', 'Gestión de inventario y finanzas', 'NIT 901.555.010-2',
   'Régimen común', 'Cra. 15 # 100-20, Bogotá D.C., Colombia', '+57 601 555 0123',
   '+57 310 555 0123', 'facturacion@inventario.co', 'www.inventario.co');
