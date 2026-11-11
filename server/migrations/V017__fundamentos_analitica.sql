-- V017: fundamentos de contabilidad analítica.
--
-- 1. Las categorías contables de sistema se identifican por `codigo` y no por
--    su nombre visible. Así un cambio de nombre no rompe los asientos
--    automáticos ni los informes.
-- 2. `afecta_resultado` separa el resultado (P&L) del movimiento de caja. Un
--    cobro de cartera mueve caja pero no vuelve a reconocer ingreso.
-- 3. `transactions.afecta_caja` permite que una misma categoría mueva caja o no
--    según la factura (contado vs. crédito). NULL = usa la categoría.
-- 4. Categorías nuevas para cartera y retenciones.

ALTER TABLE finance_categories
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(40) NULL AFTER nombre,
  ADD COLUMN IF NOT EXISTS afecta_resultado TINYINT(1) NOT NULL DEFAULT 1 AFTER afecta_caja;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_categories_codigo
  ON finance_categories (codigo);

-- Códigos de las categorías existentes. El nombre se conserva como etiqueta.
UPDATE finance_categories SET codigo = 'ventas'          WHERE nombre = 'Ventas' AND tipo = 'ingreso';
UPDATE finance_categories SET codigo = 'otros_ingresos'  WHERE nombre = 'Otros ingresos' AND tipo = 'ingreso';
UPDATE finance_categories SET codigo = 'inventario'      WHERE nombre = 'Inventario' AND tipo = 'activo';
UPDATE finance_categories SET codigo = 'servicios'       WHERE nombre = 'Servicios' AND tipo = 'gasto';
UPDATE finance_categories SET codigo = 'nomina'          WHERE nombre = 'Nómina' AND tipo = 'gasto';
UPDATE finance_categories SET codigo = 'arriendo'        WHERE nombre = 'Arriendo' AND tipo = 'gasto';
UPDATE finance_categories SET codigo = 'impuestos'       WHERE nombre = 'Impuestos' AND tipo = 'gasto';
UPDATE finance_categories SET codigo = 'otros_gastos'    WHERE nombre = 'Otros gastos' AND tipo = 'gasto';
UPDATE finance_categories SET codigo = 'costo_ventas'    WHERE nombre = 'Costo de ventas' AND tipo = 'gasto';
UPDATE finance_categories SET codigo = 'iva_por_pagar'   WHERE nombre = 'IVA por pagar' AND tipo = 'pasivo';
UPDATE finance_categories SET codigo = 'iva_descontable' WHERE nombre = 'IVA descontable' AND tipo = 'activo';

-- Categorías de cartera: mueven caja cuando se cobra/paga, pero no son
-- ingreso/gasto del periodo (el ingreso ya se reconoció en la factura).
INSERT INTO finance_categories (nombre, codigo, tipo, afecta_caja, afecta_resultado)
VALUES
  ('Cobro de cartera', 'cobro_cartera', 'ingreso', 1, 0),
  ('Pago de cartera', 'pago_cartera', 'gasto', 1, 0),
  ('Retenciones a favor', 'retenciones_a_favor', 'activo', 0, 0),
  ('Retenciones por pagar', 'retenciones_por_pagar', 'pasivo', 0, 0)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  afecta_caja = VALUES(afecta_caja),
  afecta_resultado = VALUES(afecta_resultado);

-- Los activos y pasivos no pasan por el estado de resultados.
UPDATE finance_categories
SET afecta_resultado = 0
WHERE tipo IN ('activo', 'pasivo');

-- El costo de ventas sí es resultado (reduce la utilidad), aunque no mueva caja.
UPDATE finance_categories
SET afecta_resultado = 1
WHERE codigo = 'costo_ventas';

-- Override por asiento: NULL significa "lo decide la categoría".
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS afecta_caja TINYINT(1) NULL AFTER monto;

CREATE INDEX IF NOT EXISTS idx_transactions_fecha_tipo ON transactions (fecha, tipo);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items (product_id);
