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
| G6 | Baja | Identidad visual: logo de la aplicación y favicon, usados en el sidebar y en el login. **Implementado** con `AppLogo` y `public/logo.svg`; la identidad de la empresa emisora vive en `config/company.ts` y se usa en las plantillas de impresión. |
| G7 | Media | Cambio de tema sin destello: tablas, tarjetas y bordes animaban su color en varios pasos y el arranque en oscuro mostraba fondo claro. **Implementado**: transiciones desactivadas durante el cambio (`theme-switching`), `color-scheme` y fondo base por tema, y script previo en `index.html` para aplicar el tema guardado antes del primer render. |

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
| Q4 | Alta | En el detalle, ocultar/deshabilitar “Generar factura” si ya está facturada y listar facturas vinculadas. `[API]` para el listado. **Implementado**: `getQuote` devuelve las facturas vinculadas, se listan en el detalle y “Generar factura” se deshabilita cuando el total cotizado ya está cubierto por facturas confirmadas. |
| Q5 | Media | Mostrar acciones deshabilitadas con tooltip (“solo creador o admin”) y sacar Imprimir a la barra principal. **Implementado**: acciones deshabilitadas con tooltip de permisos e Imprimir en la barra principal. |
| Q6 | Media | Plantilla de impresión: encabezado de empresa, datos de contacto, firma, condiciones y saltos de página. **Implementado**: cabecera compartida `PrintHeader` con logo, identidad de empresa (NIT, régimen, dirección, teléfonos, email y web), condiciones, notas, firmas y control de saltos. La hoja usa `PrintThemeProvider` con tokens claros explícitos para que no cambie entre modo claro y oscuro (incluida la barra de acciones). Los datos de la empresa emisora se centralizan en `client/src/config/company.ts` para reemplazarlos por los reales. |
| Q7 | Media | Sorter por total/validez y total del filtro. **Implementado**: orden por número, cliente, total, validez y fecha; monto total del filtro calculado en el servidor. |
| Q8 | Media | Vincular la cotización al maestro de terceros para reutilizar el cliente sin depender del texto libre. **Implementado**: selector “Cliente registrado” con autollenado de nombre, documento y email; el vínculo se guarda en `quotes.party_id` y los datos quedan como snapshot editable. La lista marca las cotizaciones con tercero y el detalle lo muestra; duplicar conserva el vínculo. |
| Q9 | Media | Evitar productos repetidos en las líneas de la cotización, que hoy solo se detectaban al guardar. **Implementado**: los productos ya usados en otra línea aparecen deshabilitados con la marca «ya agregado» y la lista valida duplicados antes de guardar. El servidor mantiene RN-P03 como última barrera. |
| Q10 | Media | La cotización es una propuesta comercial y la factura el documento legal de la venta: sus montos no tienen que coincidir. **Implementado**: se retiró el bloqueo por superar el total cotizado; el detalle muestra lo facturado y el saldo pendiente, y permite varias facturas por hitos mientras quede saldo. “Pendiente de facturar” ahora significa saldo sin cubrir, no ausencia de factura. |
| Q11 | Media | Quitar la acción «Entregar» de la cotización y dejar la entrega en manos de la factura. **Implementado**: se retiró el botón; el timeline conserva el paso «Entregado» y explica que se alcanza al confirmar la factura de venta, que es cuando sale el stock y se reconoce la venta. El endpoint `/quotes/:id/deliver` queda para una futura entrega de almacén. |

## 8. Facturación

