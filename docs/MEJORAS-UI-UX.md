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
| S5 | Media | **`FilterBar` + `FilterField`**: barra y micro-labels unificados para los patrones de filtros repetidos. Aplicado en Productos y Facturas, y extendido al resto de listados en la sección 17. **Implementado.** |
| S6 | Media | **Gráficos**: paleta desde tokens, tooltips del tema y barras con degradado suave en Inicio. **Implementado.** |
| S7 | Alta | **Accesibilidad y movimiento**: skip link, `:focus-visible` global, `aria-live` en carga y `prefers-reduced-motion` para toda la app. **Implementado.** Los KPIs migrados usan tokens; los hex sueltos de otros módulos se centralizaron en la sección 17. |

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

## 17. Cierre de tanda: tokens en JS y filtros globales

Última tanda de consistencia: dejar un único origen de color también fuera del CSS
y terminar la migración de filtros que la sección 15 dejó pendiente.

| # | Prioridad | Mejora |
|---|---|---|
| Z1 | Alta | **`styles/signal.ts`**: referencias `var(--ui-*)` para cifras, SVG y gráficos. Los hexadecimales sueltos de ~24 módulos (Inicio, Login, Logo, reportes de Finanzas, Cartera, detalle de factura, etc.) pasan a `signal.*`, con variantes `ink` para texto y `Accent` para shapes. Cambiar un token en `tokens.css` ahora actualiza también Recharts y los SVG. **Implementado.** |
| Z2 | Media | **Excepciones documentadas**: `ThemeContext.tsx` sigue siendo la fuente de los tokens de AntD; `PrintThemeProvider` y `reportExport` mantienen una paleta de papel fija porque el HTML impreso no participa del tema claro/oscuro. `signal.ts` conserva `onBrand` y `brandDeep` como assets intencionales del logo/login. **Documentado.** |
| Z3 | Alta | **`FilterBar` en el resto de listados**: Cotizaciones, Terceros, Usuarios, Categorías, Movimientos, Transacciones, Presupuestos, Auditoría, Por cobrar, Flujo de caja, Rotación de inventario y Rentabilidad. Se conservaron el estado en URL, los resets de página, la búsqueda remota de productos, los selects dependientes de Auditoría y los `PeriodRangePicker` en su tarjeta. **Implementado.** |
| Z4 | Baja | **Animación de gráficos alineada**: barras de Tendencias con 850 ms y paleta de acento coherente (azul eléctrico, verde, violeta) en lugar de tonos de texto. **Implementado.** |

Verificación: `client npm run build` y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## 18. Shell Signal: sider y header terminados

Pase final de diseño al contenedor de la aplicación. No cambia rutas ni
comportamiento; hace que el shell se lea con el mismo lenguaje que los KPIs y
las tablas.

| # | Prioridad | Mejora |
|---|---|---|
| W1 | Media | **Sider**: halo tenue detrás del logo, índices de sección en teal legible sobre fondo oscuro (`--ui-sider-accent` con `color-mix`), barra de señal en el item activo, micro-desplazamiento del icono en hover y pie «Signal · Control / OPS» anclado abajo. **Implementado.** |
| W2 | Media | **Header**: fondo degradado `surface → surface-2`, filo de señal teal→violeta y el indicador «En vivo · HH:mm» con pip. El separador antes del cluster de acciones y el chip con borde de la hora se probaron y se retiraron: desentonaban con el resto de bordes rectos. **Implementado.** |
| W3 | Baja | **Accesibilidad**: el acento del sider se aclara en ambos temas para no perderse sobre el fondo oscuro; los hovers del avatar y del icono se anulan con `prefers-reduced-motion`. **Implementado.** |

Verificación: `client npm run build` y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## 19. Sider estable: fin del “crecimiento” al scrollear

Corrección centrada en el comportamiento del aside. El usuario reportó que el
scroll parecía agrandar el panel y que el submenú de Finanzas era incómodo.
Se atacaron las cuatro causas reales en vez de añadir más animación:

| Causa | Corrección |
|---|---|
| `motion` inline de AntD animaba la altura del submenú (`initCollapseMotion`). | `motion={{ motionName: "" }}` en el `Menu`: abrir Finanzas es instantáneo, sin efecto de “crecer”. |
| El barrido animado `::before` de `.ui-grid-bg` recorría todo el sider cada 14 s. | Se eliminó; queda solo la cuadrícula estática. Tampoco se referencia en la hoja de impresión. |
| `ui-rise` incluía `scale(0.985)` y se aplicaba en cada cambio de ruta. | Se quitó el `scale`; la entrada es solo fundido + 6 px de desplazamiento. |
| El scroll estaba en el propio `.ant-layout-sider`, sin gutter, y su ancho animaba al contraer. | Scroll aislado en `.ui-sider-scroll` con `scrollbar-gutter: stable` y `overscroll-behavior: contain`; `transition: none` en el sider. |

Distribución y Finanzas:

- Ancho 228 px (72 px contraído, 0 en móvil) e `inlineIndent={16}` para que las
  15 entradas financieras no queden apretadas.
- Rótulos de grupo y márgenes de item compactos; marca y pie más delgados;
  el pie queda fuera del área desplazable.
- Al navegar, un `useEffect` centra el `.ant-menu-item-selected` **dentro del
  contenedor del sider** (nunca mueve el scroll de la página, sin `behavior:
  smooth`). Así, entrar en «Transacciones» o «Presupuestos» deja visible la
  selección aunque esté al final del submenú.
- Los delays de apertura/cierre del submenú bajan a 0: el hover responde de
  inmediato y no encadena estados intermedios.

Verificación: `client npm run build` y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## 20. Navegación del sider: búsqueda y jerarquía

Sobre la base estable del punto 19, se mejora cómo se encuentra y se entiende
cada sección. El menú pasa de una lista plana a un panel navegable.

| # | Mejora | Detalle |
|---|---|---|
| N1 | **Buscador de menú** | Input arriba del listado con `/` para enfocar y `Escape` para limpiar. Filtra de forma recursiva grupos, submenús y hojas; abre automáticamente las ramas con coincidencias y muestra un estado vacío. El índice `NAV_SEARCH` incluye sinónimos (`stock`, `facturación`, `clientes`) y se normaliza sin tildes, así «operacion» encuentra «Operación». Al elegir un resultado se limpia la búsqueda. |
| N2 | **Finanzas reagrupado** | Las 15 entradas dejan de ser una lista larga: se dividen en `Panel` (2), `Reportes` (7) y `Gestión` (6), con micro-etiquetas en el submenú. El padre se rotula «Módulo financiero» y muestra un contador `15`. |
| N3 | **Jerarquía visible** | Índice de sección en chip monoespaciado, pip en cada entrada financiera, barra de señal también en el padre cuando alguna hija está activa (`:has`) y sub-etiquetas más tenues que los rótulos de grupo. Los tooltips del modo contraído siguen funcionando porque AntD usa la etiqueta como título. |
| N4 | **Diseño** | Buscador con superficie translúcida y atajo `/` en `kbd` cuando está vacío; el estado activo del submenú hereda el color del item seleccionado. Sin nuevas animaciones: la navegación sigue siendo instantánea. |

Verificación: `client npm run build` y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## 21. Breadcrumb único

Problema de partida: existían **dos sistemas** que pintaban la ruta de navegación.
`RouteBreadcrumb.tsx` construía el breadcrumb global desde la URL con un mapa
`SECTIONS` y una cadena de `if` para cada subruta de Finanzas, mientras tres
páginas de detalle (factura, cotización y presupuesto) pintaban su propio
`PageBreadcrumb`. Añadir una ruta obligaba a tocar condicionales y el breadcrumb
global se quedaba corto en las rutas nuevas.

