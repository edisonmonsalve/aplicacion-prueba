-- Categoría financiera usada por el asiento automático de costo de ventas.
INSERT INTO finance_categories (nombre, tipo)
VALUES ('Costo de ventas', 'gasto')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
