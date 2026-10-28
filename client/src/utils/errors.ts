import { isAxiosError } from "axios";

export function getErrorMessage(err: unknown, fallback = "Ocurrió un error") {
  if (isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return fallback;
}