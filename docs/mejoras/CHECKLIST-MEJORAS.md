# Checklist de mejoras

> Seguimiento por ID. Para ver el estado de un vistazo, usa el [tablero](README.md).

- **Actualizado:** 2026-11-26
- **Base:** `main` (`aff2c96`) · funcionalidad en merge #34 (`b64d260`)

## Uso

1. Cambia `[ ]` por `[x]` al cerrar una mejora.
2. Actualiza **Estado**, **Responsable**, **Fecha** y **PR**.
3. Recalcula el resumen y el [tablero](README.md).

**Estado:** P Pendiente · E En curso · B Bloqueado · H Hecho.
**Esfuerzo:** S < 3 días · M 3–10 días · L 2–4 semanas · XL > 4 semanas.
**Fases:** A orden · B inventario · C comunicaciones · D condicionados.
**Registro (`Reg`):** responsable · fecha · PR.

## Resumen

| Fase | Total | Hechas | Pendientes | Avance |
| --- | ---: | ---: | ---: | ---: |
| Base entregada | 4 | 4 | 0 | 100 % |
| A · Orden | 7 | 6 | 1 | 86 % |
| B · Inventario | 3 | 0 | 3 | 0 % |
| C · Comunicaciones | 6 | 0 | 6 | 0 % |
| D · Condicionados | 6 | 0 | 6 | 0 % |
| **Total** | **26** | **10** | **16** | **38 %** |

## Base entregada

- [x] **BASE-01** · Sesión y autenticación: refresh tokens, bloqueo, política de contraseñas,
  auditoría · `16bb22d`
- [x] **BASE-02** · Operación: logs JSON, métricas, health y `migrate:status` · `16bb22d`
- [x] **BASE-03** · CI/CD: cobertura, E2E, gitleaks, dependency-review y smoke de producción ·
  `16bb22d`, `97dea4c`
- [x] **BASE-04** · Documentación y contrato OpenAPI · `16bb22d`

## Fase A · Orden

> Cierre técnico validado el 2026-11-26: builds y lint de servidor y cliente, 276 pruebas de
> servidor, 11 E2E (5 con axe) y `git diff --check`. Los cambios siguen en local, sin commit ni PR.

- [ ] **MEJ-001** · Dependency graph estricto · A/Alta/S · **P** · Próximo: habilitar el grafo en
  GitHub Settings y definir `DEPENDENCY_GRAPH_ENABLED=true` · Cierre: quitar `continue-on-error` ·
  DEC-10 · Reg —
- [x] **MEJ-002** · Accesibilidad automatizada · A/Alta/M · **H** · Próximo: mantener axe en la
  suite E2E de CI · Cierre: 5 pantallas sin violaciones; 11/11 E2E · Reg OpenCode · 2026-11-26 ·
  PR pendiente
- [x] **MEJ-004** · Aviso de stock in-app · A/Media/S · **H** · Próximo: vigilar el badge tras el
  despliegue · Cierre: badge global con `bajoStock=1&activo=1` y refresco al guardar · Reg OpenCode ·
  2026-11-26 · PR pendiente
- [x] **MEJ-007** · Backups y restauración · A/Alta/M · **H** · Próximo: programar copias en el host
  y probar una restauración trimestral · Cierre: scripts `backup:db`/`restore:db` y procedimiento en
  `docs/OPERACION.md` · Reg OpenCode · 2026-11-26 · PR pendiente
- [x] **MEJ-003** · Control de precios de compra · A/Alta/L · **H** · Próximo: sin pendientes ·
  Cierre: validación antes de confirmar, aprobación y adjuntos auditados por factura · DEC-03
  ratificado · Reg OpenCode · 2026-11-26 · PR pendiente
- [x] **MEJ-005** · Visibilidad de API docs · A/Media/S · **H** · Próximo: sin pendientes ·
  Cierre: `404` en producción salvo `API_DOCS_ENABLED=1`; verificado en tests, E2E y preview ·
  DEC-08 ratificado · Reg OpenCode · 2026-11-26 · PR pendiente
- [x] **MEJ-006** · Usuario dedicado de MariaDB · A/Media/S · **H** · Próximo: rotar la contraseña
  en cada despliegue · Cierre: API, CI y preview arrancan y migran con `DB_APP_USER` · Reg OpenCode ·
  2026-11-26 · PR pendiente

## Fase B · Inventario

- [ ] **MEJ-008** · Promedio ponderado · B/Alta/L · **P** · Próximo: decidir modelo de datos ·
  Cierre: inventario, COGS y margen usan el promedio · DEC-01, DEC-02 · Reg —
- [ ] **MEJ-009** · Importación XML de proveedores · B/Alta/L · **P** · Próximo: conseguir XML
  reales · Cierre: borrador revisado, sin doble digitación · DEC-04 · Reg —
- [ ] **MEJ-010** · Pruebas de carga con k6 · B/Media/M · **P** · Próximo: preparar base de
  staging · Cierre: script reproducible con umbrales · Reg —

