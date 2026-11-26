# Mejoras — tablero

> Vista de una página. El detalle está en el [checklist](CHECKLIST-MEJORAS.md).

- **Actualizado:** 2026-11-26
- **Base:** `main` (`88e28d8`) · funcionalidad en merge #34 (`b64d260`)

## Progreso

**4 de 26 cerradas (15 %).** Quedan 22 pendientes.

| Fase | Hechas / total | Avance |
| --- | :---: | :---: |
| Base entregada | 4 / 4 | 100 % |
| A · Orden y quick wins | 0 / 7 | 0 % |
| B · Inventario y automatización | 0 / 3 | 0 % |
| C · Comunicaciones y estabilidad | 0 / 6 | 0 % |
| D · Condicionados | 0 / 6 | 0 % |
| **Total** | **4 / 26** | **15 %** |

> Estado: **P** Pendiente · **E** En curso · **B** Bloqueado · **H** Hecho.
> Esfuerzo: **S** < 3 días · **M** 3–10 días · **L** 2–4 semanas · **XL** > 4 semanas.

## Próxima semana

| ID | Tarea | Próximo paso | Bloqueo |
| --- | --- | --- | --- |
| MEJ-001 | Dependency graph estricto | Habilitar el grafo en GitHub Settings | DEC-10 |
| MEJ-002 | Accesibilidad automatizada | Elegir 5 pantallas y fijar selectores | — |
| MEJ-004 | Aviso de stock in-app | Definir badge y resumen en el dashboard | — |
| MEJ-007 | Backups automáticos | Definir destino fuera del host y retención | — |
| MEJ-003 | Control de precios | Acordar umbral de variación y aprobador | DEC-03 |

## Todas las mejoras

Orden sugerido por fase, prioridad y dependencias. El ID es el identificador estable.

| # | ID | Mejora | Fase | Prio. | Esf. | Estado | Ref. |
| ---: | --- | --- | :---: | :---: | :---: | :---: | --- |
| 1 | MEJ-001 | Dependency graph estricto | A | Alta | S | P | DEC-10 |
| 2 | MEJ-002 | Accesibilidad automatizada | A | Alta | M | P | — |
| 3 | MEJ-004 | Notificaciones de stock in-app | A | Media | S | P | — |
| 4 | MEJ-007 | Backups automáticos y restauración | A | Alta | M | P | — |
| 5 | MEJ-003 | Control de precios de compra | A | Alta | L | P | DEC-03 |
| 6 | MEJ-005 | Visibilidad de API docs en producción | A | Media | S | P | DEC-08 |
| 7 | MEJ-006 | Usuario dedicado de MariaDB | A | Media | S | P | — |
| 8 | MEJ-008 | Promedio ponderado de inventario | B | Alta | L | P | DEC-01, DEC-02 |
| 9 | MEJ-009 | Importación XML de proveedores | B | Alta | L | P | DEC-04 |
| 10 | MEJ-010 | Pruebas de carga con k6 | B | Media | M | P | — |
| 11 | MEJ-011 | Envío por correo (no fiscal) | C | Media | M | P | DEC-05 |
| 12 | MEJ-012 | Regresión visual | C | Media | M | P | — |
| 13 | MEJ-014 | Cookie `HttpOnly` + CSRF | C | Media | M | P | — |
| 14 | MEJ-015 | Monitorización de errores | C | Media | M | P | DEC-09 |
| 15 | MEJ-016 | Rate limiting compartido | C | Baja | M | P | — |
| 16 | MEJ-013 | Correo entrante de facturas | C | Media | L | P | DEC-04 |
| 17 | MEJ-017 | API `/v1` | D | Media | L | P | DEC-06 |
| 18 | MEJ-020 | Vencimientos de producto/lotes | D | Baja | M | P | DEC-07 |
| 19 | MEJ-021 | Prometheus y trazas | D | Baja | M | P | — |
| 20 | MEJ-022 | Preview público por PR | D | Baja | L | P | — |
| 21 | MEJ-018 | OCR para PDF/físicas | D | Baja | L | P | — |
| 22 | MEJ-019 | Facturación electrónica DIAN vía PAC | D | Alta | XL | P | — |

## Decisiones que bloquean

| Prioridad | ID | Decisión | Bloquea |
| --- | --- | --- | --- |
| Alta | DEC-10 | ¿Se habilita Dependency graph? | MEJ-001 |
| Alta | DEC-03 | Umbral de variación y quién aprueba | MEJ-003 |
| Alta | DEC-01 | ¿Promedio reemplaza o convive con `products.costo`? | MEJ-008 |
| Alta | DEC-02 | ¿Se recalcula el histórico o se aplica desde la migración? | MEJ-008 |
| Media | DEC-04 | Volumen de compras y porcentaje en XML | MEJ-009, MEJ-013 |
| Media | DEC-05 | SMTP propio o proveedor transaccional | MEJ-011 |
| Media | DEC-06 | ¿Hay clientes externos para `/api/v1`? | MEJ-017 |
| Media | DEC-07 | ¿Existen productos perecederos? | MEJ-020 |
| Media | DEC-08 | ¿La documentación de API sigue pública? | MEJ-005 |
| Media | DEC-09 | Proveedor de errores y retención | MEJ-015 |

## Riesgos

| Riesgo | Afecta | Mitigación |
| --- | --- | --- |
| Cambio de cifras contables | MEJ-008 | Aprobación del contador y comparación antes/después |
| XML/PDF no confiables | MEJ-009, MEJ-013, MEJ-018 | Validación estricta y revisión humana |
| Regulación DIAN | MEJ-019 | PAC y ambiente de habilitación |
| Migración de tokens | MEJ-014 | Compatibilidad y E2E de login/logout/refresh |

## Enlaces

- [Checklist](CHECKLIST-MEJORAS.md)
- [Operación](../OPERACION.md)
- [Política de seguridad](../../SECURITY.md)
- [Contrato OpenAPI](../api/openapi.json)
- [CI](../../.github/workflows/ci.yml)
