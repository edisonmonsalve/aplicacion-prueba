# Sistema visual Signal

Dirección de diseño para la mejora global de UI/UX. Objetivo: un dashboard empresarial
con energía de HUD de videojuego, sin caer en la fatiga visual.

## 1. Concepto

**Signal = datos como señal.** La interfaz se comporta como un panel de control: etiquetas
técnicas breves, lecturas numéricas precisas, estados luminosos y una jerarquía muy clara.
El fondo es cálido y neutro (minimalismo cálido) y el color se reserva para lo que importa
(vibrante). Es atrevido en la forma y sobrio en el uso del color.

### Principios anti-fatiga

1. El color ocupa **menos del 10 %** de la superficie: acentos, no rellenos.
2. El texto de lectura (descripciones, celdas) **nunca** va coloreado; solo los valores.
3. El glow aparece **únicamente** en estados activos o interactivos.
4. Como máximo **un degradado protagonista** por pantalla.
5. Las texturas de cuadrícula son casi invisibles (opacidad ≤ 5 %).
6. Todo movimiento es corto (140–220 ms) y respeta `prefers-reduced-motion`,
   incluidas las animaciones SVG de Recharts.

## 2. Paleta

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| Lienzo | `#f6f5f2` | `#0d1413` | Fondo general, cálido |
| Superficie | `#ffffff` | `#131e1c` | Tarjetas y tablas |
| Tinta | `#16201e` | `#e8f1ef` | Títulos y valores |
| Tinta secundaria | `#5b6b67` | `#9db3ae` | Etiquetas, ayudas |
| Tinta terciaria | `#485954` | `#b7c9c4` | Placeholders, sufijos y atajos (sin opacidad) |
| Línea | `#e6e9e5` | `#243631` | Bordes y divisores |
| Marca (teal) | `#0d9488` | `#2dd4bf` | Primario, enfoque, activo |
| Cítrico | `#f59e0b` | `#fbbf24` | Salida de caja, advertencia, stock bajo |
| Coral | `#fb7185` | `#fb7185` | Egreso, error, negativo |
| Eléctrico | `#38bdf8` | `#38bdf8` | Información, movimientos |
| Violeta | `#a78bfa` | `#a78bfa` | Destacado / insight |

Cada señal tiene un par `acento` + `ink`: el acento tiñe barras, iconos y glow;
el `ink` (más oscuro en claro, más claro en oscuro) tiñe la **cifra** y cumple AA.

> Nota: los hex sueltos quedan centralizados en `styles/tokens.css` y replicados en
> `ConfigProvider` para que AntD y el CSS no se desincronicen. Desde JavaScript se
> usan las referencias de `styles/signal.ts` (`signal.positive`, `signal.brand`, …):
> así cifras, SVG y gráficos siguen el mismo token sin duplicar hexadecimales.
> La paleta de impresión (`PrintThemeProvider`, `reportExport`) es fija a propósito:
> el papel no cambia de tema.

### Semántica de negocio en los KPI

La cifra vuelve a ser la señal. No se usa un color genérico por "éxito/error",
sino el significado contable de cada indicador:

| Tono `StatCard` | Significado | Cifra |
|---|---|---|
| `income` | Ingreso, utilidad positiva, saldo a favor | verde |
| `expense` | Egreso de caja, costo, utilidad negativa | coral |
| `outflow` | Salida de caja que es activo (compras) o IVA a pagar | ámbar |
| `primary` | Capital, saldo, magnitud neutral de marca | teal |
| `info` | Movimientos, porcentajes, información | eléctrico |
| `violet` | Valoración / insight | violeta |

`success`, `warning` y `danger` se conservan como alias para pantallas antiguas.

## 3. Tipografía

- **Interfaz / cuerpo**: `Plus Jakarta Sans Variable` (ya en uso).
- **Display y cifras**: `Space Grotesk Variable` — títulos de página, KPIs y totales.
  Es más angulosa y técnica que Jakarta; crea personalidad sin perder legibilidad.
- **Micro-label**: 10–11 px, 700, mayúsculas, `letter-spacing: .14em` (estilo HUD).
- **Cifras**: `tabular-nums`, tracking negativo (`-.04em`) y peso 700.