| # | Prioridad | Mejora |
|---|---|---|
| F1 | Alta | La búsqueda `q` debe consultar todo el historial y no solo la página visible; hoy rompe el total y la paginación. **Implementado**: `q` viaja al servidor y el total/paginación cubren todo el historial. |
| F2 | Alta | Dividir el formulario en secciones: Datos generales, Cuenta, Líneas, Retenciones y totales. **Implementado**: formulario en tarjetas por sección. |
| F3 | Alta | Etiquetar “Guardar borrador”, explicar el paso “Confirmar” y advertir cambios sin guardar. **Implementado**: botón “Guardar borrador”, aviso del flujo borrador → confirmar, `beforeunload` y confirmación al cancelar con cambios. |
| F4 | Alta | Impresión/PDF de factura (`/facturas/:id/imprimir`) reutilizando la plantilla de cotización. **Implementado**: ruta, botón Imprimir y plantilla con la cabecera de empresa compartida, totales, retenciones, notas y firmas; mismos estilos claros en ambos temas. |
| F5 | Media | Exportar CSV y totales por tipo/estado. **Implementado**: CSV de todas las páginas del filtro y resumen de documentos/total por tipo y estado. |
| F6 | Media | Mostrar el saldo de la cuenta elegida y el impacto en caja antes de confirmar. **Implementado**: aviso con saldo actual, movimiento neto y saldo resultante, también en el diálogo de confirmación. El movimiento usa la base menos retenciones de fuente/ICA; el IVA y la retención de IVA se muestran aparte porque no mueven caja al confirmar. |
| F7 | Media | Al cambiar compra/venta, actualizar automáticamente el valor unitario sugerido (precio de venta o costo de compra), respetando precios escritos manualmente. **Implementado.** |
| F8 | Media | Ordenamiento por columnas: número, tipo, contraparte, estado, fecha, total y creador. **Implementado** `[API]`: orden en el servidor (`sort`/`order`) persistido en la URL; todas las páginas respetan el orden. |
| F9 | Media | Evitar productos repetidos en las líneas de la factura, que hoy solo se detectaban al guardar. **Implementado**: los productos ya usados en otra línea aparecen deshabilitados con la marca «ya agregado» y la lista valida duplicados antes de guardar; el servidor mantiene la validación como última barrera. |
| F10 | Media | Avisar sin bloquear cuando la factura vinculada difiere de la cotización. **Implementado**: al vincular una cotización se muestra el total cotizado, lo facturado y el saldo; si la factura lo supera, aparece un aviso que explica que puede continuar porque la factura refleja el valor real de la venta. La confirmación ya no responde 409 por exceder lo cotizado. |
| F11 | Alta | No mostrar “Stock insuficiente” en una factura vinculada a una cotización ya entregada. **Implementado**: el detalle de la factura expone `quote_estado`; con la cotización entregada las líneas muestran «Entregado en cotización» (o «Agregado tras la entrega» para productos nuevos), se suprime el semáforo de stock y se avisa que confirmar solo contabiliza la venta y el costo de ventas. Los textos de confirmación y anulación reflejan que el stock no se vuelve a mover. |
| F12 | Media | Aclarar en la factura de compra cómo afecta el descuento. **Implementado**: aviso en las líneas que explica que el descuento reduce la salida de caja y el valor del inventario, pero no el costo de referencia del producto; el costo de venta sigue usando el costo unitario del producto. |
| F13 | Alta | Conciliar la entrega de la cotización con la factura al confirmar. **Implementado**: `getInvoice` expone `conciliacion_entrega` (entregado, facturado previo y actual, cubierto, excedente, devolución); al confirmar se descuenta el excedente y se devuelve lo no facturado solo al cerrar el saldo cotizado; el detalle avisa los ajustes y el diálogo de confirmación los lista. Anular revierte también los ajustes sin tocar la entrega original. |

## 9. Finanzas