## Fase C · Comunicaciones

- [ ] **MEJ-011** · Envío por correo (no fiscal) · C/Media/M · **P** · Próximo: elegir proveedor ·
  Cierre: envío auditado y sin etiqueta fiscal · DEC-05 · Reg —
- [ ] **MEJ-012** · Regresión visual · C/Media/M · **P** · Próximo: elegir pantallas estables ·
  Cierre: baselines sin ruido en CI · Reg —
- [ ] **MEJ-014** · Cookie `HttpOnly` + CSRF · C/Media/M · **P** · Próximo: diseñar compatibilidad ·
  Cierre: refresh ilegible por XSS; logout y rotación OK · Reg —
- [ ] **MEJ-015** · Monitorización de errores · C/Media/M · **P** · Próximo: elegir proveedor ·
  Cierre: evento correlacionable y alerta · DEC-09 · Reg —
- [ ] **MEJ-016** · Rate limiting compartido · C/Baja/M · **P** · Próximo: confirmar réplicas ·
  Cierre: límite compartido con fallback · Reg —
- [ ] **MEJ-013** · Correo entrante de facturas · C/Media/L · **P** · Próximo: crear buzón dedicado
  · Cierre: borrador revisable con adjuntos seguros · DEC-04 · Reg —

## Fase D · Condicionados

- [ ] **MEJ-017** · API `/v1` · D/Media/L · **P** · Próximo: confirmar clientes externos · Cierre:
  `/api` deprecado con ventana definida · DEC-06 · Reg —
- [ ] **MEJ-020** · Vencimientos de producto/lotes · D/Baja/M · **P** · Próximo: revisar catálogo ·
  Cierre: filtro y alerta por fecha · DEC-07 · Reg —
- [ ] **MEJ-021** · Prometheus y trazas · D/Baja/M · **P** · Próximo: confirmar necesidad · Cierre:
  series históricas tras reinicio · Reg —
- [ ] **MEJ-022** · Preview público por PR · D/Baja/L · **P** · Próximo: elegir hosting · Cierre:
  URL efímera con limpieza y secretos aislados · Reg —
- [ ] **MEJ-018** · OCR para PDF/físicas · D/Baja/L · **P** · Próximo: medir volumen sin XML ·
  Cierre: revisión humana obligatoria · Reg —
- [ ] **MEJ-019** · Facturación electrónica vía PAC · D/Alta/XL · **P** · Próximo: seleccionar PAC ·
  Cierre: factura transmitida en habilitación · Reg —

## Decisiones

| ID | Decisión | Bloquea | Próximo paso |
| --- | --- | --- | --- |
| DEC-01 | ¿Promedio reemplaza o convive con `products.costo`? | MEJ-008 | Definir modelo de datos |
| DEC-02 | ¿Se recalcula el histórico o se aplica desde la migración? | MEJ-008 | Validar con contabilidad |
| DEC-03 | Umbral de variación y quién aprueba | MEJ-003 | Ratificada el 2026-11-26: 10 %, admin/contador |
| DEC-04 | Volumen de compras y porcentaje en XML | MEJ-009, MEJ-013 | Medir durante un mes |
| DEC-05 | SMTP propio o proveedor transaccional | MEJ-011 | Comparar costos y límites |
| DEC-06 | ¿Hay clientes externos para `/api/v1`? | MEJ-017 | Confirmar consumidores |
| DEC-07 | ¿Existen productos perecederos? | MEJ-020 | Revisar catálogo |
| DEC-08 | ¿La documentación de API sigue pública? | MEJ-005 | Ratificado el 2026-11-26: `404` en producción |
| DEC-09 | Proveedor de errores y retención | MEJ-015 | Comparar opciones |
| DEC-10 | ¿Se habilita Dependency graph? | MEJ-001 | Gestionar Settings de GitHub |

## Riesgos

| Riesgo | Afecta | Mitigación |
| --- | --- | --- |
| Cambio de cifras contables | MEJ-008 | Aprobación del contador y comparación antes/después |
| XML/PDF no confiables | MEJ-009, MEJ-013, MEJ-018 | Validación estricta y revisión humana |
| Regulación DIAN | MEJ-019 | PAC y ambiente de habilitación |
| Migración de tokens | MEJ-014 | Compatibilidad y E2E |

## Registro de cambios

| Fecha | Cambio |
| --- | --- |
| 2026-11-26 | Creación del checklist y del tablero |
| 2026-11-26 | Resumen del formato; contenido funcional por ID |
| 2026-11-26 | Fase A en curso: badge de stock, axe E2E, docs flag, backups, usuario de DB y control de precios |
| 2026-11-26 | Fase A cerrada en local: 6 mejoras en **H**; DEC-03 y DEC-08 ratificados |

## Enlaces

- [Tablero](README.md)
- [Operación](../OPERACION.md)
- [Política de seguridad](../../SECURITY.md)
- [Contrato OpenAPI](../api/openapi.json)
- [CI](../../.github/workflows/ci.yml)
