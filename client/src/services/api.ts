import axios from "axios";

export const api = axios.create({
  baseURL: "/api", // el proxy de Vite lo envía a Express
});

// Adjunta el token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});