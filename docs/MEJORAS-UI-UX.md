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
| P1 | Media | Ordenamiento por SKU, nombre, precio, stock y costo. **Implementado** `[API]`: orden en el servidor (`sort`/`order`) para todas las páginas, columnas ordenables y estado en la URL. |
| P2 | Media | Reducir acciones por fila: “Movimiento” primaria y el resto en menú “Más”. **Implementado**: menú con Historial, Editar y Activar/Desactivar según rol. |
| P3 | Media | Exportar CSV con filtros activos y pie con cantidad/valor de stock. **Implementado**: exporta todas las páginas y muestra unidades/valor del filtro actual. |
| P4 | Baja | Chips de filtros aplicados con opción de limpiar. **Implementado**: cada filtro se puede quitar por separado o con “Limpiar todo”. |

## 5. Categorías

| # | Prioridad | Mejora |
|---|---|---|
| C1 | Media | Búsqueda local, orden por nombre/n.º de productos y paginación si supera ~20. **Implementado**: búsqueda sin distinguir tildes, orden local por ambas columnas y paginación de 20. |
| C2 | Baja | Mostrar el número de productos como enlace a Productos filtrado. **Implementado**: el número enlaza a Productos con `category_id`. |

## 6. Movimientos

| # | Prioridad | Mejora |
|---|---|---|
| M1 | Alta | Rango de fechas y búsqueda por texto/motivo/usuario. `[API]` rango en el endpoint. **Implementado**: `q` (SKU, producto, motivo o usuario) con debounce y rango `desde`/`hasta`. |
| M2 | Media | Selector de producto con búsqueda remota; hoy limita a los primeros 100. **Implementado**: búsqueda remota por SKU/nombre y conserva visible el producto del filtro activo. |
| M3 | Media | Exportar CSV y resumen del filtro (entradas, salidas, unidades). **Implementado**: CSV de todas las páginas y resumen de entradas/salidas con sus unidades. |
| M4 | Baja | Enlace al producto y a la factura/cotización de origen desde cada fila. **Implementado**: producto enlaza al catálogo y el documento a su factura o cotización. |
| M5 | Media | Ordenamiento por columnas (`sort`/`order` en el servidor, persistido en la URL). **Implementado**: fecha, producto, tipo, origen, cantidad, costo y precio; costo/precio solo para roles que los ven. |

## 7. Cotizaciones

| # | Prioridad | Mejora |
|---|---|---|
| Q1 | Alta | Filas accesibles: número como enlace y menú de acciones (Ver, Imprimir, Duplicar). **Implementado**: número enlaza al detalle y cada fila tiene menú de acciones; se quitó el clic de toda la fila para evitar conflictos. |
| Q2 | Alta | Editor de líneas responsive: tarjeta por línea en móvil, totales fijos. **Implementado**: tarjetas apiladas en móvil y total siempre visible en la barra inferior fija. |
| Q3 | Alta | Proteger cambios sin guardar al cancelar/volver (`beforeunload` + confirmación). **Implementado**: aviso al cerrar/recargar y confirmación al cancelar con cambios pendientes. |
| Q4 | Alta | En el detalle, ocultar/deshabilitar “Generar factura” si ya está facturada y listar facturas vinculadas. `[API]` para el listado. **Implementado**: `getQuote` devuelve las facturas vinculadas, se listan en el detalle y “Generar factura” se deshabilita si hay una confirmada. |
| Q5 | Media | Mostrar acciones deshabilitadas con tooltip (“solo creador o admin”) y sacar Imprimir a la barra principal. **Implementado**: acciones deshabilitadas con tooltip de permisos e Imprimir en la barra principal. |
| Q6 | Media | Plantilla de impresión: encabezado de empresa, datos de contacto, firma, condiciones y saltos de página. **Implementado**: encabezado y contacto genéricos, condiciones, notas, firmas y estilos de impresión con control de saltos. |
| Q7 | Media | Sorter por total/validez y total del filtro. **Implementado**: orden por número, cliente, total, validez y fecha; monto total del filtro calculado en el servidor. |

## 8. Facturación

