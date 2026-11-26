import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import {
  apiRoutesWithBody,
  type ApiRequests,
  type ApiResponses,
  type ApiRoutes,
} from "./api-contract.generated";

export const api = axios.create({
  baseURL: "/api", // el proxy de Vite lo envía a Express
});

// Cliente sin interceptores para renovar la sesión: evita bucles y que un 401
// del propio refresh dispare otro refresh.
const authApi = axios.create({ baseURL: "/api" });

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshing: Promise<string | null> | null = null;

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

function expireSession() {
  clearSession();
  sessionStorage.setItem("session-expired", "1");
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

/** Renueva el token de acceso. Varias peticiones simultáneas comparten la misma promesa. */
function renewAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    try {
      const { data } = await authApi.post("/auth/refresh", { refreshToken });
      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      return data.token as string;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

// Adjunta el token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const url = config?.url ?? "";
    // Los endpoints de sesión responden 401 por credenciales o token inválido:
    // eso no se reintenta para no ocultar el error real.
    const isSessionEndpoint =
      url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/logout");

    if (
      error.response?.status === 401 &&
      config &&
      !config._retry &&
      !isSessionEndpoint
    ) {
      config._retry = true;
      const token = await renewAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      }
      expireSession();
    } else if (error.response?.status === 401 && config?._retry && !isSessionEndpoint) {
      // El token renovado tampoco sirve: la sesión ya no es válida.
      expireSession();
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
