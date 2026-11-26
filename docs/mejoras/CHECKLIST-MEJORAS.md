# Checklist detallado de mejoras

Documento vivo para socializar, priorizar y hacer seguimiento a las mejoras del sistema.
Cada mejora tiene un ID estable; para cerrarla, marca la casilla, actualiza el estado y añade
la fecha, el responsable y el enlace al commit o Pull Request.

> **Vista rápida:** [tablero de una página](README.md). Este documento conserva el detalle,
> los criterios de cierre, las dependencias y el registro de cambios.

- **Última actualización:** 2026-11-26
- **Base:** `main` (merge #34, `b64d260`)
- **Responsable general:** —

## Cómo usar este checklist

1. Cambia `- [ ]` por `- [x]` cuando la mejora esté cerrada.
2. Actualiza **Estado**, **Responsable** y **Fecha** en la ficha.
3. Añade una nota con el commit, PR o decisión.
4. Recalcula la tabla de resumen.
5. Si cambia el alcance, regístralo en «Decisiones abiertas» y en «Registro de cambios».

### Convenciones

| Campo | Valores |
| --- | --- |
| **Prioridad** | Alta, Media, Baja |
| **Esfuerzo** | S: menos de 3 días · M: 3–10 días · L: 2–4 semanas · XL: más de 4 semanas |
| **Estado** | Pendiente, En curso, Bloqueado, Hecho |
| **Fase** | A: orden y quick wins · B: inventario y automatización · C: comunicaciones y estabilidad · D: condicionados |

### Definición de terminado

Una mejora se considera cerrada cuando:

- El código y las migraciones están revisados y fusionados.
- Tiene pruebas unitarias y, si aplica, E2E.
- El CI está en verde y no hay regresiones visuales conocidas.
- La documentación afectada está actualizada.
- Los cambios de seguridad, datos o contabilidad tienen revisión explícita.
- Se registró el commit/PR en este checklist.

## Resumen

| Fase | Total | Hechas | En curso | Bloqueadas | Pendientes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Base entregada | 4 | 4 | 0 | 0 | 0 |
| A · Orden y quick wins | 7 | 0 | 0 | 0 | 7 |
| B · Inventario y automatización | 3 | 0 | 0 | 0 | 3 |
| C · Comunicaciones y estabilidad | 6 | 0 | 0 | 0 | 6 |
| D · Condicionados | 6 | 0 | 0 | 0 | 6 |
| **Total** | **26** | **4** | **0** | **0** | **22** |

## Base entregada

- [x] **BASE-01 · Seguridad de sesiones y autenticación**
  - Refresh tokens con rotación y detección de reutilización, bloqueo de cuenta, política de
    contraseñas, auditoría de accesos y revocación al cambiar contraseña.
  - Referencia: merge #34 (`16bb22d`).
- [x] **BASE-02 · Operación y observabilidad**
  - Logs JSON con `X-Request-Id`, `/api/metrics` solo admin, health con latencia, cierre ordenado
    y `migrate:status`.
  - Referencia: merge #34 (`16bb22d`).
- [x] **BASE-03 · CI/CD e infraestructura**
  - Cobertura con umbrales, artefactos de Playwright, gitleaks, dependency-review, smoke de la
    pila de producción, contenedores no-root y Nginx.
  - Referencia: merge #34 (`16bb22d`, `97dea4c`).
- [x] **BASE-04 · Documentación y contrato**
  - `SECURITY.md`, `docs/OPERACION.md`, README, manual de usuario y OpenAPI regenerado.
  - Referencia: merge #34 (`16bb22d`).

---

## Fase A · Orden y quick wins

- [ ] **MEJ-001 · Habilitar Dependency graph y endurecer dependency-review**
  - **Prioridad:** Alta · **Esfuerzo:** S · **Estado:** Pendiente · **Responsable:** —
  - **Dependencia:** acceso de administrador a GitHub.
  - **Criterio de cierre:** el grafo de dependencias está habilitado, se elimina
    `continue-on-error` de `.github/workflows/ci.yml` y una dependencia de severidad alta o
    crítica vuelve a romper el PR.
  - **Enlace:** Settings → Security analysis del repositorio.
  - **Notas:** —

- [ ] **MEJ-002 · Pruebas de accesibilidad automatizadas**
  - **Prioridad:** Alta · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** login, productos, formulario de factura, dashboard y finanzas con
    `@axe-core/playwright`.
  - **Criterio de cierre:** pruebas en CI, sin violaciones graves/críticas en las pantallas
    acordadas, navegación por teclado verificada y hallazgos corregidos o documentados.
  - **Dependencia:** selectores estables en las páginas.
  - **Notas:** —

- [ ] **MEJ-003 · Control de precios de compra (Fase 1)**
  - **Prioridad:** Alta · **Esfuerzo:** L · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** último precio por producto/proveedor, precio promedio, variación porcentual,
    historial, detección de factura duplicada, validación de totales, adjuntos PDF/XML y
    aprobación cuando la variación supera el umbral.
  - **Criterio de cierre:** el administrador solo revisa productos con desviación; cada cambio
    queda auditado con usuario, fecha y factura.
  - **Decisión pendiente:** umbral de variación y quién aprueba.
  - **Notas:** —

- [ ] **MEJ-004 · Notificaciones de stock in-app**
  - **Prioridad:** Media · **Esfuerzo:** S · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** badge en navegación, resumen en dashboard y enlace al listado filtrado por
    `bajoStock`.
  - **Criterio de cierre:** el aviso es visible sin entrar a Productos y no duplica la alerta
    existente en la tabla.
  - **Dependencia:** lógica actual de `stock_minimo` y `bajoStock`.
  - **Notas:** —

- [ ] **MEJ-005 · Decidir visibilidad de `/api/docs` y `/api/openapi.json` en producción**
  - **Prioridad:** Media · **Esfuerzo:** S · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** variable de entorno para habilitar/ocultar la documentación en producción.
  - **Criterio de cierre:** la decisión está documentada y el comportamiento es el mismo en
    local, Docker y CI.
  - **Decisión pendiente:** ¿pública por diseño o solo en entornos no productivos?
  - **Notas:** —

- [ ] **MEJ-006 · Usuario dedicado de MariaDB**
  - **Prioridad:** Media · **Esfuerzo:** S · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** crear un usuario de aplicación con permisos mínimos sobre la base, distinto de
    `root`, y usarlo en el compose de producción.
  - **Criterio de cierre:** el contenedor arranca, migra y opera con el usuario dedicado; las
    credenciales se gestionan como secretos.
  - **Riesgo:** las migraciones necesitan permisos DDL sobre la base de la aplicación.
  - **Notas:** —

- [ ] **MEJ-007 · Backups automáticos y prueba de restauración**
  - **Prioridad:** Alta · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** programar el volcado, copiarlo fuera del host, aplicar retención, alertar si
    falla y documentar una restauración de prueba trimestral.
  - **Criterio de cierre:** existe una copia automática verificada y una restauración exitosa
    registrada en `docs/OPERACION.md`.
  - **Dependencia:** definir destino de almacenamiento.
  - **Notas:** —

---

## Fase B · Inventario y automatización

- [ ] **MEJ-008 · Valuación de inventario por promedio ponderado**
  - **Prioridad:** Alta · **Esfuerzo:** L · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** costo promedio móvil por producto, actualización en entradas, uso en salidas y
    costo de ventas, migración inicial y ajuste de reportes.
  - **Criterio de cierre:** inventario, costo de ventas y margen usan el promedio; pruebas de
    compras sucesivas, ventas, devoluciones, stock cero, redondeo y concurrencia.
  - **Decisión pendiente:** ¿convive con `products.costo` o lo reemplaza? ¿Se recalcula el
    histórico o se aplica desde la migración?
  - **Riesgo:** cambia cifras contables; requiere aprobación del contador.
  - **Notas:** —

- [ ] **MEJ-009 · Importación de XML de facturas de proveedor**
  - **Prioridad:** Alta · **Esfuerzo:** L · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** subir o pegar XML, validar NIT/CUFE/número/totales, guardar el original,
    mapear productos y proveedor, crear borrador y confirmar manualmente.
  - **Criterio de cierre:** una factura XML se convierte en borrador sin doble digitación, con
    deduplicación por CUFE/hash, auditoría y revisión humana antes de mover stock.
  - **Dependencia:** XML de ejemplo de proveedores reales y reglas de validación.
  - **Notas:** —

- [ ] **MEJ-010 · Pruebas de carga en endpoints críticos**
  - **Prioridad:** Media · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** k6 para login, productos, dashboard y confirmación de facturas; datos
    realistas; umbrales de latencia y errores.
  - **Criterio de cierre:** script reproducible, resultados documentados y ejecución
    manual/nightly separada del CI de PR.
  - **Dependencia:** base de staging con volumen representativo.
  - **Notas:** —

---

## Fase C · Comunicaciones y estabilidad

- [ ] **MEJ-011 · Envío de cotizaciones y documentos no fiscales por correo**
  - **Prioridad:** Media · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** SMTP o proveedor transaccional, plantillas, adjunto PDF, reintentos y
    auditoría.
  - **Criterio de cierre:** el envío queda registrado y no se etiqueta como factura electrónica
    hasta que exista validación fiscal.
  - **Decisión pendiente:** SMTP propio o proveedor (Resend, SendGrid, Mailgun).
  - **Notas:** —

- [ ] **MEJ-012 · Pruebas visuales de regresión**
  - **Prioridad:** Media · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** capturas deterministas de 4–5 pantallas estables, fechas fijas, animaciones
    desactivadas, máscaras en gráficos y baselines generadas en CI.
  - **Criterio de cierre:** las diferencias visuales se detectan sin ruido y el reporte queda
    como artefacto.
  - **Dependencia:** UI estabilizada; ejecutar primero en `main` o nightly.
  - **Notas:** —

- [ ] **MEJ-013 · Correo entrante de facturas de proveedor**
  - **Prioridad:** Media · **Esfuerzo:** L · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** buzón dedicado, conexión IMAP/Graph/Gmail en lectura, extracción de adjuntos,
    deduplicación, cola de procesamiento y creación de borradores.
  - **Criterio de cierre:** una factura recibida por correo aparece como borrador revisable y
    los adjuntos se almacenan de forma segura.
  - **Dependencia:** volumen suficiente y buzón corporativo.
  - **Notas:** —

- [ ] **MEJ-014 · Refresh token en cookie `HttpOnly` con protección CSRF**
  - **Prioridad:** Media · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** mover el refresh token de `localStorage` a cookie `HttpOnly`, `Secure` y
    `SameSite`, añadir CSRF y actualizar cliente/E2E.
  - **Criterio de cierre:** una XSS ya no puede leer el refresh token; logout y rotación siguen
    funcionando.
  - **Riesgo:** cambios de CORS, proxy y pruebas E2E.
  - **Notas:** —

- [ ] **MEJ-015 · Monitorización de errores**
  - **Prioridad:** Media · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** Sentry/GlitchTip u equivalente, correlación con `requestId`, ocultación de PII y
    alertas.
  - **Criterio de cierre:** un error no controlado genera un evento correlacionable y una alerta
    operativa.
  - **Decisión pendiente:** proveedor y política de retención.
  - **Notas:** —

- [ ] **MEJ-016 · Rate limiting compartido para varias réplicas**
  - **Prioridad:** Baja · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** almacén compartido (Redis u otro) para límites por IP/usuario.
  - **Criterio de cierre:** dos réplicas respetan el mismo límite; hay fallback documentado si el
    almacén no responde.
  - **Condición:** solo si se despliega con más de una réplica.
  - **Notas:** —

---

## Fase D · Condicionados

- [ ] **MEJ-017 · Versionado de API `/api/v1`**
  - **Prioridad:** Media · **Esfuerzo:** L · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** alias `/api/v1`, mantener `/api` como deprecado, cabeceras `Deprecation`/
    `Sunset`, cliente generado, OpenAPI y pruebas.
  - **Criterio de cierre:** conviven ambas versiones durante una ventana definida y el cliente
    usa `/v1`.
  - **Condición:** cliente externo confirmado.
  - **Notas:** —

- [ ] **MEJ-018 · OCR para facturas PDF o físicas**
  - **Prioridad:** Baja · **Esfuerzo:** L · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** lectura de PDF/imagen, confianza por campo, revisión humana y benchmark de
    precisión.
  - **Criterio de cierre:** el flujo es más rápido que la digitación manual y ningún dato se
    confirma sin revisión.
  - **Condición:** proveedores sin XML; medir volumen y costo por página.
  - **Notas:** —

- [ ] **MEJ-019 · Facturación electrónica DIAN vía PAC**
  - **Prioridad:** Alta · **Esfuerzo:** XL · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** seleccionar PAC, XML UBL, CUFE, numeración, notas crédito/débito, eventos,
    ambientes de prueba y validación legal.
  - **Criterio de cierre:** una factura de venta se emite, transmite y consulta correctamente en
    el ambiente de habilitación del PAC.
  - **Condición:** contrato con PAC y validación del contador.
  - **Riesgo:** regulatorio y de numeración; no confundir con el correo de PDF.
  - **Notas:** —

- [ ] **MEJ-020 · Vencimientos de producto y lotes**
  - **Prioridad:** Baja · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** fecha de vencimiento o lotes, alertas, reportes y salida por proximidad a
    vencer.
  - **Criterio de cierre:** los productos perecederos se pueden filtrar y alertar por fecha.
  - **Condición:** confirmar que existen productos perecederos; las facturas por cobrar ya
    tienen alertas de cartera.
  - **Notas:** —

- [ ] **MEJ-021 · Exportador de métricas para Prometheus y trazas**
  - **Prioridad:** Baja · **Esfuerzo:** M · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** endpoint compatible con Prometheus, dashboards y trazas correlacionadas.
  - **Criterio de cierre:** las métricas sobreviven al reinicio y permiten series históricas.
  - **Condición:** necesidad operativa de observabilidad avanzada.
  - **Notas:** —

- [ ] **MEJ-022 · Preview público por Pull Request**
  - **Prioridad:** Baja · **Esfuerzo:** L · **Estado:** Pendiente · **Responsable:** —
  - **Alcance:** desplegar cada PR en una URL efímera, con limpieza y secretos aislados.
  - **Criterio de cierre:** el revisor abre una URL del cambio sin tocar producción.
  - **Condición:** definir proveedor de hosting; hoy existe smoke de la pila de producción.
  - **Notas:** —

---

## Decisiones abiertas

| ID | Decisión | Impacto | Responsable | Fecha |
| --- | --- | --- | --- | --- |
| DEC-01 | ¿Promedio ponderado reemplaza `products.costo` o convive con él? | MEJ-008 | — | — |
| DEC-02 | ¿Se recalcula el inventario histórico o se aplica desde la migración? | MEJ-008 | — | — |
| DEC-03 | Umbral de variación de precio y quién aprueba | MEJ-003 | — | — |
| DEC-04 | Volumen mensual de facturas de compra y porcentaje en XML | MEJ-009, MEJ-013 | — | — |
| DEC-05 | SMTP propio o proveedor transaccional | MEJ-011 | — | — |
| DEC-06 | ¿Hay clientes externos previstos para `/api/v1`? | MEJ-017 | — | — |
| DEC-07 | ¿Existen productos perecederos? | MEJ-020 | — | — |
| DEC-08 | ¿La documentación de API sigue pública en producción? | MEJ-005 | — | — |
| DEC-09 | Proveedor de errores y política de retención | MEJ-015 | — | — |
| DEC-10 | ¿Se habilita Dependency graph? | MEJ-001 | — | — |

## Riesgos principales

| Riesgo | Mejoras afectadas | Mitigación |
| --- | --- | --- |
| Cambio de cifras contables | MEJ-008 | Aprobación del contador, migración probada y comparación antes/después |
| XML/PDF no confiables | MEJ-009, MEJ-013, MEJ-018 | Validación estricta, revisión humana, deduplicación y análisis de adjuntos |
| Regulación DIAN cambiante | MEJ-019 | PAC, ambiente de habilitación y revisión legal |
| Pruebas visuales inestables | MEJ-012 | Datos fijos, máscaras, baselines en CI y ejecución nightly |
| Pruebas de carga contra datos irreales | MEJ-010 | Base de staging con volumen representativo |
| Migración de tokens a cookies | MEJ-014 | Ventana de compatibilidad y E2E de login/logout/refresh |

## Registro de cambios

| Fecha | Cambio | Autor |
| --- | --- | --- |
| 2026-11-26 | Creación del checklist con base entregada y 22 mejoras priorizadas | — |

## Enlaces útiles

- [Operación](../OPERACION.md)
- [Política de seguridad](../../SECURITY.md)
- [Contrato OpenAPI](../api/openapi.json)
- [Pruebas E2E](../../client/e2e)
- [Pruebas del servidor](../../server/tests)
- [CI](../../.github/workflows/ci.yml)
- [Preview de producción](../../.github/workflows/preview.yml)