Los tamaños viven en una escala compartida en `tokens.css`: `--ui-text-micro`
(10.5 px), `--ui-text-caption` (12 px), `--ui-text-body` (14 px),
`--ui-text-title` (18–22 px), `--ui-text-kpi` (22–28 px) y `--ui-text-display`
(24–30 px). Los tres últimos usan `clamp()` para que el ritmo se mantenga entre
360 y 1440 px sin saltos. El `body` usa `--ui-font` con `font-optical-sizing:
auto` y `tabular-nums`; los títulos usan `text-wrap: balance` y las descripciones
`text-wrap: pretty`. El display y los KPIs afinan el optical sizing para que los
extremos de la variable no se vean ni apretados ni diluidos.

Regla: Jakarta para *explicar*, Space Grotesk para *anunciar*.

## 4. Formas y shapes

- Escala de radio corta y única: **4** etiquetas y `kbd`, **8** deltas, tooltips
  e iconos pequeños, **14** tarjetas y botones, **16** tarjetas grandes y
  **999** píldoras. La forma la dan el radio y las escuadras de los KPIs, sin
  `clip-path` en índices ni chips.
- KPI con **barra superior degradada** y **escuadra** en la esquina superior derecha.
- `status pip`: punto de 6 px con halo suave para estados activos.
- Barras de progreso **segmentadas** (estilo barra de vida) en metas y cartera.
- Rejilla de 28 px en el sidebar y atmósfera por capas en el contenido: celda
  ancha de 56 px enmascarada hacia el centro, celda fina de 28 px con foco
  radial y viñeta del 5 %. Ninguna capa pasa del 5 % de opacidad.
- Sider: índice monoespaciado y barra de 3 px en el item activo; sin rail de
  grupo ni cabeceras fijas. Finanzas son 3 hojas iconadas (Resumen, Reportes y
  Gestión); cada sección se navega con pestañas dentro de la página.
- Profundidad de datos: `--ui-shadow-deep` + `--ui-inset` (doble sombra y filo
  interior claro) en `.ui-deep-surface` y `.ui-chart-card`, con halo radial en
  `::before` y dos escuadras HUD en `::after`. No es contenido ni añade movimiento.
- **Profundidad en tres niveles**: `--ui-elev-0` (filo, sin sombra) para
  contenedores de listas y tablas, `--ui-elev-1` para tarjetas, KPIs y gráficos,
  y `--ui-elev-2` solo para modales y superficies flotantes. Si todo flota, nada
  flota: la jerarquía se lee antes de pensar.
- **Bento** en Inicio y Resumen: en Inicio, una sola rejilla de seis columnas
  con el KPI de pulso ocupando dos filas y sparkline, los otros cuatro en
  parejas, y los paneles alternando `7/5` y `5/7` con el historial a todo el
  ancho; a 1200 px pasa a 2+2+2 y en móvil se apila. Finanzas mantiene sus dos
  secciones de KPIs en columnas `12` desde `lg`. El resto de páginas conserva
  la rejilla uniforme.
- **Glass quirúrgico** solo en superficies que flotan sobre contenido (dropdowns,
  popovers, selects, calendarios y tooltips): `backdrop-filter: blur(6px)
  saturate(1.15)` sobre un 62 % de superficie (66 % en el tooltip oscuro). Los
  modales quedan fuera: su mask a pantalla completa ya oscurece la página y no
  hay fondo reconocible que difuminar. Estas superficies no proyectan sombra:
  el vidrio se distingue por el fondo y el filo. Tooltips y popovers ocultan la
  flecha, que no comparte el desenfoque. El contenido y las tarjetas siguen opacos.
- **Modales de formulario** con cabecera editorial: micro-label, título display
  y una línea de contexto, precedidos por una barra de señal estática (no late
  dentro de un diálogo). El cuerpo tiene scroll propio y el pie queda fijo, de
  modo que las acciones no se pierden en formularios largos. Anchos unificados:
  560 para formularios de una o dos columnas, 680 cuando hay panel lateral y 820
  para el ajuste de factura. Todo se acota a `.ui-form-modal`, así que los demás
  diálogos conservan el estilo de AntD. El modal sigue opaco.

## 5. Movimiento

