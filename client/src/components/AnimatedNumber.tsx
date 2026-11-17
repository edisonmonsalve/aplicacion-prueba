import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  /** Formatea el valor interpolado (moneda, entero, porcentaje…). */
  format: (value: number) => string;
  /** Duración del conteo. Por defecto `--ui-count-duration` (620 ms). */
  duration?: number;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Cifra que cuenta desde su valor anterior hasta el nuevo al montar o al
 * cambiar de periodo. Es una micro-interacción: si el usuario prefiere menos
 * movimiento, o el valor no es finito, se pinta directamente.
 */
export default function AnimatedNumber({ value, format, duration }: Props) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  const ms = duration ?? 620;

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(value)) {
      current.current = value;
      setDisplay(value);
      return;
    }

    const from = current.current;
    if (from === value) return;

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (value - from) * eased;
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else current.current = value;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ms]);

  return <span className="ui-count">{format(display)}</span>;
}
