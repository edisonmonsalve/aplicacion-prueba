import { useEffect, useState } from "react";

/**
 * Reloj compartido para textos relativos (“hace 5 minutos”).
 *
 * Un solo intervalo atiende a todas las fechas visibles: cien filas no crean
 * cien timers. Se pausa cuando la pestaña está oculta y se sincroniza al volver.
 */
const TICK_MS = 30_000;

let current = Date.now();
let timer: number | undefined;
const listeners = new Set<(now: number) => void>();

const tick = () => {
  current = Date.now();
  listeners.forEach((listener) => listener(current));
};

const onVisibility = () => {
  if (!document.hidden) tick();
};

const start = () => {
  if (timer !== undefined) return;
  timer = window.setInterval(tick, TICK_MS);
  document.addEventListener("visibilitychange", onVisibility);
};

const stop = () => {
  if (timer === undefined) return;
  window.clearInterval(timer);
  timer = undefined;
  document.removeEventListener("visibilitychange", onVisibility);
};

const subscribe = (listener: (now: number) => void) => {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
};

/** Devuelve la hora actual y vuelve a renderizar cuando el reloj avanza. */
export function useNow(): number {
  const [now, setNow] = useState(current);

  useEffect(() => {
    // Al montar se toma el valor más reciente (pudo avanzar entre renders).
    setNow(current);
    return subscribe(setNow);
  }, []);

  return now;
}
