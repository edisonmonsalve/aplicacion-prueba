-- V025: cierre de ejercicio.
--
-- Un cierre de ejercicio es un cierre de periodo especial que cubre del 1 de
-- enero al 31 de diciembre de un año. Reutiliza `period_closures` para conservar
-- el bloqueo de asientos, el snapshot inmutable y la reapertura auditada.
--
-- Reglas:
--   * `tipo = 'ejercicio'` y `anio` identifican el cierre anual.
--   * Los cierres existentes quedan como `tipo = 'periodo'` y `anio = NULL`.
--   * Un año puede cerrarse, reabrirse y volver a cerrarse: cada intento es una
--     fila nueva, nunca se sobrescribe la anterior.
--   * El cierre anual no genera asientos: congela el resultado y el balance en
--     el snapshot; el patrimonio del balance se sigue derivando.

ALTER TABLE period_closures
  ADD COLUMN IF NOT EXISTS tipo ENUM('periodo', 'ejercicio') NOT NULL DEFAULT 'periodo' AFTER nombre,
  ADD COLUMN IF NOT EXISTS anio SMALLINT UNSIGNED NULL AFTER tipo;

CREATE INDEX IF NOT EXISTS idx_period_closures_tipo_anio
  ON period_closures (tipo, anio, estado);