| # | Mejora | Detalle |
|---|---|---|
| B1 | **Fuente única** | `PageBreadcrumb.tsx` pasa a tener un registro plano `ROUTE_LABELS` (prefijo acumulado → etiqueta) y el hook `useRouteBreadcrumb(leaf?)`. Sin cadena de `if`: cada segmento de la URL se resuelve contra el registro. Las rutas `editar` se rotulan desde `EDIT_LABELS`. |
| B2 | **Integrado en `PageHeader`** | El breadcrumb se deriva dentro de la cabecera común, así que `AppLayout` deja de renderizarlo. Se elimina `RouteBreadcrumb.tsx`. Una sola cabecera, breadcrumb y micro-label, sin un segundo sistema en el shell. |
| B3 | **Hojas con dato real** | Las páginas de detalle pasan `breadcrumbLeaf` (número de factura/cotización, nombre del presupuesto) y la sección padre se convierte en enlace. La rama de error de presupuesto conserva su breadcrumb local con «Detalle». |
| B4 | **Sin efectos colaterales** | No se tocan estilos (`index.css`) ni otras pantallas. Las migajas no enlazan la página actual. |

Verificación: `client npm run build` y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## 22. Tanda Signal: aside compacto, categorías integradas y visual con profundidad

Ejecutada sobre `feature/signal-ui-ux`, encima del breadcrumb único (§21). Objetivo:
acortar la navegación y dar un salto perceptivo al sistema visual sin tocar la lógica
de datos de ningún reporte. Se ejecutó en este orden: A3 + B1 + B2 + B5 → A2 → A1.

### UX / funcionalidad

| # | Mejora | Impacto | Detalle |
|---|---|---|---|
| A3 | **Menú aplanado** | Medio | Desaparece el nivel «Módulo financiero» (4 → 3 niveles) y su contador `15`. Los tres grupos (Panel / Reportes / Gestión) cuelgan directamente de «Finanzas». Se eliminan `openKeys`, `collectBranchKeys`, el icono `DollarOutlined`, el CSS del submenú y sus sinónimos de búsqueda. |
| A2 | **Categorías dentro de Productos** | Medio | Nuevo `CategoriesPanel` compartido. `ProductsPage` gana pestañas Productos/Categorías con el estado en la URL (`?view=categorias`) y recarga sus categorías al crear/editar/eliminar. `/categories` sigue enlazable como wrapper delgado (`CategoriesPage`) y sale del menú para evitar duplicidad. |
| A1 | **Reportes con pestañas (puente)** | Alto | `FinanceSectionTabs` (entonces `FinanceReportsTabs`) se monta tras el `PageHeader` de las 7 páginas de reportes y navega a las rutas existentes. No monta los 7 informes en una sola pantalla ni toca filtros, exportaciones ni permisos: se eligió esta variante sobre la conversión real por su riesgo bajo. Generalizado a las 3 secciones en la tanda 24. |

### Sistema visual

| # | Mejora | Impacto | Detalle |
|---|---|---|---|
| B1 | **Fondos y profundidad** | Alto | Tokens `--ui-shadow-deep` y `--ui-inset`; clase `.ui-deep-surface` y doble sombra + filo interior en `.ui-chart-card` (Inicio y Tendencias), con halo radial de marca estático. |
| B2 | **Tipografía** | Alto | Escala compartida `--ui-text-micro/body/kpi/display`; `body` usa `--ui-font` y `font-optical-sizing: auto`. Micro-label, títulos y KPIs dejan de tener tamaños sueltos. |
| B5 | **Gráficos + reduced-motion** | Medio-alto | `styles/chartPalette.ts` unifica colores y tooltip; `hooks/useReducedMotion.ts` pasa `isAnimationActive={!reduced}` a barras, líneas y sectores de Recharts (antes ignoraban la preferencia). Gradientes suaves en los gráficos de Inicio y Tendencias. |

Archivos nuevos: `CategoriesPanel.tsx`, `FinanceSectionTabs.tsx` (antes
`FinanceReportsTabs`), `useReducedMotion.ts` y `chartPalette.ts`. El estilo de
las pestañas de Finanzas vive en `.ui-finance-tabs`.

Verificación: `client npm run build` (✓ 3637 módulos) y `client npm run lint` (0 errores;
los 2 warnings preexistentes de `InvoiceFormPage.tsx` se mantienen). `git diff --check`
sin errores de whitespace. Commit: `2b28c52`.

## 23. Tanda Signal: KPIs con cuerpo y tablas data-terminal

Tercera tanda visual, ejecutada encima de `2b28c52` y aprobada para commit en
esta rama. Alcance: `StatCard.tsx`, `index.css` y estos dos documentos; ninguna
pantalla ni el sider se tocan.

| # | Mejora | Impacto | Detalle |
|---|---|---|---|
| B3 | **Tarjetas / KPIs** | Medio-alto | Lavado de acento en reposo (radial del 7 % en la esquina de la cifra) y highlight interior con `--ui-inset`. Estado `:active` que hunde 1 px al pulsar, foco reforzado con doble anillo y prop `sparkline` opcional que solo reserva espacio si se aporta una serie. |
| B4 | **Tablas data-terminal** | Medio | Numéricos monoespaciados vía `.num` y celdas alineadas a la derecha; cabecera con fondo opaco; rail semántico en la primera celda de `.row-low-stock`; `focus-within` por fila con `outline` para no pisar el rail. Efectos desactivados en impresión. El banding inicial del 2,5 % se retiró en la tanda 24: solo conservan color las filas con estado. |

Nota: AntD 6 no expone clases de color por tag en CSS, así que el rail no intenta
adivinar el color del tag: se apoya en la clase semántica que ya existe
(`.row-low-stock`). El foco usa `outline` precisamente para no sobrescribirlo.

Verificación: `client npm run build` (✓ 3637 módulos) y `client npm run lint` (0 errores;
los 2 warnings preexistentes de `InvoiceFormPage.tsx` se mantienen). `git diff --check`
sin errores de whitespace. Commit aprobado: `feat(ui): dar cuerpo a los KPIs y pulir
tablas data-terminal`. Sin PR.

## 24. Tanda Signal: consola de Finanzas y atmósfera reactiva

Cuarta tanda, ejecutada sobre `96f6054`. Objetivo: simplificar el menú, no
recargarlo, y que el fondo se sienta vivo sin partículas ni shaders. Sin nuevas
dependencias. El rail de grupo y las cabeceras fijas se probaron y se retiraron
dentro de la propia tanda: añadían señales donde ya existían la barra del item
activo y las pestañas contextuales. A4 (una sola entrada de Reportes) quedó como
estado intermedio y se sustituyó por F1: Finanzas es una consola de 3 secciones
con la navegación dentro del contenido.

| # | Mejora | Impacto | Riesgo | Detalle |
|---|---|---|---|---|
| F1 | **Consola de Finanzas por secciones** | Alto | Medio | Finanzas pasa de 9 entradas a 3 hojas planas e iconadas: **Resumen**, **Reportes** y **Gestión**. Las 13 rutas se mapean a esas 3 claves en `MODULE_ROUTES` y `NAV_SEARCH` se reduce a 3 entradas con sinónimos. `FinanceSectionTabs` sustituye a `FinanceReportsTabs` y se monta en las 16 páginas: 7 de reportes, 7 de gestión (incluido el detalle de presupuesto) y 2 de resumen. Conserva la `search` al cambiar de pestaña para no perder periodo ni filtros, y resuelve la pestaña padre en rutas anidadas como `/finanzas/presupuestos/:id`. «Salud de datos» deja de ser hoja del sider y entra como pestaña de Resumen. |
| V1 | **Grid reactivo al puntero** | Alto | Bajo-medio | `.ui-ambient-layer` concentra dos rejillas y una viñeta; la fina lleva una máscara radial en `--ui-pointer-x/y`. `usePointerGrid` actualiza las coordenadas a lo sumo una vez por frame, ignora punteros táctiles y no escribe nada con `prefers-reduced-motion`. Sin JS, la máscara conserva una posición estática. |
| V2 | **Marcos HUD en gráficos** | Medio | Bajo | `.ui-chart-card` y `.ui-deep-surface` ganan dos escuadras en `::after`. Se descartó el `clip-path` en índices y en el atajo `/`: no aportaba y, llevado a tarjetas, recortaría la sombra de profundidad de la tanda anterior. |
| V3 | **Rejilla por capas + viñeta** | Medio | Bajo | Celda ancha de 56 px enmascarada hacia el centro, celda fina de 28 px para el foco y viñeta del 5 % de la tinta. Colores ≤ 5 % en ambos temas; la capa desaparece en impresión. |
| B6 | **Tablas sin cebrado** | Medio | Bajo | Corrección sobre B4: se elimina `:nth-child(even)` y su excepción de impresión. Las filas normales comparten fondo; el color queda reservado a estados reales (`.row-low-stock`, `.pnl-subtotal` / `.pnl-section`), al hover de AntD y al `focus-within`. El cebrado además tapaba el fondo de los subtotales en filas pares. El export `reportExport.ts` mantiene su estilo y no se toca. |

