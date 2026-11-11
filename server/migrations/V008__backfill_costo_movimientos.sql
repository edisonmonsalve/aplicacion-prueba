-- Rellena el costo de las entradas históricas registradas antes de V007.
-- No hay costo original guardado, así que se usa el costo actual del producto
-- como mejor aproximación. Las salidas se dejan en NULL a propósito.

UPDATE stock_movements m
JOIN products p ON p.id = m.product_id
SET m.costo_unitario = p.costo
WHERE m.tipo = 'entrada'
  AND m.costo_unitario IS NULL;
