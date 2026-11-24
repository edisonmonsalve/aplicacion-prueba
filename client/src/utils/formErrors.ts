import type { FormInstance } from "antd";
import { isAxiosError } from "axios";

interface ApiIssue {
  path?: Array<string | number>;
  message?: string;
}

interface ApiErrorBody {
  message?: string;
  errors?: unknown;
}

function errorBody(error: unknown): ApiErrorBody | undefined {
  if (!isAxiosError(error)) return undefined;
  const body = error.response?.data;
  return body && typeof body === "object" ? (body as ApiErrorBody) : undefined;
}

/** Limpia errores previos del servidor antes de volver a enviar. */
export function clearFormErrors(form: FormInstance) {
  form.setFields(form.getFieldsError().map((field) => ({ name: field.name, errors: [] })));
}

/**
 * Traslada los `issues` de Zod al formulario de AntD.
 *
 * El middleware responde `{ message, errors: [{ path, message }] }` y el `path`
 * ya coincide con los nombres del payload (`lineas[0].cantidad`, `items[1]…`),
 * así que el campo afectado queda marcado sin duplicar reglas en el cliente.
 * Devuelve el mensaje que debe mostrar el toast y cuántos campos se marcaron.
 */
export function applyApiErrors(error: unknown, form: FormInstance, fallback: string) {
  const body = errorBody(error);
  const issues = Array.isArray(body?.errors) ? (body.errors as ApiIssue[]) : [];
  const fields = issues
    .map((issue) => ({
      name: (issue.path ?? []).filter(
        (part) => part !== "" && part !== undefined && part !== null
      ),
      errors: [issue.message ?? fallback],
    }))
    .filter((field) => field.name.length > 0);

  if (fields.length > 0) form.setFields(fields);
  return { message: body?.message ?? fallback, fieldCount: fields.length };
}