| Interacción | Duración | Curva |
|---|---|---|
| Hover de tarjeta | 220 ms | `cubic-bezier(.2,.8,.2,1)` |
| Hover de botón / fila | 140 ms | `ease-out` |
| Entrada de skeleton | 180 ms | shimmer, una sola pasada |
| Entrada escalonada de KPI | 420 ms + 60 ms por columna | `--ui-ease` |
| Conteo de cifras | 620 ms | `ease-out` cúbico |
| Atmósfera / pip / barra | 14–26 s, 2,6 s, 2,8 s | respiración, no distracción |
| Cambio de tema | 0 ms | se desactivan transiciones (anti-parpadeo) |
| Ancho del sider / submenú inline | 0 ms | sin `scale`, sin colapso animado: el scroll no parece crecer |
| Entrada de ruta | 380 ms | fundido + 6 px, sin `scale` |
| Cambio de densidad | 0 ms | sin transición: el layout no crece ni salta |
| Gráficos Recharts | 850 ms → 0 | `isAnimationActive={!reduced}` con `useReducedMotion` |

La sensación de "vivo" se consigue con cinco capas discretas: halos ambientales
que respiran, rejilla por capas con foco en el puntero, KPIs que entran en
cascada, cifras que cuentan al cambiar de periodo y un `status pip` que late.
El sider se mantuvo quieto a propósito: su antiguo barrido y el `scale` de
entrada de ruta se percibían como un crecimiento durante el scroll. El rail y
las cabeceras fijas se descartaron por redundantes. Ninguna capa pasa del 10 %
de opacidad ni interrumpe la lectura.

`prefers-reduced-motion: reduce` anula **todas** las animaciones y transformaciones;
`AnimatedNumber` muestra el valor final directamente. Recharts anima por SVG/JS, así
que la regla CSS no bastaba: `useReducedMotion` refleja la preferencia en React y
pasa `isAnimationActive={!reduced}` a cada Bar/Line/Pie de Inicio y Tendencias.
`usePointerGrid` deja de escribir coordenadas y `.ui-ambient-layer::after` se
apaga, por lo que solo queda la rejilla estática.

## 6. Componentes

