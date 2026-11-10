-- V013: prefijo documental de cotizaciones COT-
--
-- Las cotizaciones se mostraban como PRE-000001. El prefijo correcto es COT-.
-- Se actualizan también los motivos ya guardados en movimientos de stock para
-- que el histórico sea coherente con el nuevo número.

UPDATE stock_movements
SET motivo = REPLACE(motivo, 'Presupuesto PRE-', 'Presupuesto COT-')
WHERE motivo LIKE 'Presupuesto PRE-%';
