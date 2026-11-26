# Mejoras — tablero

> Vista de una página para socializar y decidir. El detalle, los criterios de cierre, las
> dependencias y el registro de cambios están en el [checklist completo](CHECKLIST-MEJORAS.md).

- **Actualizado:** 2026-11-26
- **Base:** `main` (merge #34, `b64d260`)
- **Responsable general:** —

## Estado general

**4 de 26 ítems cerrados (15 %).** La base de seguridad, operación y CI ya está en `main`.
Quedan **22 mejoras pendientes**, ninguna en curso.

| Fase | Total | Hechas | Pendientes |
| --- | ---: | ---: | ---: |
| Base entregada | 4 | 4 | 0 |
| A · Orden y quick wins | 7 | 0 | 7 |
| B · Inventario y automatización | 3 | 0 | 3 |
| C · Comunicaciones y estabilidad | 6 | 0 | 6 |
| D · Condicionados | 6 | 0 | 6 |
| **Total** | **26** | **4** | **22** |

## Ahora (siguiente semana)

- [ ] **MEJ-001 · Dependency graph** — S · Habilitar el grafo en GitHub y quitar
  `continue-on-error` de `dependency-review`.
- [ ] **MEJ-002 · Accesibilidad** — M · axe en login, productos, factura, dashboard y finanzas.
- [ ] **MEJ-003 · Control de precios** — L · Último precio, variación, duplicados y aprobación.
- [ ] **MEJ-004 · Aviso de stock in-app** — S · Badge y resumen en el dashboard.
- [ ] **MEJ-007 · Backups automáticos** — M · Copia fuera del host y restauración de prueba.

## Todas las mejoras

| ID | Mejora | Fase | Prioridad | Esfuerzo | Estado |
| --- | --- | :---: | :---: | :---: | --- |
| MEJ-001 | Dependency graph estricto | A | Alta | S | Pendiente |
| MEJ-002 | Accesibilidad automatizada | A | Alta | M | Pendiente |
| MEJ-003 | Control de precios de compra | A | Alta | L | Pendiente |
| MEJ-004 | Notificaciones de stock in-app | A | Media | S | Pendiente |
| MEJ-005 | Visibilidad de API docs en producción | A | Media | S | Pendiente |
| MEJ-006 | Usuario dedicado de MariaDB | A | Media | S | Pendiente |
| MEJ-007 | Backups automáticos y restauración | A | Alta | M | Pendiente |
| MEJ-008 | Promedio ponderado de inventario | B | Alta | L | Pendiente |
| MEJ-009 | Importación XML de facturas de proveedor | B | Alta | L | Pendiente |
| MEJ-010 | Pruebas de carga con k6 | B | Media | M | Pendiente |
| MEJ-011 | Envío por correo (no fiscal) | C | Media | M | Pendiente |
| MEJ-012 | Regresión visual | C | Media | M | Pendiente |
| MEJ-013 | Correo entrante de facturas | C | Media | L | Pendiente |
| MEJ-014 | Cookie HttpOnly + CSRF | C | Media | M | Pendiente |
| MEJ-015 | Monitorización de errores | C | Media | M | Pendiente |
| MEJ-016 | Rate limiting compartido | C | Baja | M | Pendiente |
| MEJ-017 | API `/v1` | D | Media | L | Pendiente |
| MEJ-018 | OCR para PDF/físicas | D | Baja | L | Pendiente |
| MEJ-019 | Facturación electrónica DIAN vía PAC | D | Alta | XL | Pendiente |
| MEJ-020 | Vencimientos de producto/lotes | D | Baja | M | Pendiente |
| MEJ-021 | Prometheus y trazas | D | Baja | M | Pendiente |
| MEJ-022 | Preview público por PR | D | Baja | L | Pendiente |

## Decisiones que bloquean

| ID | Decisión | Bloquea |
| --- | --- | --- |
| DEC-01 | ¿El promedio reemplaza o convive con `products.costo`? | MEJ-008 |
| DEC-02 | ¿Se recalcula el histórico o se aplica desde la migración? | MEJ-008 |
| DEC-03 | Umbral de variación y quién aprueba | MEJ-003 |
| DEC-04 | Volumen de compras y porcentaje en XML | MEJ-009, MEJ-013 |
| DEC-05 | SMTP propio o proveedor transaccional | MEJ-011 |
| DEC-06 | ¿Hay clientes externos para `/api/v1`? | MEJ-017 |
| DEC-07 | ¿Existen productos perecederos? | MEJ-020 |
| DEC-08 | ¿La documentación de API sigue pública? | MEJ-005 |
| DEC-09 | Proveedor de errores y retención | MEJ-015 |
| DEC-10 | ¿Se habilita Dependency graph? | MEJ-001 |

> El detalle de cada decisión está en el [checklist completo](CHECKLIST-MEJORAS.md#decisiones-abiertas).

## Riesgos a vigilar

| Riesgo | Afecta | Mitigación |
| --- | --- | --- |
| Cambio de cifras contables | MEJ-008 | Aprobación del contador y comparación antes/después |
| XML/PDF no confiables | MEJ-009, MEJ-013, MEJ-018 | Validación estricta y revisión humana |
| Regulación DIAN cambiante | MEJ-019 | PAC y ambiente de habilitación |
| Pruebas visuales inestables | MEJ-012 | Datos fijos, máscaras y ejecución nightly |
| Migración de tokens a cookies | MEJ-014 | Ventana de compatibilidad y E2E |

## Enlaces

- [Checklist detallado](CHECKLIST-MEJORAS.md)
- [Operación](../OPERACION.md)
- [Política de seguridad](../../SECURITY.md)
- [Contrato OpenAPI](../api/openapi.json)
- [CI](../../.github/workflows/ci.yml)
