-- V015: costo de inventario como activo y costo de venta como gasto.
--
-- Modelo contable correcto:
--   Compra de inventario -> sale dinero de caja, pero entra un ACTIVO
--     (Inventario). No reduce la utilidad en ese momento.
--   Venta -> el inventario sale del activo y se reconoce el GASTO
--     "Costo de ventas". Reduce la utilidad, pero no vuelve a mover caja.
--
-- Por eso la categoría "Compra de inventario" (gasto) se transforma en
-- "Inventario" (activo). Conserva su id para no romper presupuestos ni
-- transacciones históricas, y sigue afectando caja (salida de dinero).

UPDATE finance_categories
SET nombre = 'Inventario',
    tipo = 'activo',
    afecta_caja = 1
WHERE nombre = 'Compra de inventario' AND tipo = 'gasto';

-- Las compras históricas dejan de ser gasto y pasan a ser activo. También se
-- convierten sus contrapartidas de anulación para mantener la coherencia.
UPDATE transactions t
JOIN finance_categories fc ON fc.id = t.finance_category_id
SET t.tipo = 'activo'
WHERE fc.nombre = 'Inventario'
  AND fc.tipo = 'activo'
  AND t.tipo IN ('gasto', 'ingreso');
