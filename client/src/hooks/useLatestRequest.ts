import { useCallback, useEffect, useRef } from "react";

/**
 * Descarta respuestas que llegan después de una petición más reciente.
 *
 * Cada llamada a `start` invalida las anteriores; `isCurrent` compara el
 * identificador recibido con el último emitido. Sirve para que cambiar el
 * rango de fechas rápido no deje datos del rango anterior en pantalla.
 */
export default function useLatestRequest() {
  const latest = useRef(0);

  // Al desmontar, invalida lo que siga en vuelo para no escribir estado.
  useEffect(
    () => () => {
      latest.current += 1;
    },
    []
  );

  const start = useCallback(() => {
    latest.current += 1;
    return latest.current;
  }, []);

  const isCurrent = useCallback((requestId: number) => requestId === latest.current, []);

  return { start, isCurrent };
}
