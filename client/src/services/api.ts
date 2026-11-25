import axios, { type AxiosError, type AxiosResponse } from "axios";
import {
  apiRoutesWithBody,
  type ApiRequests,
  type ApiResponses,
  type ApiRoutes,
} from "./api-contract.generated";

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

export interface ApiRequestOptions {
  /** Sustituye los parámetros de ruta declarados entre llaves, como `{id}`. */
  params?: Record<string, string | number>;
  /** Parámetros de la query string. */
  query?: object;
}

type ResponseOf<K extends ApiRoutes> = K extends keyof ApiResponses ? ApiResponses[K] : unknown;

/**
 * Petición tipada contra el contrato generado desde los esquemas Zod del servidor.
 * La respuesta se infiere cuando la operación tiene un esquema verificado; si no,
 * se puede indicar con el segundo parámetro genérico.
 */
export function apiRequest<K extends keyof ApiRequests, T = ResponseOf<K>>(
  endpoint: K,
  body: ApiRequests[K],
  options?: ApiRequestOptions
): Promise<AxiosResponse<T>>;
export function apiRequest<K extends Exclude<ApiRoutes, keyof ApiRequests>, T = ResponseOf<K>>(
  endpoint: K,
  options?: ApiRequestOptions
): Promise<AxiosResponse<T>>;
export function apiRequest(
  endpoint: ApiRoutes,
  bodyOrOptions?: unknown,
  options?: ApiRequestOptions
): Promise<AxiosResponse> {
  const [method, template] = endpoint.split(" ");
  const hasBody = apiRoutesWithBody.has(endpoint);
  const body = hasBody ? bodyOrOptions : undefined;
  const requestOptions = (hasBody ? options : bodyOrOptions) as ApiRequestOptions | undefined;

  const url = template.replace(/^\/api/, "").replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = requestOptions?.params?.[name];
    if (value === undefined) throw new Error(`Falta el parámetro de ruta "${name}" en ${endpoint}`);
    return encodeURIComponent(String(value));
  });

  return api.request({
    method: method.toLowerCase(),
    url,
    data: body,
    ...(requestOptions?.query ? { params: requestOptions.query } : {}),
  });
}