| # | Prioridad | Mejora |
|---|---|---|
| F1 | Alta | La búsqueda `q` debe consultar todo el historial y no solo la página visible; hoy rompe el total y la paginación. **Implementado**: `q` viaja al servidor y el total/paginación cubren todo el historial. |
| F2 | Alta | Dividir el formulario en secciones: Datos generales, Cuenta, Líneas, Retenciones y totales. **Implementado**: formulario en tarjetas por sección. |
| F3 | Alta | Etiquetar “Guardar borrador”, explicar el paso “Confirmar” y advertir cambios sin guardar. **Implementado**: botón “Guardar borrador”, aviso del flujo borrador → confirmar, `beforeunload` y confirmación al cancelar con cambios. |
| F4 | Alta | Impresión/PDF de factura (`/facturas/:id/imprimir`) reutilizando la plantilla de cotización. **Implementado**: ruta, botón Imprimir y plantilla con totales, retenciones, notas y firmas. |
| F5 | Media | Exportar CSV y totales por tipo/estado. **Implementado**: CSV de todas las páginas del filtro y resumen de documentos/total por tipo y estado. |
| F6 | Media | Mostrar el saldo de la cuenta elegida y el impacto en caja antes de confirmar. **Implementado**: aviso con saldo actual, impacto y saldo resultante, también en el diálogo de confirmación. |
| F7 | Media | Al cambiar compra/venta, actualizar automáticamente el valor unitario sugerido (precio de venta o costo de compra), respetando precios escritos manualmente. **Implementado.** |
| F8 | Media | Ordenamiento por columnas: número, tipo, contraparte, estado, fecha, total y creador. **Implementado** `[API]`: orden en el servidor (`sort`/`order`) persistido en la URL; todas las páginas respetan el orden. |

## 9. Finanzas

| # | Prioridad | Mejora |
|---|---|---|
| N1 | Alta | La tabla de cuentas debe tener `loading`; hoy muestra “Aún no hay cuentas” mientras carga. |
| N2 | Alta | Estado de error con “Reintentar” en el resumen; hoy los KPI quedan en cero sin avisar. |
| N3 | Alta | En el detalle de presupuesto, separar error de carga de “Cargando…” (hoy puede quedar cargando para siempre). |
| N4 | Media | Agrupar los KPI en “Caja”, “Resultado” e “Impuestos” y mostrar el periodo activo. |
| N5 | Media | Tabla de cuentas con fila de totales, orden y acciones con `aria-label`. |
| N6 | Media | Transacciones: orden por fecha, tipo, categoría, cuenta, producto y monto. **Implementado** `[API]`: orden en el servidor persistido en la URL. Resumen de la página (ingresos, egresos, neto) pendiente. |
| N7 | Media | Presupuestos: orden por nombre, periodo, rango, estado, líneas, planeado, meta y creador. **Implementado** `[API]`: orden en el servidor persistido en la URL. Etiqueta “Vigente hoy”, filtro rápido y búsqueda con debounce pendientes. |
| N8 | Media | Formulario de presupuesto: drawer a pantalla completa en móvil y búsqueda remota de productos. |
| N9 | Media | Detalle de presupuesto: filtro “Solo alertas/excedidos”, orden por ejecución y botón “Volver”. |

## 10. Usuarios y perfil

| # | Prioridad | Mejora |
|---|---|---|
| U1 | Media | Ordenamiento por nombre, correo, rol, estado y fecha de creación. **Implementado** `[API]`: orden en el servidor (`sort`/`order`) persistido en la URL. Exportación CSV pendiente. |
| U2 | Media | Confirmación de desactivación explicando la pérdida de acceso. |
| U3 | Baja | Perfil: aclarar que nombre/correo los cambia un administrador y evitar el selector de tema duplicado. |

## Ruta sugerida

1. **Quick wins (1–2 días):** H1, H2, N1, N2, N3, G3, F1, F3 y textos de ayuda.
2. **Consistencia (2–3 días):** G1, G4, P1, P3, M3, F5, N5, N6.
3. **Formularios (3–5 días):** Q2, Q3, F2, F6, N8.
4. **Estructural (3–5 días):** Q1, Q4, Q6, F4, H3, N9.
