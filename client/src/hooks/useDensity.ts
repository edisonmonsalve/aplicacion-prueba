import { useEffect, useState } from "react";

export type Density = "comfortable" | "compact";

const KEY = "ui-density";

const readDensity = (): Density => {
  if (typeof window === "undefined") return "comfortable";
  try {
    return window.localStorage.getItem(KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
};

/**
 * Densidad del HUD: ajusta el relleno de tarjetas y filas, como el "UI scale"
 * de un juego. La preferencia se guarda en `localStorage` y se refleja en
 * `data-density`; `index.html` la aplica antes del primer pintado para que no
 * haya salto visual al cargar.
 */
export default function useDensity() {
  const [density, setDensity] = useState<Density>(readDensity);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try {
      window.localStorage.setItem(KEY, density);
    } catch {
      /* sin acceso a localStorage: la preferencia dura la sesión */
    }
  }, [density]);

  const toggle = () =>
    setDensity((current) => (current === "compact" ? "comfortable" : "compact"));

  return { density, toggle };
}