| # | Prioridad | Mejora |
|---|---|---|
| N1 | Alta | La tabla de cuentas debe tener `loading`; hoy muestra “Aún no hay cuentas” mientras carga. **Implementado**: `loading` en la tabla de cuentas. |
| N2 | Alta | Estado de error con “Reintentar” en el resumen; hoy los KPI quedan en cero sin avisar. **Implementado**: alerta de error con botón Reintentar. |
| N3 | Alta | En el detalle de presupuesto, separar error de carga de “Cargando…” (hoy puede quedar cargando para siempre). **Implementado**: error con Reintentar/Volver separado del estado de carga. |
| N4 | Media | Agrupar los KPI en “Caja”, “Resultado” e “Impuestos” y mostrar el periodo activo. **Implementado**: KPI agrupados por bloque y periodo visible. |
| N5 | Media | Tabla de cuentas con fila de totales, orden y acciones con `aria-label`. **Implementado**: fila de totales, orden por columnas y `aria-label` en acciones. |
| N6 | Media | Transacciones: orden por fecha, tipo, categoría, cuenta, producto y monto. **Implementado** `[API]`: orden en el servidor persistido en la URL y resumen del filtro (ingresos, egresos, neto). |
| N7 | Media | Presupuestos: orden por nombre, periodo, rango, estado, líneas, planeado, meta y creador. **Implementado** `[API]`: orden en el servidor persistido en la URL, etiqueta “Vigente hoy”, filtro rápido y búsqueda con debounce. |
| N8 | Media | Formulario de presupuesto: drawer a pantalla completa en móvil y búsqueda remota de productos. **Implementado**: `Drawer` responsive y búsqueda remota de productos por SKU o nombre. |
| N9 | Media | Detalle de presupuesto: filtro “Solo alertas/excedidos”, orden por ejecución y botón “Volver”. **Implementado**: checkbox “Solo líneas con alerta o excedidas”, orden por columnas y botón Volver. |
| N10 | Alta | Resumen financiero con atajos de **día, semana, mes y año**, navegación anterior/actual/siguiente y rango personalizado, todo persistido en la URL. **Implementado**: selector `Segmented`, semana que empieza en lunes, etiqueta del periodo y comparación contra el periodo calendario anterior (para rangos libres, bloque de igual duración). |
| N11 | Media | Comparación visual en las tarjetas: variación porcentual contra el periodo previo, con color según si subir es bueno (ingresos/utilidad) o malo (egresos/compras/costo). **Implementado** en ingresos, egresos, compras, utilidad, costo de ventas y margen bruto. |
| N12 | Media | Enlaces “Ver en” desde el resumen hacia Resultados, Flujo de caja, Tendencias y Transacciones conservando `desde` y `hasta`. **Implementado**: los reportes reciben el mismo rango sin volver a escribirlo. |
| N13 | Baja | Extender los atajos de periodo a todos los reportes derivados con un componente compartido `PeriodRangePicker` y permitir guardar rangos favoritos. **Implementado** el selector compartido (`PeriodRangePicker` + `useDateRange`) en Resultados, Flujo de caja, Tendencias, Rentabilidad, Rotación de inventario, Embudo de cotizaciones, Transacciones, Auditoría, Movimientos, Facturas, Cotizaciones y Cartera. Los rangos favoritos quedan propuestos. |
| N14 | Media | Los datos del emisor estaban fijos en `client/src/config/company.ts` y las facturas impresas mostraban datos de ejemplo. **Implementado** `[API]`: tabla `company_settings` (migración `V029`), `GET`/`PUT /api/company` con validación y auditoría, página **Empresa** solo para administrador con vista previa, logo opcional y cabecera/pie de impresión leyendo la configuración real. Los valores por defecto siguen disponibles mientras carga. |

## 10. Usuarios y perfil

| # | Prioridad | Mejora |
|---|---|---|
| U1 | Media | Ordenamiento por nombre, correo, rol, estado y fecha de creación. **Implementado** `[API]`: orden en el servidor (`sort`/`order`) persistido en la URL. Exportación CSV de todas las páginas del filtro. |
| U2 | Media | Confirmación de desactivación explicando la pérdida de acceso. **Implementado** con `ConfirmAction`: aviso de pérdida inmediata de acceso y conservación del historial; no permite desactivarse a sí mismo. |
| U3 | Baja | Perfil: aclarar que nombre/correo los cambia un administrador y evitar el selector de tema duplicado. **Implementado**: nota en el perfil y selector de tema solo en el encabezado. |

## 11. Pase global de jerarquía y espaciado

| # | Prioridad | Mejora |
|---|---|---|
| V1 | Media | Cabecera común de página con `PageHeader`: título, descripción corta, acciones a la derecha y etiqueta opcional. **Implementado** en Inicio, Productos, Categorías, Movimientos, Cotizaciones, Facturas, Resumen financiero, Presupuestos, Transacciones, Usuarios, Mi perfil y en los detalles de factura, cotización y presupuesto. Unifica el orden visual, la jerarquía (`Title` nivel 3) y el aire inferior (20 px). En móvil las acciones pasan a una línea nueva. |
| V2 | Baja | Descripciones de página alineadas bajo el título en lugar de párrafos sueltos con márgenes distintos; los filtros conservan 16 px antes de la tabla. **Implementado** en los módulos de listado y resumen. |
| V3 | Baja | Estado local del tema centralizado en el encabezado; el perfil ya no repite el selector. **Implementado** (ver U3). |
| V4 | Media | Tablas: contener el ancho en móvil (`scroll.x`) y fijar la columna de acciones a la derecha para que no quede fuera de pantalla en tablas anchas. **Implementado** en Productos, Categorías, Cotizaciones, Transacciones, Presupuestos, Cuentas y Usuarios. |

