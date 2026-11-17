-- V030: prefijo por categoría y SKU correlativo.
--
-- Las categorías pasan a tener un código corto (BEB, CAM, ...) que sirve de
-- prefijo del SKU. Si una categoría ya existía se deriva de sus tres primeras
-- letras; el usuario puede cambiarlo después desde el formulario.
ALTER TABLE categories ADD COLUMN codigo VARCHAR(10) NULL AFTER nombre;

UPDATE categories
SET codigo = UPPER(LEFT(REGEXP_REPLACE(nombre, '[^A-Za-z0-9]', ''), 3))
WHERE codigo IS NULL OR codigo = '';

-- Nombre sin caracteres alfanuméricos: prefijo basado en el id (nunca vacío).
UPDATE categories SET codigo = CONCAT('C', id) WHERE codigo IS NULL OR codigo = '';

-- DEFAULT mantiene compatibilidad con inserciones directas que solo envían nombre.
ALTER TABLE categories MODIFY codigo VARCHAR(10) NOT NULL DEFAULT 'GEN';

-- @renumber-begin
-- Renumeración del catálogo existente. El mapa se calcula con ROW_NUMBER para
-- que cada prefijo tenga una serie propia y determinista (SKU-0001, SKU-0002...).
CREATE TEMPORARY TABLE tmp_sku_map (
  product_id INT UNSIGNED NOT NULL PRIMARY KEY,
  old_sku    VARCHAR(50)  NOT NULL,
  new_sku    VARCHAR(50)  NOT NULL,
  INDEX idx_tmp_sku_old (old_sku)
) ENGINE=MEMORY;

INSERT INTO tmp_sku_map (product_id, old_sku, new_sku)
SELECT p.id,
       p.sku,
       CONCAT(c.codigo, '-', LPAD(ROW_NUMBER() OVER (PARTITION BY c.codigo ORDER BY p.id), 4, '0'))
FROM products p
JOIN categories c ON c.id = p.category_id;

-- Auditoría de cotizaciones: las instantáneas guardan el SKU dentro de un JSON.
-- Se reconstruyen `items.old` e `items.new` usando el product_id ya presente en
-- cada línea, así el historial queda consistente sin perder el resto de cambios.
UPDATE quote_audit_log a
SET a.changes = JSON_SET(
  a.changes,
  '$.items.old',
  COALESCE((
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
      'product_id', it.product_id,
      'sku', COALESCE(m.new_sku, it.sku),
      'nombre', it.nombre,
      'cantidad', it.cantidad,
      'precio_unitario', it.precio_unitario,
      'descuento_pct', it.descuento_pct,
      'impuesto_pct', it.impuesto_pct,
      'total_linea', it.total_linea
    ))
    FROM JSON_TABLE(a.changes, '$.items.old[*]' COLUMNS (
      product_id INT PATH '$.product_id',
      sku VARCHAR(50) PATH '$.sku',
      nombre VARCHAR(150) PATH '$.nombre',
      cantidad DOUBLE PATH '$.cantidad',
      precio_unitario DOUBLE PATH '$.precio_unitario',
      descuento_pct DOUBLE PATH '$.descuento_pct',
      impuesto_pct DOUBLE PATH '$.impuesto_pct',
      total_linea DOUBLE PATH '$.total_linea'
    )) it
    LEFT JOIN tmp_sku_map m ON m.old_sku = it.sku
  ), JSON_EXTRACT(a.changes, '$.items.old')),
  '$.items.new',
  COALESCE((
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
      'product_id', it.product_id,
      'sku', COALESCE(m.new_sku, it.sku),
      'nombre', it.nombre,
      'cantidad', it.cantidad,
      'precio_unitario', it.precio_unitario,
      'descuento_pct', it.descuento_pct,
      'impuesto_pct', it.impuesto_pct,
      'total_linea', it.total_linea
    ))
    FROM JSON_TABLE(a.changes, '$.items.new[*]' COLUMNS (
      product_id INT PATH '$.product_id',
      sku VARCHAR(50) PATH '$.sku',
      nombre VARCHAR(150) PATH '$.nombre',
      cantidad DOUBLE PATH '$.cantidad',
      precio_unitario DOUBLE PATH '$.precio_unitario',
      descuento_pct DOUBLE PATH '$.descuento_pct',
      impuesto_pct DOUBLE PATH '$.impuesto_pct',
      total_linea DOUBLE PATH '$.total_linea'
    )) it
    LEFT JOIN tmp_sku_map m ON m.old_sku = it.sku
  ), JSON_EXTRACT(a.changes, '$.items.new'))
)
WHERE JSON_CONTAINS_PATH(a.changes, 'one', '$.items.old')
   OR JSON_CONTAINS_PATH(a.changes, 'one', '$.items.new');

-- Se liberan primero todos los SKU antiguos para que el índice UNIQUE nunca
-- choque con un SKU nuevo que casualmente coincida con otro antiguo.
UPDATE products p
JOIN tmp_sku_map m ON m.product_id = p.id
SET p.sku = CONCAT('__tmp_sku_', p.id);

UPDATE products p
JOIN tmp_sku_map m ON m.product_id = p.id
SET p.sku = m.new_sku;

-- Las líneas de cotización activas se identifican por product_id.
UPDATE quote_items qi
JOIN tmp_sku_map m ON m.product_id = qi.product_id
SET qi.sku = m.new_sku;

DROP TEMPORARY TABLE tmp_sku_map;
-- @renumber-end