| Componente | Cambio global |
|---|---|
| `AppLayout` | Sidebar con índices monoespaciados, halo de marca y buscador (`/`, Escape, sinónimos y sin tildes); Finanzas reducido a 3 hojas iconadas (Resumen, Reportes y Gestión), sin subgrupos, contador ni pips, con las 13 rutas resaltando su sección. Categorías integrado en Productos, barra de señal en el item activo y pie `Signal · Control`. Scroll aislado y sin animaciones de apertura. Capa ambiental detrás del shell; header con degradado de superficie, filo teal→violeta y «En vivo · HH:mm» como texto con pip, sin chip ni separador. Incluye skip link y overlay móvil accesible. Control de densidad (Cómoda/Compacta) en el header; al cambiar de ruta el contenido vuelve arriba y recibe el foco, mientras Atrás/Adelante conservan la posición. |
| `useDensity` | Densidad del HUD persistida en `localStorage` (`ui-density`) y reflejada en `data-density`. `index.html` la aplica antes del primer pintado. La versión compacta recorta el relleno de tarjetas, filas y listas sin tocar tipografía ni controles. |
| `usePointerGrid` | Escribe `--ui-pointer-x/y` en `:root` con el puntero, a lo sumo una vez por frame. Ignora el tacto y se inhibe con `prefers-reduced-motion`; sin JS la rejilla conserva su posición estática. |
| `PageHeader` | Micro-label `eyebrow`, título en Space Grotesk, barra de señal lateral. Breadcrumb único derivado de la ruta (`useRouteBreadcrumb`) con `breadcrumbLeaf` para el dato de la página; ya no hay breadcrumb global en el shell. |
| `ModalHeading` | Cabecera editorial para diálogos de formulario: micro-label, título display, descripción de contexto y barra de señal estática. Repite el lenguaje de `PageHeader` para que el modal se sienta parte del sistema. Acompaña al cuerpo con scroll y al pie fijo definidos en `index.css`. |
| `EmptyState` | Estado vacío editorial con micro-label, título display, descripción y acción. Variante `inline` para celdas de tabla y gráficos; `panel` para páginas. La marca son escuadras HUD y un punto de señal, estáticos: el texto y la acción son el contenido real. |
| `LoadError` | Error de carga persistente para reportes, Cartera y Movimientos: alerta con título, detalle de la API y botón `Reintentar`. No desaparece solo y deja claro que los datos visibles no corresponden al filtro actual. |
| `useLatestRequest` | Hook de secuencia de peticiones: cada carga invalida la anterior y solo la última puede escribir estado. Evita que una respuesta lenta de un rango anterior sobrescriba el rango actual; al desmontar invalida lo que siga en vuelo. Reportes y Movimientos comparten el mismo patrón. |
| `ReportExport` | Botón único de exportación: CSV para análisis y PDF desde una vista imprimible, sin librerías nuevas. Ambos formatos salen de un mismo `ReportDocument` y el control se deshabilita durante la carga, con error o sin resultados. |
| `MovementFormModal` | Alta de entradas y salidas con avisos financieros por rol: el operador ve una nota sobre validación al guardar, los roles financieros ven presupuesto/cierre con reintento si falla la consulta. La confirmación de exceso recibe el monto confirmado como argumento para no reabrirse por un closure obsoleto. |
| `SuggestionList` | Lista semántica de sugerencias de presupuesto. Cada tarjeta usa su acento de severidad, icono en chip, micro-label (`Crítico`, `Atención`, `Sugerencia`) y la referencia de la línea. Sustituye la pila de `Alert` del Resumen financiero. |
| `Alert` (AntD) | Estilo global Signal: rail de acento según `info`/`success`/`warning`/`error`, icono en chip, fondo apenas teñido, borde del mismo tono y texto de alto contraste. El color no llena la superficie; solo señala. |
| `PeriodRangePicker` | Atajos Día/Semana/Mes/Año siempre controlados. En listados con limpieza muestra «Todo» cuando no hay rango; con un rango personalizado deja el control sin atajo, sin mentir sobre el estado. «Todo» limpia el rango. En reportes con periodo por defecto se muestra el atajo correspondiente. Incluye `PeriodFavorites` para guardar rangos exactos. |
| `PeriodFavorites` | Popover de rangos favoritos por usuario en `localStorage` (máximo 8). Cada fila aplica el rango; el botón de basura lo quita sin cerrar. Aplicar un favorito deja el selector en modo personalizado. |
| `Sparkline` | Serie mínima en SVG para una tarjeta: línea de 1,5 px teñida con el acento del tono y área al 12 %. Sin ejes, sin animación y oculta a lectores de pantalla; el valor y la variación siguen siendo el contenido principal. |
| `StatCard` | KPI HUD: barra de acento, escuadra, icono, delta y **cifra con color semántico**. Entrada escalonada, lavado de acento en reposo y highlight interior; `:active` hunde 1 px, foco con doble anillo y `sparkline` opcional sin espacio vacío. |
| `AnimatedNumber` | Conteo corto de la cifra al montar o cambiar de periodo; sin movimiento si se prefiere reducir. |
| `Button` (AntD) | Jerarquía de estados propia: `hover` eleva 1 px con sombra corta y `:active` hunde 1 px; primario y peligro suman un filo del color de su señal. Solo animan `transform` y `box-shadow`, así que temas, `disabled` y `loading` siguen gobernados por AntD. Texto y enlace no se elevan, ningún botón se mueve dentro de un documento (factura/cotización) y «Guardar» no proyecta sombra: se distingue por el color de marca. Sin movimiento con `prefers-reduced-motion`. |
| `Card` (AntD) | Títulos de cabecera en micro-label; sombra más suave y cálida. Los gráficos usan `.ui-chart-card` (profundidad, halo y marco HUD de dos escuadras). En densidad compacta reduce relleno y altura de cabecera. |
| `Table` (AntD) | Cabecera en micro-label con fondo opaco; numéricos mono (`--ui-mono`) alineados, fondo uniforme en filas normales y color solo para estados reales (`.row-low-stock`, subtotales de resultados); `focus-within` por fila con `outline`. La densidad compacta reduce el relleno vertical de las filas. Efectos fuera de la impresión. |
| Recharts | Paleta única desde `styles/chartPalette.ts`, tooltips del tema, gradientes suaves y `isAnimationActive={!reduced}`. |
| `FinanceSectionTabs` | Pestañas contextuales bajo el `PageHeader` de las 16 páginas de Finanzas: Resumen (2 hojas), Reportes (7) y Gestión (7, con el detalle de presupuesto). Navegan a rutas existentes conservando la query de periodo y filtros, y resaltan la pestaña padre en rutas anidadas. Estilo en `.ui-finance-tabs`: micro-label, filo tenue y acento de marca en la activa. |
| `CategoriesPanel` | Cuerpo compartido de Categorías, sin cabecera ni título propios; se usa en `/categories` y en la pestaña de `ProductsPage`. |
| `AuditPage` | Visor append-only de `audit_log`: entidad, acción, usuario y estados antes/después. La entidad `stock_movement` aparece como «Movimiento» para seguir el rastro de cada entrada o salida de stock, con el mismo lenguaje de tags que el resto. |
| `PrintHeader` | Cabecera compartida de cotizaciones y facturas. Identidad a la izquierda, número en forma de ticket a la derecha y cinta opcional de tres métricas con `role="group"`. El papel es siempre claro y los acentos fijos, independientes del tema de la app. |
| `PrintSection` | Bloque numerado de la plantilla impresa: índice monoespaciado sobre fondo de acento suave, micro-label en mayúsculas y filo lateral. Da el mismo ritmo a Cliente, Ítems, Totales, Condiciones y Firmas en ambos documentos. |
| `FormSection` | Bloque de documento, no tarjeta: regla superior, número plano en mono, título `h2` en display y descripción de una línea. Cotización y factura comparten el mismo ritmo; el índice sigue siendo decorativo. |
| `DocumentTotals` | Lista de importes alineada a la derecha de la sección: filas con tooltip opcional —ahora enfocables con `tabIndex={0}` y `aria-label`—, total con filo fuerte, pista explicativa y neto en caja de acento suave. Sin borde ni fondo propios: hereda el lienzo. Es un `group` con nombre y usa la misma fuente display que los KPI; tamaños y pesos salen de `--ui-text-total` / `--ui-weight-total`. |
| `DocumentFormFooter` | Barra pegajosa al fondo con guardar/cancelar, estado de cambios sin guardar y total siempre visible. Tres niveles de botón: primario «Guardar», secundario «Cancelar» y texto para «Borrador», «Vista previa» e «Imprimir». «Sin guardar/Guardado» se anuncia con `role="status"` en tinta de aviso con punto, sin `Tag` rellena; el importe **no** lleva `aria-live` para no anunciar cada pulsación. Acepta `onSaveDraft`/`draftSavedAt` (la hora del último guardado vive en el tooltip) y un `checklist` fiscal que la barra resume en un popover: «Fiscal · faltan N» o «Fiscal · completo». Dentro, cada comprobación es una pastilla `✓`/`○` que abre la sección necesaria y enfoca el campo pendiente; al pulsarla el popover se cierra. |
| `formErrors` | Puente entre los `issues` de Zod del servidor y los campos de AntD: limpia errores previos, marca la ruta afectada con `form.setFields` y devuelve el mensaje del toast. Evita que el usuario tenga que adivinar qué línea rechazó el servidor. |
| `PasteLinesDialog` | Pegado desde Excel o Calc sin dependencias. Detecta tabulación, punto y coma o coma, permite mapear Descripción · Cantidad · Precio · SKU, previsualiza la coincidencia con el catálogo y solo agrega filas con producto. Los repetidos se omiten con aviso. |
| `ProductSelect` | Búsqueda remota con grupos Favoritos, Recientes y Catálogo (los dos primeros en `localStorage`). Cada opción muestra precio y stock, avisa del stock bajo y deshabilita el producto ya usado en otra línea con la etiqueta «Ya agregado». La estrella alterna el favorito sin seleccionar la opción y expone su estado con `aria-pressed`. |
| Opciones plegadas | En la cotización, `.ui-more-options` concentra los campos que no se usan en cada captura tras un botón con `aria-expanded`. En la factura, «Información adicional» (`.ui-invoice-more`) pliega resolución, referencias, cuenta y retenciones tras una fila con resumen de una línea; el checklist fiscal abre la sección y enfoca el campo pendiente con `scrollToField`. En papel la sección se imprime siempre desplegada. |
| Etiquetas y botones de formulario | El asterisco de AntD marca lo obligatorio; `.ui-optional` añade «opcional» en tinta secundaria solo donde hace falta. Los números se alinean a la derecha y los importes comparten un solo `$`. «Agregar línea» es una banda continua sin borde: fondo y tamaño fijos, texto en tinta secundaria, `+` y atajo en tinta terciaria, sin círculos ni pastillas: las acciones en línea nunca compiten con «Guardar». |
| Factura editable | `.ui-invoice-head` concentra emisor, título, número y fecha/hora en una cabecera compacta de 3 px de acento. «Facturar a» y «Condiciones» son filas con rótulo y una retícula interna de dos columnas; los campos llevan etiqueta a la izquierda, sin borde ni subrayado; el fondo cambia al pasar el cursor y el foco añade un halo corto, a 30 px de alto. La tabla numera las líneas, usa valores de 13 px con cifras tabulares y el resumen muestra las seis filas de totales completas antes del total factura. Los controles son `borderless` y los vacíos muestran placeholders. Las acciones viven en el `DocumentFormFooter` compartido con cotizaciones: barra flotante `sticky` abajo, redondeada y opaca (sin `backdrop-filter`), con filo degradado, sombra, número/estado y checklist fiscal en popover a la izquierda, y total a la derecha; sigue dentro del `<form>`. La hoja usa el ancho útil (1180 px con 8 px de margen en esta ruta), toda acción en línea es un `Button` de AntD a 30 px en la barra; el menú de la fila agrupa mover, clonar y quitar, los valores de la tabla van a 14 px y el total final a `--ui-text-title` (~20 px), sin raya gruesa. La tabla no usa zebra ni reacciona al cursor: fondo uniforme y solo la celda con foco se marca; la cabecera `sticky` usa el filo tenue de `--ui-line` y no divisores verticales; los numéricos alinean la cifra a la derecha y muestran unas flechas de 14 px, transparentes en reposo, que aparecen al enfocar o señalar el campo, conservan sus etiquetas en español y reservan el ancho del riel también en reposo, así que la cifra no se encoge al hover; en el panel de detalle el porcentaje se alinea a la izquierda para no quedar bajo las flechas, sin sufijo `%` dentro del control porque la etiqueta ya lo dice, y en la tabla se mantiene a la derecha; en papel el riel se oculta. Cada línea nace con cantidad `1`: al elegir producto el foco pasa al campo de cantidad con el valor seleccionado y la región `aria-live` lo anuncia, de modo que se puede escribir la cifra sin otro clic. El detalle de la línea es una pastilla con `%` y chevron que gira al abrir, sin punto de alerta: `aria-expanded` y el fondo de marca indican el estado, y el hover solo cambia fondo y tinta; su panel es una retícula de dos filas con borde perimetral suave: la descripción facturada y la unidad arriba, y debajo descuento, IVA, INC, nombre del tributo y su porcentaje, cada uno con su etiqueta encima del valor; sin descripciones bajo el campo ni iconos de ayuda en la etiqueta; el botón `%` conserva el punto de estado ámbar y su tooltip de resumen. «Agregar línea» es una banda `dashed` de 34 px con icono y el atajo `Alt + ↵`; su hover no eleva ni cambia el borde. Los campos llevan sufijo de unidad (`%`, `días`), borrado rápido en opcionales y contador en textos largos; el foco añade halo de marca, el error tiñe el campo y muestra una insignia, y los obligatorios se marcan con un punto en las filas de documento. El espaciado, el radio de campo y la altura de control salen de tokens compartidos por cabecera, filas, tabla, cierre y pie; la cabecera de la tabla queda fija a 78 px y la celda con foco se marca con un filo inferior. El semáforo de stock vive en la fila y «Agregar línea» admite `Alt + Enter`, con foco automático en el buscador de producto. Los botones de la barra y del header responden al hover con elevate y al active con presión, mantienen foco visible y anuncian el guardado con un barrido; el estado «Sin guardar» se lee por texto y color, sin pulsos. |
| Línea fiscal | `.ui-invoice-table` reduce la rejilla a # · Descripción · Cant. · Precio unit. · Total, más una columna de acciones. El producto apila el select y un botón `%` con `aria-expanded`; ahí aparecen descripción facturada, unidad, descuento, IVA, INC y otro tributo. Las acciones se agrupan en un `Dropdown` con `aria-label` numerado. Bajo 1200 px la cabecera se oculta y la línea pasa a dos columnas; bajo 900 px, a tarjeta. |
| Plantilla de factura | `PrintHeader` muestra fecha, hora de Bogotá (UTC-5) y número; `PrintSection` añade un bloque de datos fiscales con resolución, rango y medio de pago. La tabla imprime descripción, cantidad, precio y total, y Totales discrimina IVA, INC y otros tributos antes del neto. El editor comparte esa lectura: al imprimir desde el navegador oculta menú, header, barra y controles, convierte los campos en texto sin borde, imprime la descripción personalizada como segunda línea del ítem —solo si existe— y deja siempre desplegada la información fiscal. Ya no hay botones de «Imprimir» ni «Vista previa»: las reglas `@media print` preparan la hoja para Ctrl+P. |

