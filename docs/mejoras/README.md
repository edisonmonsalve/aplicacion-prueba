# Mejoras — tablero

> Vista de una página. El detalle está en el [checklist](CHECKLIST-MEJORAS.md).

- **Actualizado:** 2026-11-26
- **Base:** `main` (`aff2c96`) · funcionalidad en merge #34 (`b64d260`)

## Progreso

**10 de 29 cerradas (34 %).** Quedan 19 pendientes.

| Fase | Hechas / total | Avance |
| --- | :---: | :---: |
| Base entregada | 4 / 4 | 100 % |
| A · Orden y quick wins | 6 / 7 | 86 % |
| B · Inventario y automatización | 0 / 3 | 0 % |
| C · Comunicaciones y estabilidad | 0 / 7 | 0 % |
| D · Condicionados | 0 / 8 | 0 % |
| **Total** | **10 / 29** | **34 %** |

> Estado: **P** Pendiente · **E** En curso · **B** Bloqueado · **H** Hecho.
> Esfuerzo: **S** < 3 días · **M** 3–10 días · **L** 2–4 semanas · **XL** > 4 semanas.

## Próxima semana

| ID | Tarea | Próximo paso | Bloqueo |
| --- | --- | --- | --- |
| MEJ-001 | Dependency graph estricto | Habilitar el grafo en GitHub Settings | DEC-10 |

> Fase A cerrada: 6 mejoras en **H**; DEC-03 y DEC-08 ratificados. PR **#53** desde
> `feat/fase-a-orden`, no desde `main`. El aviso de stock ya no estorba en el menú lateral: queda
> en el header. Ideas nuevas registradas: MEJ-023, MEJ-024 y MEJ-025.

## Todas las mejoras

Orden sugerido por fase, prioridad y dependencias. El ID es el identificador estable.

| # | ID | Mejora | Fase | Prio. | Esf. | Estado | Ref. |
| ---: | --- | --- | :---: | :---: | :---: | :---: | --- |
| 1 | MEJ-001 | Dependency graph estricto | A | Alta | S | P | DEC-10 |
| 2 | MEJ-002 | Accesibilidad automatizada | A | Alta | M | H | — |
| 3 | MEJ-004 | Notificaciones de stock in-app | A | Media | S | H | — |
| 4 | MEJ-007 | Backups automáticos y restauración | A | Alta | M | H | — |
| 5 | MEJ-003 | Control de precios de compra | A | Alta | L | H | DEC-03 |
| 6 | MEJ-005 | Visibilidad de API docs en producción | A | Media | S | H | DEC-08 |
| 7 | MEJ-006 | Usuario dedicado de MariaDB | A | Media | S | H | — |
| 8 | MEJ-008 | Promedio ponderado de inventario | B | Alta | L | P | DEC-01, DEC-02 |
| 9 | MEJ-009 | Importación XML de proveedores | B | Alta | L | P | DEC-04 |
| 10 | MEJ-010 | Pruebas de carga con k6 | B | Media | M | P | — |
| 11 | MEJ-011 | Envío por correo (no fiscal) | C | Media | M | P | DEC-05 |
| 12 | MEJ-012 | Regresión visual | C | Media | M | P | — |
| 13 | MEJ-014 | Cookie `HttpOnly` + CSRF | C | Media | M | P | — |
| 14 | MEJ-015 | Monitorización de errores | C | Media | M | P | DEC-09 |
| 15 | MEJ-016 | Rate limiting compartido | C | Baja | M | P | — |
| 16 | MEJ-013 | Correo entrante de facturas | C | Media | L | P | DEC-04 |
| 17 | MEJ-023 | Centro de notificaciones y acciones | C | Media | M | P | DEC-11 |
| 18 | MEJ-017 | API `/v1` | D | Media | L | P | DEC-06 |
| 19 | MEJ-020 | Vencimientos de producto/lotes | D | Baja | M | P | DEC-07 |
| 20 | MEJ-021 | Prometheus y trazas | D | Baja | M | P | — |
| 21 | MEJ-022 | Preview público por PR | D | Baja | L | P | — |
| 22 | MEJ-018 | OCR para PDF/físicas | D | Baja | L | P | — |
| 23 | MEJ-019 | Facturación electrónica DIAN vía PAC | D | Alta | XL | P | — |
| 24 | MEJ-024 | Asistente IA en la aplicación | D | Media | L | P | DEC-12 |
| 25 | MEJ-025 | Onboarding/welcome con chat IA | D | Baja | M | P | DEC-13 |

## Decisiones que bloquean

| Prioridad | ID | Decisión | Bloquea |
| --- | --- | --- | --- |
| Alta | DEC-10 | ¿Se habilita Dependency graph? | MEJ-001 |
| Alta | DEC-01 | ¿Promedio reemplaza o convive con `products.costo`? | MEJ-008 |
| Alta | DEC-02 | ¿Se recalcula el histórico o se aplica desde la migración? | MEJ-008 |
| Media | DEC-04 | Volumen de compras y porcentaje en XML | MEJ-009, MEJ-013 |
| Media | DEC-05 | SMTP propio o proveedor transaccional | MEJ-011 |
| Media | DEC-06 | ¿Hay clientes externos para `/api/v1`? | MEJ-017 |
| Media | DEC-07 | ¿Existen productos perecederos? | MEJ-020 |
| Media | DEC-09 | Proveedor de errores y retención | MEJ-015 |
| Media | DEC-11 | ¿Notificaciones en tiempo real y con acciones? | MEJ-023 |
| Media | DEC-12 | ¿Proveedor y privacidad para el asistente IA? | MEJ-024 |
| Baja | DEC-13 | ¿Alcance del chat en el onboarding? | MEJ-025 |

## Riesgos

| Riesgo | Afecta | Mitigación |
| --- | --- | --- |
| Cambio de cifras contables | MEJ-008 | Aprobación del contador y comparación antes/después |
| XML/PDF no confiables | MEJ-009, MEJ-013, MEJ-018 | Validación estricta y revisión humana |
| Regulación DIAN | MEJ-019 | PAC y ambiente de habilitación |
| Migración de tokens | MEJ-014 | Compatibilidad y E2E de login/logout/refresh |
| Ruido de notificaciones | MEJ-023 | Agrupación, preferencias y acciones concretas |
| Datos sensibles en IA | MEJ-024, MEJ-025 | Sin datos reales, consentimiento y proveedor evaluado |

## Enlaces

- [Checklist](CHECKLIST-MEJORAS.md)
- [Operación](../OPERACION.md)
- [Política de seguridad](../../SECURITY.md)
- [Contrato OpenAPI](../api/openapi.json)
- [CI](../../.github/workflows/ci.yml)
