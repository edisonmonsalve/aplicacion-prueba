export type Rol = "admin" | "operador";

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: number; // DB devuelve 0 o 1
  created_at: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Category {
  id: number;
  nombre: string;
  productos: number; // cantidad de productos asociados
}

export interface Product {
  id: number;
  sku: string;
  nombre: string;
  category_id: number;
  categoria: string;
  precio: number;
  stock_actual: number;
  stock_minimo: number;
  activo: number;
  created_at: string;
}