Nota: `M1` (rail de grupo, cabeceras `sticky` y tinte del índice activo) y la
esquina recortada de los índices se implementaron y se retiraron tras la revisión
visual. Tampoco queda rastro de `ui-nav-sublabel`, `ui-nav-pip`, `subItem` ni de
`FinanceReportsTabs.tsx`: F1 los sustituyó por hojas iconadas y pestañas
contextuales. El cebrado de `reportExport.ts` sigue fuera del alcance de B6.

Archivos: `usePointerGrid.ts` y `FinanceSectionTabs.tsx` (nuevos),
`FinanceReportsTabs.tsx` (eliminado), `AppLayout.tsx`, `index.css`, `tokens.css`,
16 páginas de Finanzas y estos dos documentos. El shell queda en
`position: relative` y el contenido en `z-index: 1` para que la atmósfera nunca
se cruce con el texto.

Verificación: `client npm run build` (✓ 3638 módulos) y `client npm run lint` (0 errores;
los 2 warnings preexistentes de `InvoiceFormPage.tsx` se mantienen). `git diff --check`
sin errores de whitespace. Sin commit ni push hasta la aprobación explícita.

## 25. Tanda visual: botones, grillas y shapes

Sexta tanda, sobre `f262a7e`. No añade decoración: corrige tres inconsistencias
que hacían que partes del sistema no hablaran el mismo idioma. Sin dependencias
nuevas y sin tocar la estructura de página, que ya era consistente (16 px entre
secciones, 24 px de margen del `Content`).

| # | Mejora | Impacto | Riesgo | Detalle |
|---|---|---|---|---|
| B7 | **Jerarquía de botones** | Medio | Bajo | Los botones AntD ganan estados propios alineados con los KPIs: `hover` eleva 1 px con sombra corta, `:active` hunde 1 px y primario/peligro suman un filo del color de su señal. Solo se animan `transform` y `box-shadow`; los colores, `disabled` y `loading` siguen gobernados por AntD. Texto y enlace no se elevan. La elevación se anula con `prefers-reduced-motion`. |
| B8 | **Un solo gutter de 16** | Medio | Bajo | Las grillas mezclaban `12` y `16` (a veces en la misma página). Todas las `Row` pasan a `16`, múltiplo de 8, conservando el formato `[x, y]`. Incluye los formularios de Empresa y Producto. |
| B9 | **Escala de radius** | Bajo | Bajo | Los cinco radios sueltos se reducen a una progresión corta documentada: `4` etiquetas/kbd, `8` deltas, tooltips e iconos pequeños, `14` tarjetas y botones, `16` tarjetas grandes y `999` píldoras. Cambios puntuales: delta `6→8` e icono de KPI `9→8`. |

Archivos: `index.css`, `ProductFormModal.tsx`, 13 páginas (CompanySettings,
Products, Receivables y diez de Finanzas) y estos dos documentos.

Verificación: `client npm run build` (✓ 3638 módulos; bundle principal 165,93 kB,
sin cambio; CSS 27,84 → 28,82 kB por las reglas de botón) y `client npm run lint`
(0 errores; los 2 warnings preexistentes se mantienen). `git diff --check` sin
errores de whitespace. Sin commit ni push hasta la aprobación explícita.

## 26. Tanda HUD: bento, densidad, glass y navegación

Séptima tanda, sobre `7249c58`. Cinco mejoras visuales y de navegación, sin
dependencias nuevas y sin tocar la estructura de página. El objetivo es que el
panel se lea como un HUD: bloques con jerarquía, densidad ajustable, superficies
flotantes que se separan del contenido sin ensuciarlo y formularios modales con
la misma voz editorial que las páginas. La paleta de comandos y el feedback de
sistema quedan fuera de esta tanda, como se acordó.

| # | Mejora | Impacto | Riesgo | Detalle |
|---|---|---|---|---|
| B10 | **Bento en Inicio y Resumen** | Medio-alto | Medio | Inicio pasa de dos filas simétricas a bloques `16/8` que alternan el lado grande: movimientos + cotizaciones, luego top productos + stock bajo. En Resumen, Liquidez y Resultado comparten fila en dos columnas `12` desde `lg`, cada una con sus cuatro KPIs en `2×2`; Fiscal queda a ancho completo con tres KPIs en `lg={8}` (antes dejaban un hueco de 6 columnas). Por debajo de `lg` todo se apila y los KPIs conservan dos columnas. |
| B11 | **Densidad HUD** | Medio | Bajo | Control Cómoda/Compacta en el header, con icono `Compress`/`Expand` y `aria-pressed`. Se guarda en `localStorage` (`ui-density`) y se aplica en `data-density` antes del primer pintado desde `index.html`. La versión compacta recorta relleno de tarjetas, cabeceras, filas de tabla y listas; tipografía y controles no cambian. Sin transición de layout. |
| B12 | **Glass quirúrgico** | Bajo-medio | Bajo | Vidrio solo donde hay contenido reconocible detrás: dropdown, popover, select, calendario y tooltip, con `blur(6px) saturate(1.15)` sobre un 62 % de superficie (66 % en el tooltip oscuro). Los modales quedan fuera a propósito: su mask a pantalla completa ya oscurece la página y el efecto no se percibe. La flecha del tooltip y del popover se oculta porque no comparte el `backdrop-filter` y se veía de otro tono. Todo dentro de `@supports`. El contenido y las tarjetas siguen opacos. |
| B13 | **Navegación sin saltos** | Medio | Muy bajo | Al cambiar de ruta (PUSH/REPLACE) la ventana vuelve arriba y el foco pasa a `#main-content` sin desplazarlo. En Atrás/Adelante (POP) se respeta la restauración del navegador. Corrige el caso de abrir una página a media altura tras hacer scroll. |
| B14 | **Modales premium** | Medio | Bajo | Los formularios en modal estrenan cabecera editorial: micro-label de módulo, título display, una línea de contexto y barra de señal estática. El cuerpo tiene scroll propio y el pie queda fijo, así que las acciones no se pierden en formularios largos. Anchos unificados (560 de base, 680 en Producto y 820 en Ajuste), cabecera con degradado tenue y borde de separación. El estilo se acota a `.ui-form-modal`, de modo que los demás diálogos (Terceros, Cartera, Cierres y Conciliaciones) conservan el aspecto de AntD. El modal sigue opaco y sin `backdrop-filter`: el mask ya oscurece la página. Es solo presentación; validación, teclado y cierre no cambian. |

Archivos: `AppLayout.tsx`, `HomePage.tsx`, `FinanceOverviewPage.tsx`, `index.css`,
`index.html`, `hooks/useDensity.ts` y `components/ModalHeading.tsx` (nuevos), los
nueve modales de formulario (`ProductFormModal`, `MovementFormModal`,
`UserFormModal`, `CategoryFormModal`, `ChangePasswordModal`, `AccountFormModal`,
`TransactionFormModal`, `PaymentModal` e `InvoiceAdjustmentModal`) y estos dos
documentos.

Verificación: `client npm run build` (✓ 3640 módulos; CSS 28,82 → 30,99 kB; JS
principal 165,93 → 169,13 kB por el control de densidad, los iconos y la cabecera
de los modales) y `client npm run lint` (0 errores; los 2 warnings preexistentes
de `InvoiceFormPage.tsx` se mantienen). `git diff --check` sin errores de
whitespace. Sin commit ni push hasta la aprobación explícita.

## 27. Tanda visual: profundidad, estados vacíos y tipografía

