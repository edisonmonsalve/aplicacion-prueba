import { apiRequest } from "./api";
import type {
  FiscalYearPreview,
  PeriodClosure,
  PeriodClosureInput,
  PeriodClosureSnapshot,
} from "@/types";

export const listPeriodClosures = async () =>
  (await apiRequest<"GET /api/period-closures", PeriodClosure[]>("GET /api/period-closures")).data;

export const getPeriodClosure = async (id: number) =>
  (
    await apiRequest<"GET /api/period-closures/{id}", PeriodClosure>(
      "GET /api/period-closures/{id}",
      { params: { id } }
    )
  ).data;

export const createPeriodClosure = async (input: PeriodClosureInput) =>
  (
    await apiRequest<
      "POST /api/period-closures",
      { id: number; estado: "cerrado"; tipo: "periodo"; snapshot: PeriodClosureSnapshot }
    >("POST /api/period-closures", input)
  ).data;

/** Vista previa del cierre anual: no persiste nada. */
export const previewFiscalYear = async (anio: number) =>
  (
    await apiRequest<"GET /api/period-closures/ejercicios/{anio}/preview", FiscalYearPreview>(
      "GET /api/period-closures/ejercicios/{anio}/preview",
      { params: { anio } }
    )
  ).data;

export const createFiscalClosure = async (anio: number) =>
  (
    await apiRequest<
      "POST /api/period-closures/ejercicios",
      {
        id: number;
        estado: "cerrado";
        tipo: "ejercicio";
        anio: number;
        snapshot: PeriodClosureSnapshot;
      }
    >("POST /api/period-closures/ejercicios", { anio })
  ).data;

/**
 * Reabre un cierre vigente. No lo borra: queda marcado como `reabierto` con el
 * motivo, la fecha y el usuario que lo autorizó.
 */
export const reopenPeriodClosure = async (id: number, motivo: string) =>
  (
    await apiRequest<"POST /api/period-closures/{id}/reabrir", { id: number; estado: "reabierto" }>(
      "POST /api/period-closures/{id}/reabrir",
      { motivo },
      { params: { id } }
    )
  ).data;
