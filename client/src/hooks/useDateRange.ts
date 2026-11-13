import { useCallback, useMemo, useRef } from "react";
import dayjs from "dayjs";
import { useUrlFilters } from "@/hooks/useUrlFilters";

/**
 * Selector de periodo compartido por los reportes y listados con filtro de
 * fechas.
 *
 * Guarda en la URL `desde`, `hasta` y `periodo` para que recargar, compartir
 * el enlace o volver atrás conserve el mismo contexto. Los atajos de día,
 * semana, mes y año usan periodos calendario; la semana empieza en lunes
 * (convención colombiana), no en domingo como el `startOf("week")` de dayjs.
 */
export type PeriodoCalendario = "dia" | "semana" | "mes" | "anio";
export type PeriodoRango = PeriodoCalendario | "personalizado";

export type RangoFechas = [dayjs.Dayjs, dayjs.Dayjs];

export const FMT_FECHA = "YYYY-MM-DD";

export const PERIODOS: Array<{ label: string; value: PeriodoCalendario }> = [
  { label: "Día", value: "dia" },
  { label: "Semana", value: "semana" },
  { label: "Mes", value: "mes" },
  { label: "Año", value: "anio" },
];

export const UNIDAD_PERIODO: Record<PeriodoCalendario, dayjs.ManipulateType> = {
  dia: "day",
  semana: "week",
  mes: "month",
  anio: "year",
};

export function esPeriodo(value: string | null | undefined): value is PeriodoCalendario {
  return value === "dia" || value === "semana" || value === "mes" || value === "anio";
}

/** Rango calendario de un periodo a partir de una fecha base. */
export function rangoDePeriodo(
  periodo: PeriodoCalendario,
  base: dayjs.Dayjs = dayjs()
): RangoFechas {
  const dia = base.startOf("day");
  if (periodo === "dia") return [dia, dia];
  if (periodo === "semana") {
    const lunes = dia.subtract((dia.day() + 6) % 7, "day");
    return [lunes, lunes.add(6, "day")];
  }
  if (periodo === "mes") return [dia.startOf("month"), dia.endOf("month")];
  return [dia.startOf("year"), dia.endOf("year")];
}

/** Etiqueta humana del periodo: "marzo de 2026", "2026", "09/03 – 15/03/2026"… */
export function etiquetaPeriodo(periodo: PeriodoCalendario, range: RangoFechas) {
  const [desde, hasta] = range;
  if (periodo === "dia") return desde.format("DD/MM/YYYY");
  if (periodo === "semana") {
    return `${desde.format("DD/MM")} – ${hasta.format("DD/MM/YYYY")}`;
  }
  if (periodo === "mes") return desde.format("MMMM [de] YYYY");
  return desde.format("YYYY");
}

/** Descripción del rango para mostrar bajo el selector. */
export function descripcionRango(
  periodo: PeriodoRango | null,
  range: RangoFechas | null
) {
  if (!range) return "Sin rango de fechas: se muestran todos los registros";
  const fechas = `${range[0].format("DD/MM/YYYY")} – ${range[1].format("DD/MM/YYYY")}`;
  if (!periodo || periodo === "personalizado") return fechas;
  return `${etiquetaPeriodo(periodo, range)} · ${fechas}`;
}

/**
 * Rango inmediatamente anterior para comparar.
 *
 * Con un preset se compara el periodo calendario previo (mes anterior, año
 * anterior). Con un rango libre, un bloque de igual duración.
 */
export function rangoAnterior(
  periodo: PeriodoRango | null,
  range: RangoFechas
): RangoFechas {
  if (periodo && periodo !== "personalizado") {
    return rangoDePeriodo(periodo, range[0].subtract(1, UNIDAD_PERIODO[periodo]));
  }
  const dias = range[1].startOf("day").diff(range[0].startOf("day"), "day");
  const hasta = range[0].subtract(1, "day");
  return [hasta.subtract(dias, "day"), hasta];
}

export interface UseDateRangeOptions {
  /** Atajo activo cuando la URL no trae periodo ni fechas. Por defecto, "mes". */
  defaultPeriodo?: PeriodoRango;
  /** Rango inicial cuando no hay URL y el periodo por defecto es personalizado. */
  defaultRange?: () => RangoFechas;
  /** Permite dejar el rango vacío para mostrar todos los registros (listados). */
  allowClear?: boolean;
  /** Vuelve a la primera página al cambiar el rango (listados paginados). */
  resetPage?: boolean;
}

