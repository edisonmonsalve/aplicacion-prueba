-- V020: cierre formal de periodos contables.
--
-- Un cierre congela una foto de los totales del rango (resultado, caja, IVA,
-- cartera, facturas y retenciones) y bloquea nuevos asientos dentro de él.
-- La reapertura no borra el cierre: lo marca como `reabierto`, guarda quién y
-- por qué, y vuelve a permitir movimientos. Todo queda en audit_log.

CREATE TABLE IF NOT EXISTS period_closures (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre            VARCHAR(120) NOT NULL,
  fecha_inicio      DATE NOT NULL,
  fecha_fin         DATE NOT NULL,
  estado            ENUM('cerrado', 'reabierto') NOT NULL DEFAULT 'cerrado',
  snapshot          JSON NOT NULL,
  cerrado_by        INT UNSIGNED NOT NULL,
  cerrado_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reabierto_by      INT UNSIGNED NULL,
  reabierto_at      TIMESTAMP NULL,
  motivo_reapertura VARCHAR(500) NULL,
  INDEX idx_period_closures_fechas (fecha_inicio, fecha_fin),
  INDEX idx_period_closures_estado (estado),
  CONSTRAINT fk_closures_cerrado_by
    FOREIGN KEY (cerrado_by) REFERENCES users(id),
  CONSTRAINT fk_closures_reabierto_by
    FOREIGN KEY (reabierto_by) REFERENCES users(id),
  CONSTRAINT chk_closures_rango CHECK (fecha_inicio <= fecha_fin)
) ENGINE=InnoDB;
