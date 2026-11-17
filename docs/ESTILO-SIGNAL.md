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
6.Todo movimiento es corto (140–220 ms) y respeta `prefers-reduced-motion`.

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

Regla: Jakarta para *explicar*, Space Grotesk para *anunciar*.

## 4. Formas y shapes

- Radio general 14–16 px; esquinas recortadas (`clip-path`) solo en chips y píxeles de acento.
- KPI con **barra superior degradada** y **escuadra** en la esquina superior derecha.
- `status pip`: punto de 6 px con halo suave para estados activos.
- Barras de progreso **segmentadas** (estilo barra de vida) en metas y cartera.
- Cuadrícula de fondo de 28 px en el sidebar y en el bloque de bienvenida.
- Sider: índice de sección monoespaciado y barra vertical de 3 px en el item activo.

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

La sensación de "vivo" se consigue con cuatro capas discretas: halos ambientales
que respiran, KPIs que entran en cascada, cifras que cuentan al cambiar de
periodo y un `status pip` que late. El sider se mantuvo quieto a propósito: su
antiguo barrido y el `scale` de entrada de ruta se percibían como un crecimiento
durante el scroll. Ninguna capa usa más del 10 % de opacidad ni interrumpe la
lectura.

`prefers-reduced-motion: reduce` anula **todas** las animaciones y transformaciones;
`AnimatedNumber` muestra el valor final directamente.

## 6. Componentes

| Componente | Cambio global |
|---|---|
| `AppLayout` | Sidebar con índices en chip monoespaciado, halo de marca, buscador (`/`, Escape, sinónimos y sin tildes), Finanzas agrupado en Panel / Reportes / Gestión, barra de señal en el item activo y en su padre, pip de subsección y pie `Signal · Control`. Scroll aislado y sin animaciones de apertura. Header con degradado de superficie, filo teal→violeta y «En vivo · HH:mm» en chip. Incluye skip link y overlay móvil accesible. |
| `PageHeader` | Micro-label `eyebrow`, título en Space Grotesk, barra de señal lateral. |
| `StatCard` | KPI HUD: barra de acento, escuadra, icono, delta y **cifra con color semántico**. Entrada escalonada y glow del hover con el tono del KPI. |
| `AnimatedNumber` | Conteo corto de la cifra al montar o cambiar de periodo; sin movimiento si se prefiere reducir. |
| `Card` (AntD) | Títulos de cabecera en micro-label; sombra más suave y cálida. |
| `Table` (AntD) | Cabecera en micro-label; hover sutil. |
| Recharts | Paleta de tokens, tooltips del tema, barras con degradado suave. |

## 7. Accesibilidad

- Skip link «Saltar al contenido» como primer elemento enfocable.
- `:focus-visible` global con el color de marca y 2 px de offset.
- `aria-live="polite"` en estados de carga y error del panel.
- Overlay móvil con `role`, `aria-label` y cierre con `Escape`.
- Contraste: la tinta secundaria cumple AA sobre superficie en ambos temas.

## 8. Verificación

- `client npm run build` y `client npm run lint` tras cada fase.
- Revisión visual en claro/oscuro y en breakpoint móvil.
- Sin commit ni push hasta la aprobación explícita.