QA visual con capturas reales en 1440×900 y 390×844 sobre las 14 vistas principales: sin errores de runtime; se corrigieron el desborde de la tabla de Usuarios en móvil y las acciones fuera de pantalla en Productos y Transacciones.

## 12. Moneda, margen y tiempo relativo

Pase transversal sobre cómo se **escriben** y se **leen** los números y las fechas.

| # | Prioridad | Mejora |
|---|---|---|
| X1 | Alta | Formato de moneda único en `client/src/utils/format.ts` (`formatCurrency`, `formatCurrencyCompact`, `formatNumber`, `formatPercent`, `formatSignedCurrency`) y reutilizado por cotizaciones (`quoteUtils`), facturas (`InvoiceUtils`), finanzas (`FinanceUtils`), productos y movimientos. **Implementado**: antes cada módulo creaba su propio `Intl.NumberFormat`. |
| X2 | Alta | Inputs de dinero con separador de miles y `$` mientras se escribe, devolviendo enteros a la API, mediante `currencyInputProps` (precio, costo, costo unitario, saldo inicial de cuenta, monto de transacción, meta de ingresos y montos planeados de presupuesto); `integerInputProps` para cantidades de stock. **Implementado**. |
| X3 | Alta | Cálculo de margen en `client/src/utils/margin.ts`: margen sobre venta, markup sobre costo, utilidad por unidad y nivel (negativo, ajustado, razonable, alto). **Implementado** con pruebas de servidor del resumen y el orden. |
| X4 | Alta | Formulario de producto con panel en vivo de utilidad, margen y markup, barra de avance, alerta de precio bajo el costo y aviso de margen menor a 10 %. **Implementado**. |
| X5 | Media | Planificador “Calcular el precio” que sugiere el precio a partir de un **margen %** (`costo / (1 − margen)`) o un **markup %** (`costo × (1 + markup)`), con botón para aplicarlo. **Implementado**: deja explícita la diferencia, una de las causas más comunes de precios mal fijados. |
| X6 | Media | Listado de productos con columnas Costo y Margen (solo roles con permiso), orden por margen en servidor, fila resaltada para stock bajo y cuatro tarjetas KPI: productos, unidades, valor del stock y stock bajo clicable como filtro. **Implementado** `[API]`: el resumen incluye `bajos` y `margen` del stock. |
| X7 | Media | Tendencias de interfaz: radios 12/16, `controlHeight` 38, sombras suaves, tokens de tabla (encabezado compacto, hover tenue), cifras tabulares (`.num`), tarjetas KPI con acento y elevación al pasar el cursor, barra de desplazamiento discreta y respeto a `prefers-reduced-motion`. **Implementado** en `ThemeContext` e `index.css`. |
| X8 | Media | Fechas relativas con reloj compartido: `hace 12 segundos`, `hace 5 minutos`, `hace 3 horas`, `ayer`, `hace 4 días` y fecha absoluta a partir de la semana; tooltip con la fecha exacta. **Implementado** con `useNow` + `RelativeTime` en Productos, Movimientos, Usuarios e Inicio. Las columnas `DATE` sin hora se muestran como fecha para no inventar un instante. |
| X9 | Baja | Validaciones de entrada alineadas con la API: `stock_minimo` hasta 1.000.000, búsqueda hasta 100 caracteres, precio y costo hasta 9.999.999.999 y monto de transacción entero mayor que cero. **Implementado** en el cliente y en los esquemas Zod. |

## 13. SKU automático por categoría

