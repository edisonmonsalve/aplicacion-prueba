# Mejoras de UI/UX por módulo

Auditoría del cliente React. Prioridades: **Alta** (bloquea o confunde), **Media**
(fricción frecuente) y **Baja** (pulido). La etiqueta `[API]` indica que requiere
un cambio pequeño en el servidor.

## 1. Global / navegación

| # | Prioridad | Mejora |
|---|---|---|
| G1 | Alta | Unificar filtros en la URL en Productos, Usuarios, Movimientos, Transacciones y Presupuestos (Cotizaciones y Facturas ya lo hacen). Permite recargar, compartir enlaces y volver atrás sin perder el contexto. `[API]` solo para orden global. **Implementado** con `useUrlFilters`. |
| G2 | Media | Adaptar el shell a móvil: padding del `Content` y `Header` por breakpoint; ocultar nombre/rol del header en pantallas pequeñas. **Implementado.** |
| G3 | Media | Componente común de confirmación destructiva con nombre del objeto, consecuencia y botón `danger` (Productos, Categorías, Usuarios). **Implementado** con `ConfirmAction`. |
| G4 | Media | Unificar formato de fechas (`DD/MM/YYYY`) y etiquetas (“Impuesto” vs “IVA” vs “Imp.”). **Implementado** en tablas, detalles, impresión y selectores de fecha. |
| G5 | Baja | Estado activo del menú lateral más claro y breadcrumb en todas las rutas (automático en el layout, con nombre del documento en los detalles). **Implementado** con `RouteBreadcrumb` y `PageBreadcrumb`. |

## 2. Login

| # | Prioridad | Mejora |
|---|---|---|
| L1 | Baja | Limpiar el error al editar credenciales y mostrar un texto fijo de recuperación (“pide a un administrador restablecer tu contraseña”). **Implementado.** |

## 3. Inicio / Dashboard

| # | Prioridad | Mejora |
|---|---|---|
| H1 | Alta | Estado de error con “Reintentar”: hoy si falla la carga desaparece casi toda la página. **Implementado**: alerta persistente con botón `Reintentar` que vuelve a pedir el panel. |
| H2 | Alta | Ocultar “Comprar” a roles sin permiso; hoy redirige a Cotizaciones sin explicación. **Implementado**: la columna de acción solo se muestra a admin y operador. |
| H3 | Media | Métricas accionables: “Stock bajo” debe abrir Productos con `bajoStock=1`; las tarjetas deben navegar. **Implementado**: cada KPI y la alerta de stock abren Productos/Movimientos con el filtro correspondiente. |
| H4 | Media | Tooltips en los KPI explicando la diferencia entre caja, utilidad y capital. **Implementado** en el resumen de Finanzas y en “Valor del inventario” (aclara que no es utilidad ni capital). |

## 4. Productos

| # | Prioridad | Mejora |
|---|---|---|
| P1 | Media | Ordenamiento por SKU, nombre, precio, stock y costo. |
| P2 | Media | Reducir acciones por fila: “Movimiento” primaria y el resto en menú “Más”. |
| P3 | Media | Exportar CSV con filtros activos y pie con cantidad/valor de stock. |
| P4 | Baja | Chips de filtros aplicados con opción de limpiar. |

## 5. Categorías

| # | Prioridad | Mejora |
|---|---|---|
| C1 | Media | Búsqueda local, orden por nombre/n.º de productos y paginación si supera ~20. |
| C2 | Baja | Mostrar el número de productos como enlace a Productos filtrado. |

## 6. Movimientos

| # | Prioridad | Mejora |
|---|---|---|
| M1 | Alta | Rango de fechas y búsqueda por texto/motivo/usuario. `[API]` rango en el endpoint. |
| M2 | Media | Selector de producto con búsqueda remota; hoy limita a los primeros 100. |
| M3 | Media | Exportar CSV y resumen del filtro (entradas, salidas, unidades). |
| M4 | Baja | Enlace al producto y a la factura/cotización de origen desde cada fila. |