Octava tanda, sobre `c594bed`. Tres mejoras visuales sin dependencias nuevas y
sin cambios de comportamiento. El objetivo es que el panel tenga una jerarquía
de planos clara, que el vacío también hable el idioma Signal y que la tipografía
se lea como un sistema y no como estilos sueltos.

| # | Mejora | Impacto | Riesgo | Detalle |
|---|---|---|---|---|
| V1 | **Estados vacíos editoriales** | Alto | Bajo | Nuevo `EmptyState` con micro-label, título display, una línea de contexto y acción opcional. Variante `inline` para celdas de tabla y gráficos, `panel` para páginas. Se migraron 26 vacíos: los 18 `<Empty>` de AntD y 8 textos de `locale`. Se conservan todas las acciones («Limpiar filtros», «Crear el primero»). La marca son escuadras HUD y un punto de señal, estáticos: sin ilustraciones ni partículas. |
| V2 | **Profundidad en tres niveles** | Medio-alto | Bajo | `--ui-elev-0` (filo, sin sombra) para contenedores de listas y tablas; `--ui-elev-1` para tarjetas, KPIs y gráficos; `--ui-elev-2` solo para modales y superficies flotantes. Los gráficos dejan de usar la sombra larga y los contenedores de tabla se detectan con `:has()` para quedar planos. `boxShadowTertiary` de AntD queda alineado con `elev-1` en ambos temas. Si todo flota, nada flota. |
| V3 | **Escala tipográfica y cifras** | Medio | Bajo-medio | La escala pasa a tokens completos: `micro`, `caption`, `body`, `title`, `kpi` y `display`, con `clamp()` en los tres últimos para sostener el ritmo entre 360 y 1440 px. Títulos con `text-wrap: balance`, descripciones con `pretty`, tracking por tamaño y `tabular-nums` global que ya traía el `body`. Sin fuentes nuevas: se aprovechan las variables existentes. |

Archivos: `components/EmptyState.tsx` (nuevo), `styles/tokens.css`, `index.css`,
`context/ThemeContext.tsx`, `components/CategoriesPanel.tsx` y las páginas
`HomePage`, `ProductsPage`, `UsersPage`, `MovementsPage`, `QuotesPage`,
`InvoicesPage`, `ReceivablesPage`, `CarteraAlerts`, `InvoiceDetailPage`,
`FinanceOverviewPage`, `BudgetsPage`, `BudgetDetailPage`, `TransactionsPage`,
`AuditPage`, `PeriodClosuresPage`, `DataHealthPage` y `ReconciliationsPage`.

Verificación: `client npm run build` (✓ 3641 módulos; CSS 30,99 → 33,56 kB; JS
principal 169,13 → 169,21 kB) y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen). `git diff --check` sin
errores de whitespace. Sin commit ni push hasta la aprobación explícita.

## 28. Corrección: estado neutro del selector de periodo

En los listados con limpieza de rango (cotizaciones, facturas, movimientos,
cartera y auditoría), `PeriodRangePicker` pasaba `value={undefined}` al
`Segmented` de AntD cuando no había periodo. El control entraba en modo no
controlado, marcaba la primera opción («Día») aunque no hubiera fechas y, al
pulsarla, no disparaba cambio porque ya figuraba activa.

Ahora el selector es siempre controlado:

- **Sin rango y con limpieza** → «Todo» aparece como estado neutro explícito y
  limpiar el rango vuelve a él.
- **Rango personalizado** → ningún atajo queda activo; el `RangePicker` es el
  que representa la selección.
- **Reportes con periodo por defecto** → siguen mostrando su atajo (Mes, Año…),
  porque el rango sí está definido.

Archivo: `components/PeriodRangePicker.tsx`. Verificación: `build` ✓ 3641
módulos (JS 169,21 kB) y `lint` ✓ 0 errores, con los mismos 2 warnings
preexistentes.

## 29. Finanzas y reportes: seis propuestas

Última tanda sobre `f0667ab`. Se revisaron las seis propuestas contra el estado
real del código antes de implementar: la primera ya estaba hecha y la quinta
estaba casi completa. El resto se completó sin dependencias nuevas.

| # | Propuesta | Estado | Detalle |
|---|---|---|---|
| 1 | `PeriodRangePicker` compartido | Ya estaba | Presente en 13 páginas. No se tocó. |
| 2 | Rangos favoritos | Nuevo | `PeriodFavorites` guarda hasta 8 rangos exactos en `localStorage` por usuario (`ui-period-favorites:<id>`), como el tema y la densidad. Popover con aplicar, quitar y «Guardar rango actual». Aplicar un favorito crea un rango personalizado. |
| 3 | Drill-down desde tarjetas | Completo | Ingresos y Egresos abren Transacciones con `flujo=entrada` / `flujo=salida`. El filtro es de caja real: incluye compras de inventario (`activo`) y excluye asientos informativos (`afecta_caja = 0`). Se añadió el parámetro al endpoint y un control «Flujo de caja» en la barra de filtros. |
| 4 | Sparkline de 6 periodos | Nuevo | `Sparkline` dibuja una serie mínima en SVG, teñida por el tono de la tarjeta. Resumen pide `getTrends` para los 6 meses que cierran en el periodo elegido y lo muestra en Ingresos, Egresos, Capital, Utilidad, Costo de ventas y Margen bruto. Compras de inventario no tiene serie mensual y se dejó sin sparkline. |
| 5 | Exportar Resumen | Completo | `ReportExport` en Resumen con CSV/PDF de indicadores, cuentas (con totales) y desglose por categoría. Ya estaba en las otras 7 páginas de Finanzas. |
| 6 | Comparación opcional | Completo | Selector en Resumen: periodo anterior (por defecto), año anterior o sin comparación. Se guarda en la URL como `comparar=anio|ninguno`; el año anterior se calcula en cliente y no requiere backend. Tendencias ya mostraba ambas comparaciones. |

Archivos: `components/PeriodFavorites.tsx` y `components/Sparkline.tsx` (nuevos),
`components/PeriodRangePicker.tsx`, `pages/finance/FinanceOverviewPage.tsx`,
`pages/finance/TransactionsPage.tsx`, `types/index.ts`, `index.css`, y en el
servidor `finance.schema.ts`, `transactions.service.ts` y la prueba de
`tests/finance.test.ts`.