export interface DateRangeState<R extends RangoFechas | null> {
  range: R;
  periodo: PeriodoRango | null;
  /** Fechas listas para la API. Con rango obligatorio siempre están definidas. */
  desde: R extends RangoFechas ? string : string | undefined;
  hasta: R extends RangoFechas ? string : string | undefined;
  enPeriodoActual: boolean;
  descripcion: string;
  /** Query string con el rango para enlazar a otro reporte. */
  query: string;
  previousRange: RangoFechas | null;
  changeRange: (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void;
  selectPeriodo: (periodo: PeriodoCalendario) => void;
  shiftPeriodo: (direction: -1 | 1) => void;
  clear: () => void;
}

function parseFecha(value: string | null) {
  if (!value) return null;
  const fecha = dayjs(value);
  return fecha.isValid() ? fecha.startOf("day") : null;
}

function resolverRango(
  params: { desde: string | null; hasta: string | null; periodo: string | null },
  options: UseDateRangeOptions,
  allowClear: boolean
): { range: RangoFechas | null; periodo: PeriodoRango | null } {
  const desde = parseFecha(params.desde);
  const hasta = parseFecha(params.hasta);

  if (desde && hasta) {
    return {
      range: [desde, hasta],
      periodo: esPeriodo(params.periodo) ? params.periodo : "personalizado",
    };
  }

  if (allowClear) return { range: null, periodo: null };

  const preset = esPeriodo(params.periodo)
    ? params.periodo
    : options.defaultPeriodo ?? "mes";

  if (preset === "personalizado") {
    return {
      range: options.defaultRange?.() ?? [dayjs().startOf("month"), dayjs()],
      periodo: "personalizado",
    };
  }

  return { range: rangoDePeriodo(preset, dayjs()), periodo: preset };
}

export function useDateRange(
  options: UseDateRangeOptions & { allowClear: true }
): DateRangeState<RangoFechas | null>;
export function useDateRange(
  options?: UseDateRangeOptions & { allowClear?: false }
): DateRangeState<RangoFechas>;
export function useDateRange(
  options?: UseDateRangeOptions
): DateRangeState<RangoFechas | null>;
export function useDateRange(
  options: UseDateRangeOptions = {}
): DateRangeState<RangoFechas | null> {
  const { get, update } = useUrlFilters();
  const allowClear = options.allowClear === true;
  const resetPage = options.resetPage === true;

  const desdeParam = get("desde") ?? null;
  const hastaParam = get("hasta") ?? null;
  const periodoParam = get("periodo") ?? null;

  // Las funciones de opciones se leen desde una ref para no invalidar el memo
  // en cada render cuando la página pasa un callback inline.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // La fecha de hoy entra en las dependencias para que los presets se
  // recalculen al cambiar el día sin re-renderizar en bucle.
  const hoy = dayjs().format(FMT_FECHA);

  const { range, periodo } = useMemo(
    () =>
      resolverRango(
        { desde: desdeParam, hasta: hastaParam, periodo: periodoParam },
        optionsRef.current,
        allowClear
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desdeParam, hastaParam, periodoParam, allowClear, hoy]
  );

  const commit = useCallback(
    (next: RangoFechas | null, nextPeriodo: PeriodoRango | null) => {
      update(
        {
          desde: next ? next[0].format(FMT_FECHA) : undefined,
          hasta: next ? next[1].format(FMT_FECHA) : undefined,
          periodo:
            nextPeriodo && nextPeriodo !== "personalizado" ? nextPeriodo : undefined,
        },
        { resetPage }
      );
    },
    [update, resetPage]
  );

  const changeRange = useCallback(
    (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
      if (!value || !value[0] || !value[1]) {
        // El botón de limpiar del RangePicker solo aparece con allowClear.
        if (allowClear) commit(null, null);
        return;
      }
      commit(
        [value[0].startOf("day"), value[1].startOf("day")],
        "personalizado"
      );
    },
    [allowClear, commit]
  );

  const selectPeriodo = useCallback(
    (next: PeriodoCalendario) => {
      commit(rangoDePeriodo(next, dayjs()), next);
    },
    [commit]
  );

  const shiftPeriodo = useCallback(
    (direction: -1 | 1) => {
      if (!range || !periodo || periodo === "personalizado") return;
      commit(
        rangoDePeriodo(
          periodo,
          range[0].add(direction, UNIDAD_PERIODO[periodo])
        ),
        periodo
      );
    },
    [commit, periodo, range]
  );

  const clear = useCallback(() => commit(null, null), [commit]);

  const enPeriodoActual = Boolean(
    range &&
      periodo &&
      periodo !== "personalizado" &&
      range[0].isSame(rangoDePeriodo(periodo, dayjs())[0], "day") &&
      range[1].isSame(rangoDePeriodo(periodo, dayjs())[1], "day")
  );

  const desde = range ? range[0].format(FMT_FECHA) : undefined;
  const hasta = range ? range[1].format(FMT_FECHA) : undefined;

  return {
    range,
    periodo,
    desde,
    hasta,
    enPeriodoActual,
    descripcion: descripcionRango(periodo, range),
    query: range
      ? `desde=${range[0].format(FMT_FECHA)}&hasta=${range[1].format(FMT_FECHA)}`
      : "",
    previousRange: range ? rangoAnterior(periodo, range) : null,
    changeRange,
    selectPeriodo,
    shiftPeriodo,
    clear,
  };
}
