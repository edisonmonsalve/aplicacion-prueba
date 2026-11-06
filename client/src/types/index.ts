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

export type MovementTipo = "entrada" | "salida";

export interface StockMovement {
  id: number;
  product_id: number;
  sku: string;
  producto: string;
  tipo: MovementTipo;
  cantidad: number;
  motivo: string | null;
  usuario: string;
  created_at: string;
}

export interface LowStockProduct {
  id: number;
  sku: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
}

export interface Dashboard {
  productosActivos: number;
  stockBajo: number;
  movimientosHoy: number;
  valorInventario: number;
  productosStockBajo: LowStockProduct[];
  ultimosMovimientos: StockMovement[];
  movimientosPorDia: { dia: string; tipo: MovementTipo; total: number }[];
  presupuestosPorEstado: { estado: QuoteStatus; total: number }[];
  topProductos: { sku: string; nombre: string; unidades: number }[];
}

export type QuoteStatus = "borrador" | "enviado" | "aprobado" | "rechazado" | "entregado" | "vencido";

export interface Quote {
  id: number;
  numero: string;
  customer_nombre: string;
  customer_documento: string | null;
  customer_email: string | null;
  estado: QuoteStatus;
  fecha_validez: string;
  notas: string | null;
  subtotal: number;
  descuento_total: number;
  impuesto_total: number;
  total: number;
  created_by: number;
  creador: string;
  created_at: string;
}

export interface QuoteLine {
  product_id: number | null;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
  total_linea: number;
}

export interface QuoteHistory {
  estado_anterior: QuoteStatus | null;
  estado_nuevo: QuoteStatus;
  usuario: string;
  created_at: string;
}

export interface QuoteDetail extends Quote {
  items: QuoteLine[];
  historial: QuoteHistory[];
}
export interface QuotesQuery {
  q?: string;
  estado?: QuoteStatus;
  desde?: string;
  hasta?: string;
  page: number;
  pageSize: number;
}

export interface QuoteLineInput {
  product_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
}

export interface QuoteInput {
  cliente_nombre: string;
  cliente_documento?: string;
  fecha_validez: string;
  lineas: QuoteLineInput[];
  cliente_email?: string;
  notas?: string;
}

export interface StockFailure {
  sku: string;
  nombre: string;
  motivo: string;
  requerido?: number;
  disponible?: number;
}
