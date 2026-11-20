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
- **Bento** en Inicio y Resumen: bloques `16/8` que alternan el lado grande y,
  en Finanzas, dos secciones de KPIs en columnas `12` desde `lg`. El resto de
  páginas mantiene la rejilla uniforme.
- **Glass quirúrgico** solo en superficies que flotan sobre contenido (dropdowns,
  popovers, selects, calendarios y tooltips): `backdrop-filter: blur(6px)
  saturate(1.15)` sobre un 62 % de superficie (66 % en el tooltip oscuro). Los
  modales quedan fuera: su mask a pantalla completa ya oscurece la página y no
  hay fondo reconocible que difuminar. Tooltips y popovers ocultan la flecha,
  que no comparte el desenfoque. El contenido y las tarjetas siguen opacos.
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
| `LoadError` | Error de carga persistente para reportes y listados: alerta con título, detalle de la API y botón `Reintentar`. No desaparece solo y deja claro que los datos visibles no corresponden al filtro actual. |
| `useLatestRequest` | Hook de secuencia de peticiones: cada carga invalida la anterior y solo la última puede escribir estado. Evita que una respuesta lenta de un rango anterior sobrescriba el rango actual; al desmontar invalida lo que siga en vuelo. |
| `SuggestionList` | Lista semántica de sugerencias de presupuesto. Cada tarjeta usa su acento de severidad, icono en chip, micro-label (`Crítico`, `Atención`, `Sugerencia`) y la referencia de la línea. Sustituye la pila de `Alert` del Resumen financiero. |
| `Alert` (AntD) | Estilo global Signal: rail de acento según `info`/`success`/`warning`/`error`, icono en chip, fondo apenas teñido, borde del mismo tono y texto de alto contraste. El color no llena la superficie; solo señala. |
| `PeriodRangePicker` | Atajos Día/Semana/Mes/Año siempre controlados. En listados con limpieza muestra «Todo» cuando no hay rango; con un rango personalizado deja el control sin atajo, sin mentir sobre el estado. «Todo» limpia el rango. En reportes con periodo por defecto se muestra el atajo correspondiente. Incluye `PeriodFavorites` para guardar rangos exactos. |
| `PeriodFavorites` | Popover de rangos favoritos por usuario en `localStorage` (máximo 8). Cada fila aplica el rango; el botón de basura lo quita sin cerrar. Aplicar un favorito deja el selector en modo personalizado. |
| `Sparkline` | Serie mínima en SVG para una tarjeta: línea de 1,5 px teñida con el acento del tono y área al 12 %. Sin ejes, sin animación y oculta a lectores de pantalla; el valor y la variación siguen siendo el contenido principal. |
| `StatCard` | KPI HUD: barra de acento, escuadra, icono, delta y **cifra con color semántico**. Entrada escalonada, lavado de acento en reposo y highlight interior; `:active` hunde 1 px, foco con doble anillo y `sparkline` opcional sin espacio vacío. |
| `AnimatedNumber` | Conteo corto de la cifra al montar o cambiar de periodo; sin movimiento si se prefiere reducir. |
| `Button` (AntD) | Jerarquía de estados propia: `hover` eleva 1 px con sombra corta y `:active` hunde 1 px; primario y peligro suman un filo del color de su señal. Solo animan `transform` y `box-shadow`, así que temas, `disabled` y `loading` siguen gobernados por AntD. Texto y enlace no se elevan. Sin movimiento con `prefers-reduced-motion`. |
| `Card` (AntD) | Títulos de cabecera en micro-label; sombra más suave y cálida. Los gráficos usan `.ui-chart-card` (profundidad, halo y marco HUD de dos escuadras). En densidad compacta reduce relleno y altura de cabecera. |
| `Table` (AntD) | Cabecera en micro-label con fondo opaco; numéricos mono (`--ui-mono`) alineados, fondo uniforme en filas normales y color solo para estados reales (`.row-low-stock`, subtotales de resultados); `focus-within` por fila con `outline`. La densidad compacta reduce el relleno vertical de las filas. Efectos fuera de la impresión. |
| Recharts | Paleta única desde `styles/chartPalette.ts`, tooltips del tema, gradientes suaves y `isAnimationActive={!reduced}`. |
| `FinanceSectionTabs` | Pestañas contextuales bajo el `PageHeader` de las 16 páginas de Finanzas: Resumen (2 hojas), Reportes (7) y Gestión (7, con el detalle de presupuesto). Navegan a rutas existentes conservando la query de periodo y filtros, y resaltan la pestaña padre en rutas anidadas. Estilo en `.ui-finance-tabs`: micro-label, filo tenue y acento de marca en la activa. |
| `CategoriesPanel` | Cuerpo compartido de Categorías, sin cabecera ni título propios; se usa en `/categories` y en la pestaña de `ProductsPage`. |

## 7. Accesibilidad

- Skip link «Saltar al contenido» como primer elemento enfocable.
- `:focus-visible` global con el color de marca y 2 px de offset.
- `aria-live="polite"` en estados de carga y error del panel.
- Overlay móvil con `role`, `aria-label` y cierre con `Escape`.
- Contraste: la tinta secundaria cumple AA sobre superficie en ambos temas.

## 8. Verificación

- `client npm run build` y `client npm run lint` tras cada fase.
- `git diff --check` para detectar whitespace antes de commitear.
- Revisión visual en claro/oscuro y en breakpoint móvil.
- Sin commit ni push hasta la aprobación explícita.
