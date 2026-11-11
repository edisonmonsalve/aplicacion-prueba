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
export type MovementOrigen = "compra" | "venta" | "entrega" | "merma" | "ajuste";

export interface StockMovement {
  id: number;
  product_id: number;
  sku: string;
  producto: string;
  tipo: MovementTipo;
  origen: MovementOrigen;
  cantidad: number;
  costo_unitario: number | null; // costo histórico; oculto (null) para el rol operador
  precio_unitario: number | null; // precio de venta; oculto (null) para el rol operador
  motivo: string | null;
  invoice_id: number | null;
  quote_id: number | null;
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

export interface DashboardFinance {
  desde: string;
  hasta: string;
  ingresos: number;
  egresos: number;
  utilidad: number;
  margen_bruto_pct: number;
  iva_neto: number;
  capital_disponible: number;
  ingresos_anterior: number;
  egresos_anterior: number;
  utilidad_anterior: number;
  variacion_ingresos_pct: number | null;
  variacion_egresos_pct: number | null;
  variacion_utilidad_pct: number | null;
}

export interface Dashboard {
  productosActivos: number;
  stockBajo: number;
  movimientosHoy: number;
  /** Valor del inventario a precio de venta (precio × stock). */
  valorInventario: number;
  /** Valor del inventario al costo (costo × stock). */
  valorInventarioCosto: number;
  /** Productos activos con stock y costo cero o sin definir. */
  productosSinCosto: number;
  productosStockBajo: LowStockProduct[];
  ultimosMovimientos: StockMovement[];
  movimientosPorDia: { dia: string; tipo: MovementTipo; total: number }[];
  presupuestosPorEstado: { estado: QuoteStatus; total: number }[];
  topProductos: { sku: string; nombre: string; unidades: number }[];
  /** Solo para admin, contador y consulta. */
  finanzas?: DashboardFinance;
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
  /** Cotización entregada que aún no tiene factura confirmada vinculada. */
  pendiente_facturar?: boolean;
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
  facturas: QuoteInvoice[];
}

/** Factura de venta vinculada a una cotización (solo lectura). */
export interface QuoteInvoice {
  id: number;
  numero: string;
  fecha: string;
  estado: InvoiceEstado;
  total: number;
}

export type QuoteSortKey = "numero" | "cliente" | "total" | "fecha_validez" | "fecha";

export interface QuotesQuery {
  q?: string;
  estado?: QuoteStatus;
  desde?: string;
  hasta?: string;
  sort?: QuoteSortKey;
  order?: "asc" | "desc";
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

export type FinanceCategoryTipo = "ingreso" | "gasto" | "activo" | "pasivo";
export type BudgetEstado = "borrador" | "activo" | "cerrado";
export type BudgetPeriodo = "dia" | "semana" | "mes" | "anio";
export type EjecucionEstado = "ok" | "alerta" | "excedido";

export interface FinanceCategory {
  id: number;
  nombre: string;
  /** Código estable de sistema (ventas, costo_ventas, iva_por_pagar, ...). */
  codigo: string | null;
  tipo: FinanceCategoryTipo;
  activo: number;
  /** 1 = mueve caja/bancos; 0 = asiento informativo (costo de ventas, IVA, etc.). */
  afecta_caja: number;
  /** 1 = entra al estado de resultados (P&L); 0 = solo caja o balance. */
  afecta_resultado: number;
  lineas: number;
  transacciones: number;
}

export interface FinanceAccount {
  id: number;
  nombre: string;
  tipo: "caja" | "banco" | string;
  saldo_inicial: number;
  activo: number;
  ingresos: number;
  egresos: number;
  saldo_actual: number;
}

export interface FinanceAccountInput {
  nombre: string;
  tipo: "caja" | "banco";
  saldo_inicial: number;
  activo?: boolean;
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
  product_category_id: number | null;
  monto_planeado: number;
  categoria: string;
  tipo_categoria: FinanceCategoryTipo;
  sku: string | null;
  producto: string | null;
  producto_categoria: string | null;
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
  product_category_id?: number | null;
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
  tipo: FinanceCategoryTipo;
  monto: number;
  fecha: string;
  finance_category_id: number;
  categoria: string;
  codigo: string | null;
  /** 1 = entra al estado de resultados; 0 = solo caja/balance. */
  afecta_resultado: number;
  /** 1 = mueve caja/bancos; 0 = asiento informativo que no afecta caja. */
  afecta_caja: number;
  account_id: number;
  cuenta: string;
  product_id: number | null;
  sku: string | null;
  producto: string | null;
  quote_id: number | null;
  invoice_id: number | null;
  stock_movement_id: number | null;
  descripcion: string | null;
  anulada_de: number | null;
  created_by: number;
  creador: string;
  created_at: string;
  anulada: number;
}

export interface TransactionInput {
  tipo: FinanceCategoryTipo;
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
  /** Entradas reales de caja/bancos (afecta_caja = 1). */
  ingresos: number;
  /** Ingresos del estado de resultados: incluye ventas a crédito aún no cobradas. */
  ingresos_totales: number;
  /** Salidas reales de caja/bancos: gastos y compras de activos (afecta_caja = 1). */
  egresos: number;
  /** Compras de inventario: salida de caja registrada como activo, no como gasto. */
  compras_inventario: number;
  /** Todos los gastos del periodo, incluidos los asientos informativos. */
  gastos_totales: number;
  /** Gastos contables que no mueven caja (costo de ventas, etc.). */
  gastos_no_caja: number;
  utilidad: number;
  costo_ventas: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  iva_por_pagar: number;
  iva_descontable: number;
  /** IVA por pagar − IVA descontable. Negativo = saldo a favor. */
  iva_neto: number;
  capital_disponible: number;
  por_categoria: {
    id: number;
    nombre: string;
    codigo: string | null;
    tipo: FinanceCategoryTipo;
    afecta_caja: number;
    afecta_resultado: number;
    total: number;
  }[];
}

export interface PeriodClosureSnapshot {
  generado_at: string;
  desde: string;
  hasta: string;
  resumen: FinanceSummary;
  facturas: {
    total: number;
    confirmadas: number;
    anuladas: number;
    ventas: number;
    compras: number;
  };
  transacciones: number;
  cartera: {
    por_cobrar: number;
    por_pagar: number;
  };
  retenciones: {
    ventas: number;
    compras: number;
  };
}

export type PeriodClosureEstado = "cerrado" | "reabierto";

export interface PeriodClosure {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: PeriodClosureEstado;
  snapshot: PeriodClosureSnapshot;
  cerrado_at: string;
  reabierto_at: string | null;
  motivo_reapertura: string | null;
  cerrado_por: string;
  reabierto_por: string | null;
}

export interface PeriodClosureInput {
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
}

// ---------- Estado de resultados (P&L) ----------

export interface PnlLine {
  id: number;
  nombre: string;
  codigo: string | null;
  total: number;
  /** Participación de la línea sobre los ingresos del periodo actual. */
  pct: number;
  anterior: number;
  variacion: number | null;
}

export interface PnlGroup {
  total: number;
  lineas: PnlLine[];
}

export interface PnlTotals {
  ingresos: number;
  costo_ventas: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  gastos: number;
  utilidad: number;
  utilidad_pct: number;
}

export interface PnlReport {
  rango: { desde: string; hasta: string; dias: number };
  comparativo: { desde: string; hasta: string; dias: number };
  ingresos: PnlGroup;
  costo_ventas: { total: number; pct: number; lineas: PnlLine[] };
  margen_bruto: number;
  margen_bruto_pct: number;
  gastos: PnlGroup;
  utilidad: number;
  utilidad_pct: number;
  comparativo_totales: PnlTotals;
  variaciones: Record<
    "ingresos" | "costo_ventas" | "margen_bruto" | "gastos" | "utilidad",
    number | null
  >;
}

// ---------- Flujo de caja ----------

export interface CashFlowAccountRow {
  id: number;
  nombre: string;
  tipo: string;
  activo: number;
  saldo_inicial: number;
  entradas: number;
  salidas: number;
  neto: number;
  saldo_final: number;
}

export interface CashFlowMonth {
  /** AAAA-MM */
  mes: string;
  entradas: number;
  salidas: number;
  neto: number;
}

export interface CashFlowReport {
  rango: { desde: string; hasta: string };
  filtro_cuenta: number | null;
  totales: {
    saldo_inicial: number;
    entradas: number;
    salidas: number;
    neto: number;
    saldo_final: number;
  };
  por_cuenta: CashFlowAccountRow[];
  por_mes: CashFlowMonth[];
}

// ---------- Balance simplificado ----------

export interface BalanceCuenta {
  id: number;
  nombre: string;
  tipo: string;
  activo: number;
  saldo: number;
}

export interface BalanceReport {
  as_of: string;
  activo: {
    caja_bancos: number;
    inventario: number;
    cartera_por_cobrar: number;
    iva_a_favor: number;
    retenciones_a_favor: number;
    total: number;
    cuentas: BalanceCuenta[];
    inventario_detalle: { productos: number; sin_costo: number };
    cartera_detalle: { facturas: number };
  };
  pasivo: {
    cartera_por_pagar: number;
    iva_por_pagar: number;
    retenciones_por_pagar: number;
    total: number;
    cartera_detalle: { facturas: number };
  };
  patrimonio: number;
  ecuacion: {
    activo: number;
    pasivo_mas_patrimonio: number;
    cuadra: boolean;
  };
}

// ---------- Rentabilidad analítica ----------

export type ProfitGroup = "producto" | "categoria" | "cliente";

export interface ProfitabilityRow {
  key: string;
  nombre: string;
  sku: string | null;
  categoria: string | null;
  ingresos: number;
  costo: number;
  margen: number;
  margen_pct: number;
  /** Participación de la línea sobre los ingresos totales del periodo. */
  participacion: number;
  unidades: number;
  facturas: number;
}

export interface ProfitabilityReport {
  rango: { desde: string; hasta: string };
  grupo: ProfitGroup;
  resumen: {
    ingresos: number;
    costo: number;
    margen: number;
    margen_pct: number;
    unidades: number;
    facturas: number;
  };
  data: ProfitabilityRow[];
}

// ---------- Rotación y ABC de inventario ----------

export type InventoryAbcClass = "A" | "B" | "C";

export interface InventoryAnalyticsRow {
  id: number;
  sku: string;
  nombre: string;
  categoria: string | null;
  activo: number;
  stock_actual: number;
  costo_unitario: number;
  valor_inventario: number;
  unidades_vendidas: number;
  ingresos: number;
  costo_ventas: number;
  margen: number;
  margen_pct: number;
  /** Costo de ventas / valor del inventario actual; null si no hay inventario. */
  rotacion: number | null;
  dias_inventario: number | null;
  ultima_venta: string | null;
  dias_sin_venta: number | null;
  stock_muerto: boolean;
  sin_costo: boolean;
  participacion: number;
  acumulado: number;
  clase_abc: InventoryAbcClass;
}

export interface InventoryAbcGroup {
  clase: InventoryAbcClass;
  productos: number;
  ingresos: number;
  participacion: number;
}

export interface InventoryAnalyticsReport {
  rango: {
    desde: string;
    hasta: string;
    dias: number;
    dias_muerto: number;
  };
  resumen: {
    valor_inventario: number;
    costo_ventas: number;
    ingresos: number;
    rotacion: number | null;
    dias_inventario: number | null;
    productos: number;
    productos_vendidos: number;
    stock_muerto: { productos: number; valor: number };
    sin_costo: number;
    abc: InventoryAbcGroup[];
  };
  data: InventoryAnalyticsRow[];
}

// ---------- Embudo de cotizaciones ----------

export type QuoteFunnelStageName = "creadas" | "enviadas" | "aprobadas" | "entregadas";

export interface QuoteFunnelStage {
  etapa: QuoteFunnelStageName;
  cotizaciones: number;
  monto: number;
  /** Conversión contra la etapa anterior. */
  tasa_conversion: number;
  /** Conversión contra el total de cotizaciones creadas. */
  tasa_global: number;
}

export type QuoteFunnelState =
  | "borrador"
  | "enviado"
  | "vencido"
  | "aprobado"
  | "rechazado"
  | "entregado";

export interface QuoteFunnelStateRow {
  estado: QuoteFunnelState;
  cotizaciones: number;
  monto: number;
  participacion: number;
}

export interface QuoteFunnelTime {
  promedio: number | null;
  muestra: number;
  minimo: number | null;
  maximo: number | null;
}

export interface QuoteFunnelDetail {
  id: number;
  cliente: string;
  total: number;
  estado: QuoteFunnelState;
  creado_at: string;
  aprobado_at: string | null;
  entregado_at: string | null;
  dias_aprobacion: number | null;
  dias_entrega: number | null;
  dias_ciclo: number | null;
}

export interface QuoteFunnelReport {
  rango: { desde: string; hasta: string };
  resumen: {
    cotizaciones: number;
    monto: number;
    enviadas: number;
    aprobadas: number;
    entregadas: number;
    rechazadas: number;
    tasa_aprobacion: number;
    tasa_cierre: number;
    ticket_promedio: number;
  };
  embudo: QuoteFunnelStage[];
  estados: QuoteFunnelStateRow[];
  tiempos: {
    aprobacion: QuoteFunnelTime;
    entrega: QuoteFunnelTime;
    ciclo: QuoteFunnelTime;
  };
  detalle: QuoteFunnelDetail[];
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
  product_category_id: number | null;
  alcance: "producto" | "categoria" | "general";
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
  vigente?: "0" | "1";
  sort?: BudgetSortKey;
  order?: "asc" | "desc";
}

export type BudgetSortKey =
  | "nombre"
  | "periodo"
  | "inicio"
  | "estado"
  | "lineas"
  | "planeado"
  | "meta"
  | "creador";

export interface TransactionsQuery {
  page: number;
  pageSize: number;
  tipo?: FinanceCategoryTipo;
  desde?: string;
  hasta?: string;
  finance_category_id?: number;
  account_id?: number;
  product_id?: number;
  quote_id?: number;
  invoice_id?: number;
  sort?: TransactionSortKey;
  order?: "asc" | "desc";
}

export type TransactionSortKey =
  | "fecha"
  | "tipo"
  | "categoria"
  | "cuenta"
  | "producto"
  | "monto"
  | "creador";

export interface TransactionsSummary {
  ingresos: number;
  egresos: number;
  neto: number;
}

export interface PaginatedTransactions extends Paginated<FinanceTransaction> {
  resumen: TransactionsSummary;
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
  subtotal: number;
  descuento_total: number;
  impuesto_total: number;
  total: number;
  retencion_fuente: number;
  retencion_iva: number;
  retencion_ica: number;
  total_neto: number;
  quote_id: number | null;
  party_id: number | null;
  condicion_pago: "contado" | "credito";
  dias_credito: number;
  fecha_vencimiento: string | null;
  account_id: number | null;
  orden_compra: string | null;
  created_at: string;
  creador: string;
}

export interface InvoiceTransaction {
  id: number;
  tipo: FinanceCategoryTipo;
  monto: number;
  descripcion: string | null;
  categoria: string;
  cuenta: string;
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
  costo_anterior?: number | null;
}

export interface InvoiceDetail extends Invoice {
  documento: string | null;
  email: string | null;
  notas: string | null;
  quote_numero: string | null;
  created_by: number;
  /** Total de pagos/cobros válidos aplicados a la factura. */
  pagado: number;
  /** Saldo de cartera pendiente (0 si es de contado o está anulada). */
  saldo_pendiente: number;
  estado_cartera: CarteraEstado;
  items: InvoiceItem[];
  transacciones: InvoiceTransaction[];
  pagos: InvoicePayment[];
}

// ---------- Cartera y pagos ----------

export type CarteraEstado = "pendiente" | "parcial" | "pagada" | "vencida" | "no_aplica";
export type PaymentMetodo = "efectivo" | "transferencia" | "tarjeta" | "otro";

export interface InvoicePayment {
  id: number;
  fecha: string;
  monto: number;
  metodo: PaymentMetodo;
  referencia: string | null;
  notas: string | null;
  estado: "valido" | "anulado";
  cuenta: string | null;
  creador: string;
  created_at: string;
  anulada_at: string | null;
}

export interface InvoiceReceivable {
  id: number;
  tipo: InvoiceTipo;
  numero: string;
  fecha: string;
  contraparte: string;
  party_id: number | null;
  condicion_pago: PaymentCondition;
  dias_credito: number;
  fecha_vencimiento: string | null;
  total_neto: number;
  pagado: number;
  saldo_pendiente: number;
  estado_cartera: CarteraEstado;
  dias_vencido: number;
}

export interface ReceivablesSummary {
  por_cobrar: number;
  por_pagar: number;
  vencido: number;
}

export interface ReceivablesQuery {
  page: number;
  pageSize: number;
  q?: string;
  tipo?: InvoiceTipo;
  estado?: CarteraEstado;
  desde?: string;
  hasta?: string;
}

export interface PaginatedReceivables extends Paginated<InvoiceReceivable> {
  resumen: ReceivablesSummary;
}

export interface PaymentInput {
  fecha: string;
  monto: number;
  account_id?: number | null;
  metodo?: PaymentMetodo;
  referencia?: string;
  notas?: string;
}

export interface AgingBucket {
  corriente: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_mas: number;
  total: number;
}

export interface CarteraAging {
  as_of: string;
  periodo: { desde: string; hasta: string; dias: number };
  /** Días de ventas a crédito que representa la cartera actual; null sin ventas. */
  dso: number | null;
  ventas_credito: number;
  facturas_credito: number;
  totales: {
    por_cobrar: number;
    por_pagar: number;
    vencido: number;
    vencido_cobrar: number;
    por_vencer_7d: number;
    facturas_vencidas: number;
  };
  aging: { venta: AgingBucket; compra: AgingBucket };
  top_deudores: {
    contraparte: string;
    party_id: number | null;
    saldo: number;
    vencido: number;
    max_dias: number;
  }[];
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
  orden_compra?: string;
  email?: string;
  notas?: string;
  quote_id?: number | null;
  party_id?: number | null;
  condicion_pago?: "contado" | "credito";
  dias_credito?: number;
  fecha_vencimiento?: string | null;
  account_id?: number | null;
  retencion_fuente?: number;
  retencion_iva?: number;
  retencion_ica?: number;
  items: InvoiceItemInput[];
}

export interface InvoicesQuery {
  page: number;
  pageSize: number;
  q?: string;
  tipo?: InvoiceTipo;
  estado?: InvoiceEstado;
  desde?: string;
  hasta?: string;
  sort?: InvoiceSortKey;
  order?: "asc" | "desc";
}

export type InvoiceSortKey =
  | "numero"
  | "tipo"
  | "contraparte"
  | "estado"
  | "fecha"
  | "total"
  | "creador";

export interface InvoiceSummaryRow {
  documentos: number;
  total: number;
}

export interface InvoiceSummary {
  por_tipo: (InvoiceSummaryRow & { tipo: InvoiceTipo })[];
  por_estado: (InvoiceSummaryRow & { estado: InvoiceEstado })[];
}

export interface PaginatedInvoices extends Paginated<Invoice> {
  resumen: InvoiceSummary;
}

// ---------- Maestro de terceros ----------

export type ThirdPartyTipo = "cliente" | "proveedor" | "ambos";
export type ThirdPartyDocumento = "NIT" | "CC" | "CE" | "PASAPORTE" | "OTRO";
export type PaymentCondition = "contado" | "credito";

export interface ThirdParty {
  id: number;
  tipo: ThirdPartyTipo;
  tipo_documento: ThirdPartyDocumento;
  documento: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  condicion_pago: PaymentCondition;
  dias_credito: number;
  notas: string | null;
  activo: number;
  facturas: number;
  ventas: number;
  compras: number;
  created_at: string;
  updated_at: string;
}

export interface ThirdPartyInput {
  tipo: ThirdPartyTipo;
  tipo_documento: ThirdPartyDocumento;
  documento?: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  condicion_pago: PaymentCondition;
  dias_credito: number;
  notas?: string;
  activo?: boolean;
}

export interface ThirdPartiesQuery {
  page: number;
  pageSize: number;
  q?: string;
  tipo?: ThirdPartyTipo;
  activo?: 0 | 1;
}

export interface PaginatedThirdParties extends Paginated<ThirdParty> {}
