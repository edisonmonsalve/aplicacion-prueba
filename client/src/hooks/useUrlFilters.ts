import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

type FilterValue = string | number | null | undefined;

/**
 * Sincroniza los filtros de una lista con la URL.
 *
 * Así el estado sobrevive a recargas, al botón "atrás" y se puede compartir
 * por enlace. Los valores vacíos se eliminan de la URL para no ensuciarla.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();

  const get = useCallback(
    (key: string) => {
      const value = params.get(key);
      return value === null || value === "" ? undefined : value;
    },
    [params]
  );

  const getNumber = useCallback(
    (key: string) => {
      const raw = params.get(key);
      if (raw === null || raw === "") return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    },
    [params]
  );

  const getPositiveInt = useCallback(
    (key: string, fallback: number) => {
      const raw = params.get(key);
      if (raw === null || raw === "") return fallback;
      const value = Number(raw);
      return Number.isInteger(value) && value > 0 ? value : fallback;
    },
    [params]
  );

  const update = useCallback(
    (changes: Record<string, FilterValue>, options?: { resetPage?: boolean }) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === null || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        // Cualquier cambio de filtro vuelve a la primera página, salvo que el
        // propio cambio sea de paginación.
        if (options?.resetPage && !Object.prototype.hasOwnProperty.call(changes, "page")) {
          next.delete("page");
        }
        return next;
      });
    },
    [setParams]
  );

  return { params, get, getNumber, getPositiveInt, update };
}