## 7. Cotizaciones

| # | Prioridad | Mejora |
|---|---|---|
| Q1 | Alta | Filas accesibles: número como enlace y menú de acciones (Ver, Imprimir, Duplicar). |
| Q2 | Alta | Editor de líneas responsive: tarjeta por línea en móvil, totales fijos. |
| Q3 | Alta | Proteger cambios sin guardar al cancelar/volver (`beforeunload` + confirmación). |
| Q4 | Alta | En el detalle, ocultar/deshabilitar “Generar factura” si ya está facturada y listar facturas vinculadas. `[API]` para el listado. |
| Q5 | Media | Mostrar acciones deshabilitadas con tooltip (“solo creador o admin”) y sacar Imprimir a la barra principal. |
| Q6 | Media | Plantilla de impresión: encabezado de empresa, datos de contacto, firma, condiciones y saltos de página. |
| Q7 | Media | Sorter por total/validez y total del filtro. |

## 8. Facturación

| # | Prioridad | Mejora |
|---|---|---|
| F1 | Alta | La búsqueda `q` debe consultar todo el historial y no solo la página visible; hoy rompe el total y la paginación. |
| F2 | Alta | Dividir el formulario en secciones: Datos generales, Cuenta, Líneas, Retenciones y totales. |
| F3 | Alta | Etiquetar “Guardar borrador”, explicar el paso “Confirmar” y advertir cambios sin guardar. |
| F4 | Alta | Impresión/PDF de factura (`/facturas/:id/imprimir`) reutilizando la plantilla de cotización. |
| F5 | Media | Exportar CSV y totales por tipo/estado. |
| F6 | Media | Mostrar el saldo de la cuenta elegida y el impacto en caja antes de confirmar. |
| F7 | Media | Al cambiar compra/venta, actualizar automáticamente el valor unitario sugerido (precio de venta o costo de compra), respetando precios escritos manualmente. **Implementado.** |

## 9. Finanzas

| # | Prioridad | Mejora |
|---|---|---|
| N1 | Alta | La tabla de cuentas debe tener `loading`; hoy muestra “Aún no hay cuentas” mientras carga. |
| N2 | Alta | Estado de error con “Reintentar” en el resumen; hoy los KPI quedan en cero sin avisar. |
| N3 | Alta | En el detalle de presupuesto, separar error de carga de “Cargando…” (hoy puede quedar cargando para siempre). |
| N4 | Media | Agrupar los KPI en “Caja”, “Resultado” e “Impuestos” y mostrar el periodo activo. |
| N5 | Media | Tabla de cuentas con fila de totales, orden y acciones con `aria-label`. |
| N6 | Media | Transacciones: orden por fecha/monto y resumen de la página (ingresos, egresos, neto). |
| N7 | Media | Presupuestos: etiqueta “Vigente hoy”, filtro rápido y búsqueda con debounce. |
| N8 | Media | Formulario de presupuesto: drawer a pantalla completa en móvil y búsqueda remota de productos. |
| N9 | Media | Detalle de presupuesto: filtro “Solo alertas/excedidos”, orden por ejecución y botón “Volver”. |

## 10. Usuarios y perfil

| # | Prioridad | Mejora |
|---|---|---|
| U1 | Media | Ordenamiento y exportación CSV de usuarios. |
| U2 | Media | Confirmación de desactivación explicando la pérdida de acceso. |
| U3 | Baja | Perfil: aclarar que nombre/correo los cambia un administrador y evitar el selector de tema duplicado. |

## Ruta sugerida

1. **Quick wins (1–2 días):** H1, H2, N1, N2, N3, G3, F1, F3 y textos de ayuda.
2. **Consistencia (2–3 días):** G1, G4, P1, P3, M3, F5, N5, N6.
3. **Formularios (3–5 días):** Q2, Q3, F2, F6, N8.
4. **Estructural (3–5 días):** Q1, Q4, Q6, F4, H3, N9.
