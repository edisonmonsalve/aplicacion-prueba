import { useEffect } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Mueve el foco de la rejilla ambiental con el puntero escribiendo dos custom
 * properties en `:root`. No anima nada por JS: solo actualiza coordenadas, y
 * lo hace a lo sumo una vez por frame. Si se prefiere movimiento reducido (o el
 * puntero es táctil) no escribe nada y el CSS conserva su foco estático.
 */
export default function usePointerGrid(): void {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia(QUERY);
    let frame = 0;
    let x = 0;
    let y = 0;

    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      root.style.removeProperty("--ui-pointer-x");
      root.style.removeProperty("--ui-pointer-y");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (media.matches || event.pointerType === "touch") return;
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--ui-pointer-x", `${x}px`);
        root.style.setProperty("--ui-pointer-y", `${y}px`);
      });
    };

    const onPreferenceChange = () => {
      if (media.matches) reset();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    media.addEventListener("change", onPreferenceChange);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      media.removeEventListener("change", onPreferenceChange);
      reset();
    };
  }, []);
}
