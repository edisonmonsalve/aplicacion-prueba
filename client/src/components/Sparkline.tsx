interface Props {
  /** Serie en orden cronológico. Con menos de dos puntos no se dibuja. */
  values: number[];
  /** Alto en píxeles; el ancho lo pone el contenedor. */
  height?: number;
}

/**
 * Sparkline Signal: una línea mínima, sin ejes ni etiquetas, para leer la
 * dirección de una serie dentro de una tarjeta. Es un complemento visual: el
 * valor y la variación siguen siendo el contenido principal, por eso el SVG
 * queda oculto a lectores de pantalla.
 */
export default function Sparkline({ values, height = 26 }: Props) {
  if (values.length < 2) return null;

  const width = 100;
  const padding = 2;
  const available = Math.max(height - padding * 2, 1);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y =
      range === 0 ? height / 2 : padding + available - ((value - min) / range) * available;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const area = `M0,${height} L${points.join(" L")} L${width},${height} Z`;

  return (
    <svg
      className="ui-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {range > 0 && <path className="ui-sparkline__area" d={area} />}
      <polyline
        className="ui-sparkline__line"
        points={points.join(" ")}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