## 7. Accesibilidad

- Skip link «Saltar al contenido» como primer elemento enfocable.
- `:focus-visible` global con `--ui-focus-ring` (`0 0 0 2px var(--ui-brand-strong)`,
  5,47:1 en claro y 11,54:1 en oscuro) y 2 px de offset; los tooltips de
  totales, stock y entrega son enfocables y se anuncian por `aria-label`.
- En documentos los campos usan `--ui-focus-ring-spaced`: 2 px de fondo y
  después la tinta de marca, para que el anillo no toque la cifra; botones y
  ayudas comparten el mismo anillo. En la tabla el foco no tiñe la celda ni el
  campo, ni siquiera en estado de error: solo aparece el anillo.
- `aria-live="polite"` en estados de carga y error del panel.
- Overlay móvil con `role`, `aria-label` y cierre con `Escape`.
- Contraste: la tinta secundaria cumple AA sobre superficie en ambos temas;
  `--ui-ink-3` cubre placeholders, sufijos y atajos sin usar `opacity`.
- El bento conserva el orden de lectura del DOM; el sparkline es decorativo y
  queda fuera del árbol de accesibilidad. Las secciones impresas usan `h2` real
  y la cinta de métricas es un `group` con nombre, no una lista de divs sin rol.
- En los formularios de documento los índices de sección son `aria-hidden`; cada
  botón de eliminar línea nombra su posición («Quitar línea 3»). Los totales son
  un `group` con nombre, el estado de guardado se anuncia y los errores del
  servidor se asocian al campo correspondiente en lugar de vivir solo en un
  toast. La rejilla de líneas se convierte en tarjetas antes de los 1200 px.
