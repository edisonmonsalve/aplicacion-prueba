-- V027: vínculo de la cotización con el maestro de terceros.
--
-- La cotización conserva `customer_nombre`, `customer_documento` y
-- `customer_email` como snapshot histórico editable. `party_id` permite
-- reutilizar el cliente registrado en el formulario, filtrar la cartera y
-- analizar las ventas por tercero sin depender del texto libre.
--
-- La relación es opcional: las cotizaciones históricas y las escritas a mano
-- siguen funcionando con party_id NULL.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS party_id INT UNSIGNED NULL AFTER customer_email,
  ADD CONSTRAINT fk_quotes_party
    FOREIGN KEY (party_id) REFERENCES third_parties(id);

CREATE INDEX IF NOT EXISTS idx_quotes_party ON quotes(party_id);