| # | Prioridad | Mejora |
|---|---|---|
| S1 | Alta | Cada categoría tiene un **código** editable de 2 a 10 letras o números, único y en mayúsculas (`CON`, `FER`, `COM`...). Se propone automáticamente a partir del nombre al crearla y se muestra en el listado de Categorías. **Implementado** `[API]`: columna `categories.codigo` (migración `V030`), validación en el esquema Zod, conflicto 409 si se repite y compatibilidad con peticiones que solo envían `nombre` (se deriva del nombre). |
| S2 | Alta | SKU sugerido por categoría con consecutivo por prefijo (`CON-0001`, `CON-0002`, `FER-0001`...). Al elegir la categoría en el formulario de producto se rellena solo; el botón **Sugerir** lo regenera; la edición manual se respeta. **Implementado** `[API]`: `GET /api/products/next-sku?category_id=` calcula el mayor consecutivo y busca el primer SKU libre (tolera huecos y códigos repetidos entre categorías). `POST /api/products` también lo genera si el cliente omite `sku`. |
| S3 | Alta | **Reemplazo de todo el catálogo anterior**: la migración `V030` renumera todos los productos existentes, actualiza `quote_items.sku` por `product_id` y reescribe las instantáneas `quote_audit_log.changes` (`items.old`/`items.new`) conservando el resto de campos. Usa placeholders temporales para no chocar con el índice `UNIQUE`; es idempotente y cubierta por pruebas. |
| S4 | Media | El seed demo ya no reintroduce SKUs del formato antiguo: usa los prefijos de las cinco categorías del ejemplo y mantiene una clave estable para las referencias internas entre movimientos, cotizaciones, facturas y ajustes. **Implementado.** |

> Nota: cambiar el código de una categoría **no** renombra los SKU ya creados; la sugerencia para productos nuevos usa el código vigente. `.env` y la base de pruebas se actualizaron con `npm run test:db` porque el migrador rechaza cambios de checksum en migraciones ya aplicadas.

## 14. Selector de productos, moneda y fechas en facturación

| # | Prioridad | Mejora |
|---|---|---|
| Y1 | Alta | Selector de producto compartido para cotizaciones y facturas (`ProductSelect` + `useProductSearch`): búsqueda remota por **nombre o SKU** con debounce, spinner y mensaje de «sin resultados». **Implementado**: antes se acumulaban los resultados de todas las búsquedas y el listado inicial tapaba al producto buscado; ahora cada búsqueda reemplaza la anterior y el producto ya elegido se mantiene visible. La etiqueta muestra primero el nombre y luego el SKU y el stock. Los productos repetidos siguen deshabilitados. |
| Y2 | Alta | Formato de moneda en los campos de dinero de facturación y cotización: precio unitario, retenciones, monto de pago y precio de nota de ajuste usan `currencyInputProps` (`$ 1.250.000` mientras se escribe). **Implementado**: el precio unitario de la cotización también se muestra formateado aunque sea de solo lectura. |
| Y3 | Media | Las columnas **Fecha** de Facturas y Transacciones usan `RelativeTime` (`hoy`, `ayer`, `hace 4 días`) con la fecha exacta en el tooltip, igual que Productos, Movimientos y Usuarios. `RelativeTime` acepta `dateOnlyRelative` para que las columnas `DATE` (`AAAA-MM-DD`, que antes se mostraban siempre como `dd/mm/aaaa`) se comparen por días en hora local; el resto de pantallas conserva la fecha absoluta. **Implementado.** |
| Y4 | Media | Prueba de servidor que verifica que `/api/products?q=` encuentra productos por nombre, por nombre sin acentos y por SKU. **Implementada** (`server/tests/products-search.test.ts`). |

## 15. Sistema visual Signal (mejora global)

Dirección aprobada: **dashboard vibrante con influencia minimalista cálida** y lenguaje de
HUD de videojuego domesticado para el ámbito empresarial. Estudio completo en
[`ESTILO-SIGNAL.md`](./ESTILO-SIGNAL.md).

