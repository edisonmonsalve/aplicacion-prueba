-- V028: categoría para descuentos obtenidos en compras.
--
-- Cuando una compra tiene descuento, el inventario se valora al precio bruto de
-- compra (costo original) y el descuento se reconoce como un ingreso
-- "Descuentos obtenidos", que mejora la utilidad sin mover caja (la caja ya
-- sale por el neto). Así el descuento es favorable para el margen sin
-- distorsionar el costo de ventas ni el activo Inventario.

INSERT INTO finance_categories (nombre, codigo, tipo, afecta_caja, afecta_resultado)
VALUES ('Descuentos obtenidos', 'descuentos_obtenidos', 'ingreso', 0, 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  afecta_caja = VALUES(afecta_caja),
  afecta_resultado = VALUES(afecta_resultado);
