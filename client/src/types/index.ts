export type Rol = "admin" | "contador" | "operador" | "consulta";

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
  costo: number | null; // oculto (null) para el rol operador
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
  costo_unitario: number | null; // solo entradas; oculto (null) para el rol operador
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
  descuento_pct: number;
  impuesto_pct: number;
}

// Solo para el formulario: el precio se toma del catálogo y el servidor lo ignora
export interface QuoteLineForm extends QuoteLineInput {
  precio_unitario: number;
}

export interface QuoteInput {
  cliente_nombre: string;
  cliente_documento?: string;
  fecha_validez: string;
  lineas: QuoteLineInput[];
  cliente_email?: string;
  notas?: string;
}

// ---------- Módulo financiero ----------

export type FinanceCategoryTipo = "ingreso" | "gasto";
export type BudgetEstado = "borrador" | "activo" | "cerrado";
export type BudgetPeriodo = "dia" | "semana" | "mes" | "anio";
export type EjecucionEstado = "ok" | "alerta" | "excedido";

export interface FinanceCategory {
  id: number;
  nombre: string;
  tipo: FinanceCategoryTipo;
  activo: number;
  lineas: number;
  transacciones: number;
}

export interface FinanceAccount {
  id: number;
  nombre: string;
  tipo: string;
  saldo_inicial: number;
  activo: number;
  ingresos: number;
  egresos: number;
  saldo_actual: number;
}

export interface BudgetListItem {
  id: number;
  nombre: string;
  tipo_periodo: BudgetPeriodo;
  fecha_inicio: string;
  fecha_fin: string;
  ingreso_meta: number;
  alerta_pct: number;
  estado: BudgetEstado;
  created_by: number;
  creador: string;
  created_at: string;
  updated_at: string;
  lineas: number;
  planeado_total: number;
}

export interface BudgetLine {
  id: number;
  finance_category_id: number;
  product_id: number | null;
  monto_planeado: number;
  categoria: string;
  tipo_categoria: FinanceCategoryTipo;
  sku: string | null;
  producto: string | null;
  real: number;
  disponible: number;
  ejecucion_pct: number;
  estado: EjecucionEstado;
}

export interface BudgetResumen {
  planeado_total: number;
  real_total: number;
  disponible_total: number;
  ejecucion_pct: number;
  estado: EjecucionEstado;
  proyeccion: number | null;
  ingreso_meta: number;
  ingresos_reales: number;
  cumplimiento_ingreso_pct: number;
}

export interface BudgetDetail extends Omit<BudgetListItem, "lineas" | "planeado_total"> {
  lineas: BudgetLine[];
  resumen: BudgetResumen;
}

export interface BudgetLineInput {
  finance_category_id: number;
  product_id?: number | null;
  monto_planeado: number;
}

export interface BudgetInput {
  nombre: string;
  tipo_periodo: BudgetPeriodo;
  fecha_inicio: string;
  fecha_fin: string;
  ingreso_meta: number;
  alerta_pct: number;
  lineas: BudgetLineInput[];
}

export interface FinanceTransaction {
  id: number;
  tipo: "ingreso" | "gasto";
  monto: number;
  fecha: string;
  finance_category_id: number;
  categoria: string;
  account_id: number;
  cuenta: string;
  product_id: number | null;
  sku: string | null;
  producto: string | null;
  quote_id: number | null;
  stock_movement_id: number | null;
  descripcion: string | null;
  anulada_de: number | null;
  created_by: number;
  creador: string;
  created_at: string;
  anulada: number;
}

export interface TransactionInput {
  tipo: "ingreso" | "gasto";
  monto: number;
  fecha: string;
  finance_category_id: number;
  account_id: number;
  product_id?: number | null;
  descripcion?: string;
}

export interface FinanceSummary {
  desde: string;
  hasta: string;
  ingresos: number;
  egresos: number;
  utilidad: number;
  costo_ventas: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  capital_disponible: number;
  por_categoria: { id: number; nombre: string; tipo: FinanceCategoryTipo; total: number }[];
}

export interface StockFailure {
  sku: string;
  nombre: string;
  motivo: string;
  requerido?: number;
  disponible?: number;
}

export interface Suggestion {
  tipo: "reasignar" | "subir" | "precio" | "ingresos" | "sin_movimiento";
  severidad: "info" | "warning" | "danger";
  mensaje: string;
  referencia?: { budget_id?: number; line_id?: number; categoria?: string; producto?: string | null };
}

export interface BudgetAvailability {
  budget_id: number;
  budget_nombre: string;
  finance_category_id: number;
  product_id: number;
  planeado: number;
  real: number;
  disponible: number;
  ejecucion_pct: number;
}

export interface BudgetsQuery {
  page: number;
  pageSize: number;
  q?: string;
  estado?: BudgetEstado;
  tipo_periodo?: BudgetPeriodo;
  desde?: string;
  hasta?: string;
}

export interface TransactionsQuery {
  page: number;
  pageSize: number;
  tipo?: "ingreso" | "gasto";
  desde?: string;
  hasta?: string;
  finance_category_id?: number;
  account_id?: number;
  product_id?: number;
  quote_id?: number;
}

// ---------- Módulo de facturación ----------

export type InvoiceTipo = "venta" | "compra";
export type InvoiceEstado = "borrador" | "confirmada" | "anulada";

export interface Invoice {
  id: number;
  tipo: InvoiceTipo;
  numero: string;
  fecha: string;
  contraparte: string;
  estado: InvoiceEstado;
  total: number;
  created_at: string;
  creador: string;
}

export interface InvoiceItem {
  id?: number;
  product_id: number;
  sku?: string;
  producto?: string;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
  total_linea: number;
}

export interface InvoiceDetail extends Invoice {
  documento: string | null;
  email: string | null;
  notas: string | null;
  created_by: number;
  items: InvoiceItem[];
}

export interface InvoiceItemInput {
  product_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento_pct?: number;
  impuesto_pct?: number;
}

export interface InvoiceInput {
  tipo: InvoiceTipo;
  fecha: string;
  contraparte: string;
  documento?: string;
  email?: string;
  notas?: string;
  items: InvoiceItemInput[];
}

export interface InvoicesQuery {
  page: number;
  pageSize: number;
  tipo?: InvoiceTipo;
  estado?: InvoiceEstado;
  desde?: string;
  hasta?: string;
}
