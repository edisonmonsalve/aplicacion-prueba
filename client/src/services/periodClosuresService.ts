import { api } from "./api";
import type {
  FiscalYearPreview,
  PeriodClosure,
  PeriodClosureInput,
  PeriodClosureSnapshot,
} from "@/types";

export const listPeriodClosures = async () =>
  (await api.get<PeriodClosure[]>("/period-closures")).data;

export const getPeriodClosure = async (id: number) =>
  (await api.get<PeriodClosure>(`/period-closures/${id}`)).data;

export const createPeriodClosure = async (input: PeriodClosureInput) =>
  (await api.post<{ id: number; estado: "cerrado"; tipo: "periodo"; snapshot: PeriodClosureSnapshot }>(
    "/period-closures",
    input
  )).data;

/** Vista previa del cierre anual: no persiste nada. */
export const previewFiscalYear = async (anio: number) =>
  (await api.get<FiscalYearPreview>(`/period-closures/ejercicios/${anio}/preview`)).data;

export const createFiscalClosure = async (anio: number) =>
  (
    await api.post<{
      id: number;
      estado: "cerrado";
      tipo: "ejercicio";
      anio: number;
      snapshot: PeriodClosureSnapshot;
    }>("/period-closures/ejercicios", { anio })
  ).data;

/**
 * Reabre un cierre vigente. No lo borra: queda marcado como `reabierto` con el
 * motivo, la fecha y el usuario que lo autorizó.
 */
export const reopenPeriodClosure = async (id: number, motivo: string) =>
  (await api.post<{ id: number; estado: "reabierto" }>(
    `/period-closures/${id}/reabrir`,
    { motivo }
  )).data;