Verificación: `client npm run build` (✓ 3643 módulos; CSS 33,56 → 34,43 kB; JS
169,21 → 169,28 kB), `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen) y `server npm run typecheck`
sin errores. Sin commit ni push hasta la aprobación explícita.

## 30. Reportes: error persistente y reintento

Los reportes de Finanzas y Cartera solo avisaban del fallo con un `message.error`
temporal. Si la petición fallaba, el aviso desaparecía en segundos, no había forma
de reintentar sin recargar y la tabla o el gráfico podían seguir mostrando los datos
del rango anterior mientras el selector ya mostraba el nuevo. Resumen, además, no
descartaba respuestas obsoletas al cambiar de periodo rápido.

| # | Mejora | Detalle |
|---|---|---|
| R1 | **`LoadError` compartido** | Alerta persistente con título, detalle devuelto por la API y botón `Reintentar`. Sustituye los toasts de carga en Resumen, Resultados, Flujo de caja, Balance, Tendencias, Rentabilidad, Rotación de inventario, Embudo de cotizaciones y Cartera. |
| R2 | **Sin datos del rango anterior** | Al fallar se limpia el reporte (`null`); en Cartera se vacían la lista y el aging. El error queda visible y explica que lo mostrado no corresponde al filtro actual. |
| R3 | **`useLatestRequest`** | Secuencia de peticiones: cada carga invalida la anterior y solo la última puede escribir estado; al desmontar invalida lo que siga en vuelo. Resumen lo estrena y las demás páginas sustituyen `let cancelled` por el mismo hook. |
| R4 | **Exportación coherente** | CSV y PDF quedan deshabilitados mientras carga o hay error. Antes solo Resumen lo comprobaba; el resto dependía únicamente de que existiera `report`. |
| R5 | **Reintento sin recargar** | El botón vuelve a pedir el mismo rango y limpia el error al iniciar la carga; en Resumen reutiliza `load`, así que también refresca después de crear o eliminar una cuenta. |

Archivos: `components/LoadError.tsx` y `hooks/useLatestRequest.ts` (nuevos),
`pages/finance/FinanceOverviewPage.tsx`, `ProfitLossPage.tsx`, `CashFlowPage.tsx`,
`BalancePage.tsx`, `TrendsPage.tsx`, `ProfitabilityPage.tsx`,
`InventoryAnalyticsPage.tsx`, `QuotesFunnelPage.tsx` y
`pages/invoices/ReceivablesPage.tsx`. Sin backend ni migraciones.

Verificación: `client npm run build` (✓ 3645 módulos; CSS 34,43 kB sin cambio; JS
principal 169,28 → 169,35 kB) y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## 31. Rotación, breadcrumb y alertas

Revisión de la pantalla de Rotación y del Resumen financiero tras la tanda de
robustez. El cálculo de días tenía dos referencias mezcladas: usaba el cierre
del rango (`hasta`) incluso cuando el mes seguía abierto, así que una venta del
14 se mostraba como «hace 16 días» el día 20 de un mes que termina el 30.

| # | Mejora | Detalle |
|---|---|---|
| R6 | **Corte de días correcto** | `dias_sin_venta` y el stock muerto se miden contra hoy si el periodo sigue abierto, o contra el cierre del rango si ya terminó. La última venta también se filtra por esa fecha de corte para no tomar ventas posteriores al periodo consultado. |
| R7 | **«Productos con venta»** | La tarjeta ya no muestra una fracción confusa como `30 / 20`. Ahora el número grande es la cantidad de productos con venta y debajo se lee `45 analizados · 15 sin venta en el periodo`. |
| R8 | **Días de inventario explicados** | La columna `Días inv.` y `Rotación` tienen ayuda emergente y foco por teclado. Los días de inventario usan los días transcurridos del periodo, no el mes completo, para no inflar el resultado de un mes en curso. |
| R9 | **Un solo breadcrumb** | Se retiró el micro-label `02 / Finanzas` del Resumen: duplicaba el breadcrumb `Inicio / Finanzas` que ya genera `PageHeader`. |
| R10 | **Alertas y sugerencias** | Las alertas de AntD reciben el lenguaje Signal: rail de acento, icono en chip, fondo teñido y texto con contraste. Las sugerencias del presupuesto dejan la lista de `Alert` y pasan a `SuggestionList`, con severidad, icono y referencia de la línea. |

Archivos: `server/src/modules/finance/reports.service.ts`,
`server/tests/inventory-analytics.test.ts`,
`pages/finance/InventoryAnalyticsPage.tsx`, `pages/finance/FinanceOverviewPage.tsx`,
`components/SuggestionList.tsx` (nuevo) e `index.css`. Sin migraciones.

Verificación: `client npm run build` (✓ 3646 módulos; CSS 34,43 → 37,05 kB por
los estilos de alertas y sugerencias; JS principal 169,35 kB), `client npm run lint`
(0 errores), `server npm run typecheck`, `server npm run lint` y
`server npm test -- inventory-analytics.test.ts` (4 pruebas, incluida la de un
periodo abierto que no debe sumar días futuros).

## 32. Movimientos: robustez y avisos del modal

El historial conservaba un patrón de carga propio con `let ignore`: el fallo solo
dejaba un toast de tres segundos, la tabla y los totales seguían mostrando el
filtro anterior y el botón de exportación permanecía activo durante la carga. En
el modal, dos problemas reales: el confirm de presupuesto se reabría porque el
flag se leía del render anterior, y el operador nunca veía avisos financieros
porque esas rutas son de admin/contador/consulta y los `.catch(() => {})` lo
ocultaban.

| # | Mejora | Detalle |
|---|---|---|
| M1 | **Carga como los reportes** | `MovementsPage` usa `useLatestRequest` en lugar de su flag local. Al fallar se vacían filas, total y resumen, se muestra `LoadError` con `Reintentar` y la tabla se oculta; no quedan cifras huérfanas de otro filtro. |
| M2 | **Exportación coherente** | El botón propio de CSV se sustituye por `ReportExport`: CSV y PDF desde un mismo `ReportDocument`, deshabilitado mientras carga, con error o sin resultados. Los importes se omiten para roles sin acceso a costos. |
| M3 | **Ayuda accesible** | Las once cabeceras usan `ColumnTitle` con `.ui-column-help` y `tabIndex={0}`, igual que Rotación. Los `Select` tienen nombre accesible y el resumen es `role="status" aria-live="polite"`. El tooltip de `Costo unitario` ya no promete un histórico que la consulta obtiene con `COALESCE`. |
| M4 | **Confirm sin recursión** | `submit(confirmed, confirmedGasto)` recibe el flag y el monto como argumentos; el `onOk` del confirm ya no depende del closure ni puede reabrirse. Si el monto cambia mientras el diálogo está abierto, vuelve a pedir confirmación. |
| M5 | **Avisos honestos según el rol** | El operador ve una nota que explica que las validaciones financieras se aplican al guardar, en lugar de una llamada 403 silenciosa. Para roles con acceso financiero, un fallo al consultar presupuesto/periodo muestra una alerta con reintento en vez de ocultarse. No se ampliaron permisos ni se expusieron importes al operador. |

Archivos: `pages/MovementsPage.tsx` y `components/MovementFormModal.tsx`. Sin
backend, sin dependencias nuevas y sin migraciones.

Verificación: `client npm run build` (✓ 3646 módulos; CSS 37,05 kB sin cambio;
JS principal 169,35 → 169,37 kB y chunk de Movimientos 11,64 kB por el
documento de exportación) y `client npm run lint` (0 errores; los 2 warnings
preexistentes de `InvoiceFormPage.tsx` se mantienen).

## 33. Movimientos: búsqueda literal, límites y trazabilidad

Cierre de la deuda de fondo del módulo. La búsqueda trataba `%` y `_` como
comodines, un `pageSize` compartido por URL podía superar el máximo del esquema
y los movimientos eran la única operación de stock que no dejaba rastro en la
bitácora append-only.

| # | Mejora | Detalle |
|---|---|---|
| M6 | **`pageSize` acotado** | `getPositiveInt` acepta un máximo opcional y Movimientos lo usa con 100, el mismo límite del esquema del servidor. Un enlace compartido con `pageSize=500` ya no provoca un 400. |
| M7 | **Comodines literales** | Nuevo `escapeLike` en `utils/sql.ts`: escapa `\`, `%` y `_`, y la consulta usa `LIKE ? ESCAPE '\\'`. Buscar `50%` ya no devuelve todo el historial. |
| M8 | **Trazabilidad de stock** | Cada movimiento escribe `audit_log` con entidad `stock_movement`, acción `crear`, stock anterior/posterior, tipo, origen, cantidad y documento. Se registra dentro de la misma transacción, así que un rollback por periodo cerrado no deja auditoría huérfana. El visor de auditoría ya etiqueta la entidad como «Movimiento». |
| M9 | **Pruebas de regresión** | Seis pruebas nuevas: paginación con `total` y rechazo de `pageSize` inválido, combinación de filtro+rango+orden, ocultamiento de importes e ignorar `sort=costo` para el operador, búsqueda con `%`/`_` literales, rollback con periodo cerrado y rastro de auditoría. |

Archivos: `server/src/utils/sql.ts`, `server/src/modules/movements/movements.service.ts`,
`server/src/modules/finance/finance.shared.ts`, `server/src/modules/audit/audit.schema.ts`,
`server/tests/movements.test.ts`, `client/src/hooks/useUrlFilters.ts`,
`client/src/pages/MovementsPage.tsx`, `client/src/types/index.ts` y
`client/src/pages/finance/AuditPage.tsx`. Sin migraciones: `audit_log` ya admite
la entidad nueva.

Verificación: `server npm run typecheck`, `server npm run lint`,
`server npm test` (38 archivos, 241 pruebas; antes 235), `client npm run build`
(✓ 3646 módulos; CSS 37,05 kB sin cambio; JS principal 169,37 kB) y
`client npm run lint` (0 errores; los 2 warnings preexistentes se mantienen).

## 34. Bento de Inicio y formato de cotización/factura

El Inicio repetía filas uniformes de cuatro KPIs y dos bloques de gráficos con
el mismo peso visual. Las hojas de cotización y factura ya compartían cabecera,
pero el contenido era una sucesión de bloques sin jerarquía: cliente, tabla y
total parecían piezas sueltas. Se pidió un grid innovador y un formato de
documento más distintivo, sin perder impresión en A4 ni accesibilidad.

| # | Mejora | Detalle |
|---|---|---|
| D1 | **Bento de KPIs** | Nueva rejilla `.ui-bento`: «Movimientos hoy» pasa a ser tarjeta de pulso de dos filas con sparkline de los últimos 7 días (serie ya presente en el payload), mientras los otros cuatro KPIs se reparten en parejas. La cascada de entrada y el foco se mantienen. |
| D2 | **Paneles en 7/5** | Los gráficos ya no usan `Row`/`Col` de doce columnas: un único bento alterna flujo `7` / estados `5` y top productos `5` / stock bajo `7`, con el historial a todo el ancho. A partir de 1200 px el bento de KPIs pasa a 2+2+2 y en móvil todo se apila. |
| D3 | **Cabecera de documento** | `PrintHeader` acepta un `summary` opcional y dibuja una cinta de tres métricas (ítems, unidades y vigencia/referencia) con `role="group"`. El número de documento toma forma de ticket con dos muescas, sin degradados ni imágenes nuevas. |
| D4 | **Secciones numeradas** | Nuevo `PrintSection`: índice monoespaciado, micro-label y un filo que agota el ancho. Cliente, Ítems, Totales, Condiciones y Firmas comparten el mismo ritmo en cotización y factura; las notas quedan como calle lateral. |
| D5 | **Totales y papel** | El neto a pagar se separa en una caja con fondo propio, los viñetas de condiciones toman el acento y `.print-document` fija `print-color-adjust: exact`. La hoja sigue siendo clara en modo oscuro, respeta `@page A4` y evita cortar secciones, totales y filas. |

Archivos: `pages/HomePage.tsx`, `components/print/PrintHeader.tsx`,
`components/print/PrintSection.tsx`, `pages/quotes/QuotePrintPage.tsx`,
`pages/invoices/InvoicePrintPage.tsx` e `index.css`. Sin dependencias nuevas,
sin backend y sin migraciones.

Verificación: `client npm run build` (✓ 3647 módulos; CSS 37,05 → 41,20 kB;
JS principal 169,37 → 169,41 kB; chunks de impresión 5,12 y 6,04 kB) y
`client npm run lint` (0 errores; los 2 warnings preexistentes de
`InvoiceFormPage.tsx` se mantienen). No se tocaron las pruebas del servidor.

## 35. Formularios de cotización y factura

Los dos formularios eran pilas de `Card` con `Space` que se reordenaban solo
según el ancho: en factura, las líneas se volvían ingobernables en móvil, los
totales quedaban lejos de los botones y los errores del servidor solo aparecían
en un toast. Se pidió un patrón compartido para ambos y correcciones de UI/UX.

| # | Mejora | Detalle |
|---|---|---|
| E1 | **Cabecera y secciones** | `PageHeader` con eyebrow y descripción, más `FormSection` numerado: «Cliente y vigencia / Notas / Ítems / Resumen» en cotización y «Datos generales / Notas / Cuenta / Ítems / Retenciones y totales» en factura. Cada bloque tiene título `h2`, índice decorativo y una línea de contexto; las ayudas existentes de cada campo se conservan. |
| E2 | **Líneas como tarjetas** | `.ui-doc-lines` sustituye al `Space` de cada fila: cabecera de columnas en escritorio y tarjeta de dos columnas bajo 1200 px, con el producto y el total a todo el ancho. El botón de quitar línea tiene `aria-label` numerado y el indicador de stock/entrega sigue en su propia celda. |
| E3 | **Totales y barra fija** | `DocumentTotals` agrupa subtotal, descuento, IVA, retenciones y neto con `role="group"`; `DocumentFormFooter` mantiene guardar/cancelar y el importe visible al hacer scroll. El estado «Cambios sin guardar / Sin cambios pendientes» se anuncia con `role="status"`, sin depender solo del color. |
| E4 | **Errores junto al campo** | `utils/formErrors.ts` traduce los `issues` de Zod del middleware (`{ message, errors: [{ path, message }] }`) a `form.setFields` y limpia los anteriores antes de enviar. El toast conserva el mensaje general; el campo afectado queda marcado. |
| E5 | **Limpieza** | Se eliminaron estilos en línea y el `theme.useToken()` de la factura, se movió `DEFAULT_RETENCIONES` a ámbito de módulo y se añadió `message` a las dependencias del efecto de cuentas: desaparecen los 2 warnings de `react-hooks/exhaustive-deps`. La lógica de precios, stock, cotizaciones vinculadas, retenciones y borradores queda intacta. |

Archivos: `components/form/FormSection.tsx`, `components/form/DocumentTotals.tsx`,
`components/form/DocumentFormFooter.tsx`, `utils/formErrors.ts`,
`pages/quotes/QuoteFormPage.tsx`, `pages/invoices/InvoiceFormPage.tsx` e
`index.css`. Sin dependencias nuevas, sin backend y sin migraciones.

Verificación: `client npm run build` (✓ 3651 módulos; CSS 41,20 → 45,95 kB;
JS principal 169,41 → 169,22 kB) y `client npm run lint` (0 errores y 0
warnings: los 2 preexistentes de `InvoiceFormPage.tsx` quedan resueltos). No se
tocaron las pruebas del servidor.

## 36. Factura empresarial, legible y con datos fiscales (Art. 617)

El formulario cumplía la contabilidad, pero no se leía como una factura: seis
secciones desplegadas, cuatro avisos, una tabla de siete columnas y un panel
lateral con tres tarjetas que repetían datos. Se pidió una captura sencilla y
legible, sin perder los datos obligatorios del Art. 617. La solución fue **quitar**
información, no agregarla.

| # | Mejora | Detalle |
|---|---|---|
| F1 | **Tres bloques en vez de seis secciones** | `01 Encabezado` (tipo, fecha/hora, adquirente, forma y medio de pago), `02 Productos` y `03 Totales`. Notas, orden de compra, email, cuenta, retenciones y resolución pasan a «Más opciones», plegado por defecto. Desaparecen el aviso de borrador y las explicaciones largas de descuento y cotización. |
| F2 | **Líneas de cuatro columnas** | Producto, Cantidad, Precio y Total línea. Descripción facturada, descuento, IVA, unidad, INC y otro tributo se abren con «Detalles» por línea (`aria-expanded`); las cuatro acciones se resumen en un menú `⋯`. El semáforo de stock y el estado de cotización entregada se muestran dentro del detalle. |
| F3 | **Un solo resumen** | `DocumentTotals` muestra Subtotal y solo las filas con valor (descuento, IVA, INC, otros, retenciones), más Total y Neto cuando aplica. Se eliminan el rail lateral, su resumen tributario y el total duplicado en el footer. |
| F4 | **Datos fiscales sin estorbar** | Hora actual de Bogotá (UTC-5) e IVA 19 % precargados; resolución y rango reutilizados de la última factura del mismo tipo guardada en este navegador. Un único aviso discreto indica `Faltan N datos fiscales para poder confirmar`, abre «Más opciones» y lleva el foco al primer campo. El cumplimiento sigue garantizado en el snapshot y en `assertFiscalComplete`. |
| F5 | **Borrador y atajos sin panel** | `Ctrl+S` guarda en `localStorage` y `Ctrl+Enter` envía; el acceso ahora es un botón «Borrador local» en el footer, con la hora del último guardado en el tooltip. Se mantienen `onFinishFailed` con foco al primer error y el mapeo de errores de Zod. |
| F6 | **Captura y papel consistentes** | `InvoicePrintPage` incorpora hora, resolución, rango, condición/medio de pago, vencimiento, descripción por línea y desglose IVA/INC/otros; las secciones impresas se numeran 01–06. |
| F7 | **Persistencia con snapshot** | Migración `V031__datos_fiscales_factura.sql`: campos nuevos en cabecera e ítems, contador por `(tipo, prefijo)`, backfill de facturas antiguas e índice por prefijo. `invoices.shared.ts` separa IVA/INC/otros sin alterar los asientos de IVA; `resolveFiscal` completa integraciones antiguas y `assertFiscalComplete` bloquea confirmar sin datos fiscales. |

Archivos: `migrations/V031__datos_fiscales_factura.sql`,
`modules/invoices/{invoices.schema,invoices.shared,invoices.service}.ts`,
`tests/invoices.test.ts`, `types/index.ts`,
`components/form/DocumentFormFooter.tsx`, `pages/invoices/InvoiceFormPage.tsx`,
`pages/invoices/InvoicePrintPage.tsx`, `index.css` y estos documentos. Sin
dependencias nuevas, sin CUFE/firma/transmisión a la DIAN: el alcance es captura
y representación gráfica de los datos exigidos por el Art. 617.

Verificación: `server npm run typecheck` y `server npm run lint` sin errores;
`server npm test` (243 pruebas, 38 archivos, en verde: RF-08b valida el snapshot
fiscal y RF-08c el límite del rango); `client npm run build` (✓ 3651 módulos;
CSS 49,03 → 47,50 kB; JS principal 169,27 kB sin cambio; bundle de la factura
34,18 → 28,68 kB) y `client npm run lint` (0 errores y 0 warnings). Sin commit
ni push hasta la aprobación explícita.

## 37. Controles sobrios en los formularios de documento

Después de simplificar la factura seguían compitiendo en pantalla tres estilos
de sección con borde y sombra, seis tipos de botón y tooltips que repetían la
etiqueta. La petición fue ajustar el UI de inputs, botones y secciones sin meter
campos nuevos: bajar el peso visual, no subirlo.

| # | Mejora | Detalle |
|---|---|---|
| G1 | **Secciones como documento** | `FormSection` pierde la tarjeta: una regla superior, número en mono sin chip, título en display y descripción de una línea. Cotización y factura comparten el mismo ritmo; las secciones de §35 pasan a ser bloques, no widgets. |
| G2 | **Botones con tres niveles** | Guardar (primario), Cancelar (secundario) y acciones en texto. «Agregar línea» deja de ser `dashed` y usa `type="link"` con `+`. Etiquetas cortas: «Guardar», «Borrador», «Completar datos», «Sin guardar / Guardado». |
| G3 | **Etiquetas que bastan** | AntD marca lo obligatorio con `*`; los opcionales llevan un sufijo gris «opcional». Se eliminan los tooltips redundantes de ambos formularios y los placeholders que repetían la etiqueta. Se conserva solo el huso horario de Bogotá en la hora de expedición. |
| G4 | **Cifras uniformes** | Los `InputNumber` del formulario alinean el valor a la derecha; los de dinero mantienen un solo `$` (el del `formatter` compartido). El resumen `DocumentTotals` también pierde su caja: ahora es una lista con el total subrayado y el neto en acento. |

Archivos: `components/form/{FormSection,DocumentFormFooter}.tsx`,
`pages/quotes/QuoteFormPage.tsx`, `pages/invoices/InvoiceFormPage.tsx` e
`index.css`. Sin dependencias nuevas, sin backend y sin cambios de validación,
payload ni atajos.

Verificación: `client npm run build` (✓ 3651 módulos; CSS 47,50 → 47,31 kB;
JS principal 169,27 kB sin cambio; bundle de la factura 28,69 → 28,57 kB) y
`client npm run lint` (0 errores y 0 warnings). Sin commit ni push hasta la
aprobación explícita.

## 38. La factura se edita como un documento

Ajustar inputs y botones no fue suficiente: la pantalla seguía leyéndose como un
formulario con secciones, no como una factura. Se pidió quitar títulos y
subtítulos, eliminar el aspecto de cajas de entrada y editar directamente el
formato del documento, con criterio profesional. El primer acercamiento con una
hoja enmarcada se descartó por parecer un bloque empaquetado; la grilla plana
quedó revisada en pantalla y también resultó insuficiente: sin pistas visuales
solo mostraba etiquetas pequeñas y campos casi invisibles.

| # | Mejora | Detalle |
|---|---|---|
| H1 | **Cabecera de factura** | `.ui-invoice-head` reúne la identidad del emisor (logo compacto, NIT, régimen, dirección y contacto) y, a la derecha, el título «Factura de venta/compra», el número y la terna tipo/fecha/hora. Tiene 3 px de acento superior, no una cabecera grande ni una hoja encerrada. |
| H2 | **Datos en dos filas de documento** | «Facturar a» y «Condiciones» son dos filas con rótulo a la izquierda y una retícula interna de dos columnas. Los campos se leen con etiqueta fija y valor con línea inferior a la derecha, a 30 px de alto; los vacíos muestran placeholders (`NIT / Cédula`, `correo@empresa.com`, `Sin cotización`). Así el bloque deja de ser una columna larga con un vacío al lado. |
| H3 | **Tabla numerada** | Columnas # · Descripción · Cant. · Precio unit. · Desc. % · IVA % · Total, con separadores finos, cabecera con fondo suave y total en color de marca. Los valores van a 13 px con cifras tabulares; «Detalle» abre un panel con descripción facturada, unidad, INC, otro tributo y semáforo de stock; «Agregar línea» es una banda con icono y numeración; el menú `⋯` conserva mover, clonar y quitar. |
| H4 | **Resumen y pie** | Notas a la izquierda y resumen a la derecha; el total final sube a 22 px, el subtotal aparece siempre y las cifras usan ancho fijo. Resolución y contabilidad usan el mismo patrón de rótulo + celdas que el resto. Los avisos reales son una línea de texto, no tarjetas. |
| H5 | **Barra flotante compartida** | La factura usa el mismo `DocumentFormFooter` que la cotización: barra `sticky` al borde inferior, redondeada, translúcida y con sombra, filo de marca y total siempre a la vista. A la izquierda, «Nueva factura» o el número, el estado «Guardado / Sin guardar», el aviso fiscal, borrador, cancelar y guardar; a la derecha, el total y el neto. La cabecera recupera su acento superior de 3 px. La lógica de precarga, errores de Zod, atajos, borradores y validación del Art. 617 no cambia. |

Archivos: `components/ProductSelect.tsx`,
`components/form/DocumentFormFooter.tsx`,
`pages/invoices/InvoiceFormPage.tsx` e `index.css`. Sin dependencias nuevas,
sin backend y sin cambios de payload. La barra es compartida: la factura la
alimenta con contexto, aviso fiscal y borrador local; la cotización conserva su
formulario y gana el mismo acabado visual.

Una segunda revisión midió el DOM renderizado: la etiqueta de «Facturar a»
heredaba la dirección vertical de AntD y cada campo ocupaba 142 px; además las
columnas numéricas (70 px) eran más angostas que el `InputNumber` (90 px). Se
fijó la fila horizontal, se normalizaron los controles a 30 px, la tabla pasó a
columnas de 84–120 px y el bloque de datos se dividió en dos filas con retícula
interna de dos columnas.

Una tercera pasada densificó el documento: cabecera 166 → 148 px, bloque de
datos 222 → 210 px, tabla 129 → 119 px, resumen 117 → 106 px y pie 220 →
198 px. El conjunto pasó de 854 a 781 px y cabe completo en una ventana de
1005 px de alto. El foco añade una segunda línea sin desplazar el texto y los
importes usan `tabular-nums`.

Una cuarta pasada repartió el espacio y robusteció el módulo. El documento pasa
de 1040 a 1180 px y el margen del contenedor de 24 a 8 px solo en esta ruta, así
que la hoja aprovecha el ancho disponible sin tocar el resto de la app. Los
botones de la barra bajan de 38 a 32 px, «Cancelar» y «Guardar» llevan icono y
el primario conserva el ancho mínimo; el atajo se anuncia en su tooltip. Todas
las acciones en línea («Completar», «+ Detalle», «+ Agregar línea») son
`Button` de AntD, con el mismo foco y la misma accesibilidad que el resto de la
interfaz.

La misma pasada ajustó la lectura: rótulos de fila a 11 px, etiquetas de campo a
12 px, valores de tabla a 14 px con cifras tabulares, cabecera de 11 px, total
final a 24 px y texto legal a 11 px. La tabla destaca la celda de total; «+
Agregar línea» gana área de pulsación. El pie mantiene sus cinco columnas con
etiqueta apilada: probar con tres columnas duplicaba su altura sin ganar
legibilidad. El conjunto mide 858 px y cabe en un viewport de 1005 px de alto.

Funcionalmente, el botón «Guardar» estaba fuera del `<form>` y su
`htmlType="submit"` no enviaba nada: al mover la barra dentro de `Form`, la
validación vuelve a ejecutarse al hacer clic. El atajo se registra una sola vez,
`Ctrl+Enter` no duplica el envío mientras se guarda, el detalle de cada línea
sigue abierto al reordenar (se identifica por la clave de `Form.List`), cambiar
de producto refresca la descripción snapshot solo si el usuario no la editó, y
los días de crédito calculan la fecha de vencimiento sobre la fecha de factura.

Una quinta pasada afinó los últimos detalles de la tabla y del header. Se quitó
el sombreado par/impar de las líneas: ahora todas comparten el mismo fondo y
solo la fila bajo el puntero se marca con un acento teal de 2 px a la izquierda.
Los `InputNumber` ocultan las flechas de subir/bajar —en AntD v6 viven en
`.ant-input-number-actions` y en v5 en `.ant-input-number-handler-wrap`—, liberan
el hueco que reservaban y dejan las cifras alineadas a la derecha con 2 px de
padding. Los botones dejan de ser estáticos: transición de elevate y presión en
la barra flotante y en el header de la app, foco visible con `outline` y un
barrido animado bajo la barra mientras `data-saving` está activo. El punto del
estado «Sin guardar» late suavemente; todo se apaga con
`prefers-reduced-motion`.

Una sexta pasada sustituyó la barra superior por la flotante de cotizaciones. Se
retiró `.ui-invoice-toolbar` y su CSS, se devolvió a `.ui-invoice-head` el borde
superior de 3 px y se adaptó `DocumentFormFooter` con `eyebrow` y `notice` para
que la factura muestre el número, el aviso fiscal y el borrador sin ocupar la
primera fila del documento. La barra queda `sticky` abajo, con 14 px de radio,
desenfoque de fondo, sombra proyectada, filo degradado y el total en tipo de
visualización; el botón primario conserva su sombra de marca. En móvil ambos
bloques pasan a ancho completo. `scrollToField` reserva 92 px para el header de
la app ahora que no hay barra fija arriba.

La séptima pasada trabajó los dos controles de la tabla. «+ Detalle» dejó de ser
un enlace de 10 px pegado al selector: ahora es una pastilla AntD de 22 px con
chevron que gira al abrir, borde de marca cuando está desplegado y un punto ámbar
cuando la línea guarda descripción, unidad distinta de `UND`, INC u otro
impuesto. El botón informa `aria-expanded` y `aria-controls` sobre el panel. Ese
panel pasó de una tira flexible de campos de 90/190 px a una retícula de seis
columnas con anchos jerarquizados (descripción y «Otro impuesto» más amplios),
borde de marca a la izquierda y animación de entrada; en pantallas estrechas se
reduce a dos columnas. «+ Agregar línea» es ahora una banda AntD `dashed` de
40 px con icono en círculo y una píldora que anuncia el número de la fila nueva.

La octava pasada se centró en los campos. Los porcentajes de descuento, IVA,
INC y otro impuesto llevan el sufijo `%` dentro del propio control y los días de
crédito el sufijo `días`, para que el valor se entienda sin leer la cabecera de
la columna. Los campos de texto opcionales ganaron borrado rápido —visible solo
al pasar el ratón o enfocar— y los de razón social y correo traen `autocomplete`
y `inputMode` adecuados. Las notas y la descripción facturada muestran contador
de caracteres. El foco ya no es solo un cambio de color: línea de marca de 2 px,
fondo apenas teñido y un halo corto que no desplaza el texto; el error tiñe el
campo de rojo y añade una insignia `!` al mensaje, y los campos inactivos usan
línea discontinua. Como AntD inyecta sus estilos al final de `<head>`, las reglas
de estado llevan el prefijo `.ui-invoice-editor` para ganar por especificidad sin
depender del orden. En las filas de documento, donde el asterisco está oculto,
un punto de marca señala los campos obligatorios. Se quitó el `initialValue`
duplicado de `dias_credito` que AntD avisaba al pasar a crédito.

La novena pasada ordenó el espaciado y convirtió la edición en una hoja
imprimible. El documento usa tres tokens locales —sangría, celda vertical y
separación horizontal— compartidos por cabecera, datos, tabla, cierre y pie; así
la retícula no depende de valores sueltos. La tabla conserva la cabecera fija
bajo el header de la app (`top: 78px`), resalta la celda con foco y muestra un
semáforo de stock en la propia fila, sin exigir abrir «Detalle». «Agregar línea»
acepta `Alt + Enter` y lleva el foco al buscador de producto, con el atajo
visible en la banda. La factura siempre mantiene el panel de detalle en el DOM:
en pantalla sigue plegado, pero al imprimir se despliega para que la
descripción facturada viaje en el documento. La barra flotante añadió «Imprimir»
y el CSS de impresión oculta menú, header, barra y controles, convierte los
campos en texto sin borde y respeta `@page { size: auto }` para carta o A4 según
el papel elegido en el navegador.

Verificación: `client npm run build` (✓ 3651 módulos; CSS 47,31 → 75,05 kB;
JS principal 169,27 → 187,94 kB; bundle de la factura 28,57 → 31,43 kB) y
`client npm run lint` (0 errores y 0 warnings). La pantalla se revisó en Chrome
con una sesión local de prueba: geometría de la barra y del documento, botón
«Guardar» dentro del formulario con errores de validación al pulsarlo y barra
fija al desplazarse. En la última revisión se comprobó sobre el DOM que no queda
zebra, que las nueve flechas numéricas tienen `display: none`, que las cifras
están a la derecha y que un movimiento real del mouse eleva el botón 1 px y
marca la fila con el acento lateral. La barra flotante se midió en el DOM:
`position: sticky`, `bottom: 0`, radio de 14 px, desenfoque de 14 px, pegada al
borde inferior al aparecer errores de validación; los tres botones siguen dentro
del `<form>` y «Guardar» conserva `type="submit"`. En la última revisión se abrió
el panel de detalle sobre el DOM: seis columnas, cinco rótulos y sin
desbordamiento horizontal; al agregar una línea el número pasó de 2 a 3 y el
panel abierto se conservó. En la última pasada se midió el foco real con
emulación de CDP: borde `rgb(15, 118, 110)`, halo de dos capas, fondo teñido y
botón de borrado visible; al validar, los seis campos con error mostraron borde
`rgb(190, 18, 60)` e insignia. Los cinco sufijos (`días` y cuatro `%`) aparecen
al abrir el detalle y elegir crédito, el panel sigue sin desbordarse y la
consola queda sin errores. La última comprobación midió el espaciado con los
tokens del documento, confirmó `Alt + Enter` con foco real en `.ant-select-input`
y verificó que no hay desbordamiento horizontal. La factura se imprimió desde
Chrome con producto, cantidad, descripción y datos fiscales: una sola página,
sin menú ni barra flotante, con el detalle desplegado y la consola limpia. Sin
commit ni push hasta la aprobación explícita.

## Ruta sugerida

1. **Quick wins (1–2 días):** H1, H2, N1, N2, N3, G3, F1, F3 y textos de ayuda.
2. **Consistencia (2–3 días):** G1, G4, P1, P3, M3, F5, N5, N6.
3. **Formularios (3–5 días):** Q2, Q3, F2, F6, N8.
4. **Estructural (3–5 días):** Q1, Q4, Q6, F4, H3, N9.
