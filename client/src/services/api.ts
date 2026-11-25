import axios, { type AxiosError, type AxiosResponse } from "axios";
import type { ApiRequests } from "./api-contract.generated";

export const api = axios.create({
  baseURL: "/api", // el proxy de Vite lo envía a Express
});

// Adjunta el token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // El login responde 401 con credenciales malas: eso no es una sesión expirada
    const isLogin = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.setItem("session-expired", "1");
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

/**
 * Petición tipada contra el contrato generado desde los esquemas Zod del servidor.
 * El body se infiere de la operación; la respuesta se indica al llamar.
 */
export function apiRequest<K extends keyof ApiRequests, T = unknown>(
  endpoint: K,
  body: ApiRequests[K]
): Promise<AxiosResponse<T>> {
  const [method, path] = endpoint.split(" ");
  return api.request<T>({
    method: method.toLowerCase(),
    url: path.replace(/^\/api/, ""),
    data: body,
  });
}
