-- V014: distinguir asientos que mueven caja de los asientos informativos.
--
-- El costo de ventas es un asiento contable real (afecta utilidad, margen y
-- presupuesto), pero no representa una salida de dinero: la compra del
-- inventario ya afectó la caja. Para no depender del nombre de la categoría,
-- cada categoría financiera declara si mueve caja.
--
-- Regla de negocio:
--   afecta_caja = 1 -> ingresos/gastos que entran o salen de caja o bancos.
--   afecta_caja = 0 -> asientos informativos (costo de ventas, IVA, etc.).

ALTER TABLE finance_categories
  ADD COLUMN IF NOT EXISTS afecta_caja TINYINT(1) NOT NULL DEFAULT 1 AFTER activo;

-- El IVA por pagar (pasivo) y el IVA descontable (activo) nunca son dinero
-- disponible. Se marcan explícitamente como informativos.
UPDATE finance_categories
SET afecta_caja = 0
WHERE tipo IN ('activo', 'pasivo');

-- El costo de ventas es el asiento informativo por excelencia: reduce la
-- utilidad y el margen, pero no vuelve a descontar capital de caja.
UPDATE finance_categories
SET afecta_caja = 0
WHERE nombre = 'Costo de ventas' AND tipo = 'gasto';