| # | Prioridad | Mejora |
|---|---|---|
| S1 | Alta | **Tokens de diseño** (`styles/tokens.css`) sincronizados con `ConfigProvider`: paleta cálida/vibrante, superficies, tinta, líneas, radios, sombras y movimiento. AntD y el CSS usan los mismos valores. **Implementado.** |
| S2 | Alta | **Tipografía con personalidad**: `Space Grotesk Variable` para títulos y cifras, `Plus Jakarta Sans` para el cuerpo, micro-labels en mayúsculas con tracking ancho y cifras tabulares. **Implementado.** |
| S3 | Alta | **Shell HUD**: sidebar por secciones numeradas, indicador de estado, avatar con anillo, barra de señal en `PageHeader` (28 páginas) y overlay móvil accesible con cierre por `Escape`. **Implementado.** |
| S4 | Alta | **KPI Signal**: `StatCard` con barra de acento, escuadra, icono, delta y cifra monoespaciada; reemplaza las tarjetas duplicadas de Inicio (9 KPIs) y Finanzas (11 KPIs). Soporta `loading` con shimmer. **Implementado.** |
| S5 | Media | **`FilterBar` + `FilterField`**: barra y micro-labels unificados para los patrones de filtros repetidos. Aplicado en Productos y Facturas; los demás listados pueden migrarse incrementales. **Implementado.** |
| S6 | Media | **Gráficos**: paleta desde tokens, tooltips del tema y barras con degradado suave en Inicio. **Implementado.** |
| S7 | Alta | **Accesibilidad y movimiento**: skip link, `:focus-visible` global, `aria-live` en carga y `prefers-reduced-motion` para toda la app. **Implementado.** Los KPIs migrados usan tokens; los hex sueltos que quedan en otros módulos (Tendencias, Cartera, Balance, etc.) se migran en la siguiente tanda. |

## 16. Signal vivo: color semántico y ambiente animado

Tras la primera tanda Signal los KPIs se veían monotónicos: el color había quedado
reducido a un icono pequeño y una barra de 3 px, mientras la cifra era tinta neutra
en todos los casos. Esta tanda devuelve la señal al dato y hace que el panel se
sienta vivo sin perder sobriedad.

| # | Prioridad | Mejora |
|---|---|---|
| V1 | Alta | **Color semántico en la cifra**. `StatCard` incorpora tonos de negocio (`income`, `expense`, `outflow`, `violet`) y pinta el valor con una variante `ink` legible en claro y oscuro: ingreso verde, egreso coral, salida de caja ámbar, capital teal, valoración violeta. Inicio y Resumen financiero usan la semántica correcta en sus 20 KPIs. **Implementado.** |
| V2 | Alta | **Ambiente que respira**: dos halos tenues en el lienzo (marca + violeta al 7 %) con un ciclo de 26 s, `status pip` con pulso de 2,6 s y barrado casi invisible en la cuadrícula del sidebar. **Implementado.** |
| V3 | Alta | **Movimiento con propósito**: entrada escalonada de KPIs (60 ms por columna), entrada de cabecera y de página al cambiar de ruta, glow del hover con el color del tono y barras de gráficos con animación de 850 ms. **Implementado.** |
| V4 | Media | **`AnimatedNumber`**: las cifras financieras cuentan hasta su valor al cargar o al cambiar de periodo (620 ms, `ease-out` cúbico). Respeta `prefers-reduced-motion` mostrando el valor final. **Implementado.** |
| V5 | Media | **Stock bajo más legible**: la tabla de Inicio añade una mini-barra que hace perceptible la relación stock/mínimo junto al tag. **Implementado.** |
| V6 | Media | **Header vivo**: el indicador «Sistema operativo» pasa a «En vivo · HH:mm» con hora local que se actualiza cada 30 s. **Implementado.** |
| V7 | Media | **KPIs como atajos**: Ingresos y Egresos abren Transacciones, Compras abre Rotación de inventario y Utilidad abre Resultados, conservando el periodo de la URL. **Implementado.** |

Verificación: `client npm run build` y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## Ruta sugerida

1. **Quick wins (1–2 días):** H1, H2, N1, N2, N3, G3, F1, F3 y textos de ayuda.
2. **Consistencia (2–3 días):** G1, G4, P1, P3, M3, F5, N5, N6.
3. **Formularios (3–5 días):** Q2, Q3, F2, F6, N8.
4. **Estructural (3–5 días):** Q1, Q4, Q6, F4, H3, N9.
