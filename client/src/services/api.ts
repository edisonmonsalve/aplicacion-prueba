import axios, { type AxiosError } from "axios";

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
  (error) => {
    // Token vencido o inválido: limpiar sesión y volver al login
    // (se excluye el propio login, donde un 401 significa clave incorrecta)
    if (error.response?.status === 401 && error.config?.url !== "/auth/login") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (res) => res,
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