- En la factura, el checklist fiscal expresa cuántos datos faltan con texto, no
  solo con color, y cada comprobación abre «Información adicional» y enfoca el
  campo pendiente. El detalle de línea (`%`), «Información adicional» y «Más
  opciones» exponen su estado con `aria-expanded`, y el menú de línea nombra su
  posición en `aria-label`.
- Ya no hay resumen de errores: el envío inválido marca los campos con AntD y
  enfoca el primero, mientras una región `aria-live` anuncia líneas agregadas,
  duplicadas o eliminadas y productos repetidos. El menú de línea nombra su
  posición en `aria-label`; las flechas de los numéricos se etiquetan «Aumentar
  Cantidad» / «Disminuir Cantidad», aparecen al enfocar o señalar el campo sin
  robar espacio a la cifra en reposo, y su estado desactivado se entiende sin
  depender del color, con ↑/↓ como vía equivalente por teclado. Los atajos
  `Enter`, `Ctrl+D`, `Ctrl+Supr`,
  `Ctrl+Enter` y `Ctrl+S` no secuestran el desplegable del producto ni los
  modales.
- La tabla declara `role="table"`/`row`/`columnheader` con `aria-colcount`,
  `aria-rowcount`, `aria-colindex` y `aria-rowindex` (la primera línea es la fila
  2), seis celdas reales por fila y el nombre «Línea N»; las etiquetas siguen en
  el DOM para conservar el nombre accesible de cada control. Los botones de
  agregar/pegar y `Form.ErrorList` quedan fuera de la tabla. Por debajo de
  900 px la tabla pasa a tarjetas con borde y las etiquetas vuelven a mostrarse;
  el pegado desde Excel queda como botón visible bajo la tabla. El salto al
  primer error respeta `prefers-reduced-motion`.

## 8. Verificación

- `client npm run build` y `client npm run lint` tras cada fase.
- En tandas con servidor: `server npm run typecheck`, `server npm run lint` y
  `server npm test`; la migración `V031` se valida con `server npm run test:db`.
- `git diff --check` para detectar whitespace antes de commitear.
- Revisión visual en claro/oscuro y en breakpoint móvil.
- Sin commit ni push hasta la aprobación explícita.
