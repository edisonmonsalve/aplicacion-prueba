# Checklist de mejoras

> Seguimiento por ID. Para ver el estado de un vistazo, usa el [tablero](README.md).

- **Actualizado:** 2026-11-26
- **Base:** `main` (`88e28d8`) · funcionalidad en merge #34 (`b64d260`)

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
| A · Orden | 7 | 0 | 7 | 0 % |
| B · Inventario | 3 | 0 | 3 | 0 % |
| C · Comunicaciones | 6 | 0 | 6 | 0 % |
| D · Condicionados | 6 | 0 | 6 | 0 % |
| **Total** | **26** | **4** | **22** | **15 %** |

## Base entregada

- [x] **BASE-01** · Sesión y autenticación: refresh tokens, bloqueo, política de contraseñas,
  auditoría · `16bb22d`
- [x] **BASE-02** · Operación: logs JSON, métricas, health y `migrate:status` · `16bb22d`
- [x] **BASE-03** · CI/CD: cobertura, E2E, gitleaks, dependency-review y smoke de producción ·
  `16bb22d`, `97dea4c`
- [x] **BASE-04** · Documentación y contrato OpenAPI · `16bb22d`

## Fase A · Orden

- [ ] **MEJ-001** · Dependency graph estricto · A/Alta/S · **P** · Próximo: habilitar el grafo en
  GitHub · Cierre: quitar `continue-on-error` · DEC-10 · Reg —
- [ ] **MEJ-002** · Accesibilidad automatizada · A/Alta/M · **P** · Próximo: fijar 5 pantallas y
  selectores · Cierre: axe sin violaciones graves en CI · Reg —
- [ ] **MEJ-004** · Aviso de stock in-app · A/Media/S · **P** · Próximo: ubicar badge y resumen ·
  Cierre: visible sin entrar a Productos · Reg —
- [ ] **MEJ-007** · Backups y restauración · A/Alta/M · **P** · Próximo: definir destino y
  retención · Cierre: restauración de prueba documentada · Reg —
- [ ] **MEJ-003** · Control de precios de compra · A/Alta/L · **P** · Próximo: acordar umbral y
  aprobador · Cierre: cambios auditados por factura · DEC-03 · Reg —
- [ ] **MEJ-005** · Visibilidad de API docs · A/Media/S · **P** · Próximo: decidir política ·
  Cierre: mismo comportamiento en local, Docker y CI · DEC-08 · Reg —
- [ ] **MEJ-006** · Usuario dedicado de MariaDB · A/Media/S · **P** · Próximo: definir permisos ·
  Cierre: arranca y migra sin `root` · Reg —

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
| DEC-03 | Umbral de variación y quién aprueba | MEJ-003 | Acordar porcentaje y rol |
| DEC-04 | Volumen de compras y porcentaje en XML | MEJ-009, MEJ-013 | Medir durante un mes |
| DEC-05 | SMTP propio o proveedor transaccional | MEJ-011 | Comparar costos y límites |
| DEC-06 | ¿Hay clientes externos para `/api/v1`? | MEJ-017 | Confirmar consumidores |
| DEC-07 | ¿Existen productos perecederos? | MEJ-020 | Revisar catálogo |
| DEC-08 | ¿La documentación de API sigue pública? | MEJ-005 | Definir política |
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

## Enlaces

- [Tablero](README.md)
- [Operación](../OPERACION.md)
- [Política de seguridad](../../SECURITY.md)
- [Contrato OpenAPI](../api/openapi.json)
- [CI](../../.github/workflows/ci.yml)
