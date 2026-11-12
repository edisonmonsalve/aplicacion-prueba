import "dotenv/config";

const BASE = process.env.SEED_API_URL ?? "http://localhost:3000/api";
const EMAIL = process.env.SEED_EMAIL ?? "demo@demo.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo1234!";

let token = "";

interface LoginResponse {
  token: string;
  user: { email: string; rol: string };
}

interface IdResponse {
  id: number;
}

interface Page<T> {
  data?: T[];
  total?: number;
}

interface Category {
  id: number;
  nombre: string;
}

interface ProductLite {
  id: number;
  sku: string;
}

interface FinanceCategory {
  id: number;
  nombre: string;
  tipo: string;
}

interface BudgetLite {
  id: number;
  nombre: string;
  estado: string;
  fecha_inicio: string;
}

interface AccountLite {
  id: number;
  nombre: string;
  tipo: string;
}

interface ThirdPartyLite {
  id: number;
  nombre: string;
  tipo: string;
}

interface InvoiceItemLite {
  id: number;
  product_id: number;
  cantidad: number;
  precio_unitario: number;
}

interface InvoiceDetailLite {
  id: number;
  numero: string;
  tipo: "venta" | "compra";
  total: number;
  total_neto: number;
  items: InvoiceItemLite[];
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoDay(d);
};

const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown;
  if (!text) {
    data = null;
  } else {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    console.error(`  ✗ ${init.method ?? "GET"} ${path} -> ${res.status}`, data);
    throw new Error(`${path} failed (${res.status})`);
  }
  return data as T;
}

const get = <T = unknown>(p: string) => api<T>(p);
const post = <T = unknown>(p: string, body: unknown) =>
  api<T>(p, { method: "POST", body: JSON.stringify(body) });
const put = <T = unknown>(p: string, body: unknown) =>
  api<T>(p, { method: "PUT", body: JSON.stringify(body) });

function log(msg: string) {
  console.log(msg);
}

async function main() {
  log("=== Iniciando seed demo (obra civil y sistemas) ===");

  // 1. Login
  const login = await post<LoginResponse>("/auth/login", { email: EMAIL, password: PASSWORD });
  token = login.token;
  log(`✓ Login como ${login.user.email} (${login.user.rol})`);

  // 2. Categorías de productos
  const categorias = [
    "Materiales de construcción",
    "Ferretería y herramientas",
    "Equipos de cómputo",
    "Redes y comunicaciones",
    "Software y licencias",
  ];
  const catMap: Record<string, number> = {};
  const existingCats = await get<Category[]>("/categories");
  for (const nombre of categorias) {
    const found = (existingCats ?? []).find((c) => c.nombre === nombre);
    if (found) {
      catMap[nombre] = found.id;
      log(`  · categoría existente: ${nombre}`);
    } else {
      const c = await post<IdResponse>("/categories", { nombre });
      catMap[nombre] = c.id;
      log(`  + categoría: ${nombre}`);
    }
  }

  // 3. Productos
  const productos: Array<{
    sku: string;
    nombre: string;
    categoria: string;
    precio: number;
    costo: number;
    stock_minimo: number;
  }> = [
    { sku: "CEM-001", nombre: "Cemento gris 50 kg", categoria: "Materiales de construcción", precio: 32000, costo: 24000, stock_minimo: 20 },
    { sku: "ARE-001", nombre: "Arena lavada m3", categoria: "Materiales de construcción", precio: 45000, costo: 30000, stock_minimo: 5 },
    { sku: "GRA-001", nombre: "Gravilla m3", categoria: "Materiales de construcción", precio: 50000, costo: 35000, stock_minimo: 5 },
    { sku: "LAD-001", nombre: "Ladrillo común", categoria: "Materiales de construcción", precio: 800, costo: 550, stock_minimo: 500 },
    { sku: "VAR-001", nombre: "Varilla corrugada 1/2", categoria: "Materiales de construcción", precio: 28000, costo: 21000, stock_minimo: 50 },
    { sku: "PIN-001", nombre: "Pintura vinilo 1 galón", categoria: "Materiales de construcción", precio: 45000, costo: 32000, stock_minimo: 10 },
    { sku: "CEM-002", nombre: "Cemento blanco 25 kg", categoria: "Materiales de construcción", precio: 48000, costo: 36000, stock_minimo: 10 },
    { sku: "MAL-001", nombre: "Malla electrosoldada", categoria: "Materiales de construcción", precio: 85000, costo: 62000, stock_minimo: 10 },
    { sku: "TUB-001", nombre: "Tubo PVC 4 pulgadas", categoria: "Materiales de construcción", precio: 18000, costo: 12000, stock_minimo: 30 },
    { sku: "CAB-001", nombre: "Cable eléctrico 12 AWG (m)", categoria: "Materiales de construcción", precio: 2500, costo: 1700, stock_minimo: 100 },
    { sku: "TAL-001", nombre: "Taladro percutor", categoria: "Ferretería y herramientas", precio: 320000, costo: 240000, stock_minimo: 3 },
    { sku: "AMO-001", nombre: "Amoladora 4.5 pulgadas", categoria: "Ferretería y herramientas", precio: 180000, costo: 135000, stock_minimo: 3 },
    { sku: "LLA-001", nombre: "Juego de llaves combinadas", categoria: "Ferretería y herramientas", precio: 65000, costo: 45000, stock_minimo: 5 },
    { sku: "TOR-001", nombre: "Tornillos 2 pulgadas (caja)", categoria: "Ferretería y herramientas", precio: 12000, costo: 8000, stock_minimo: 20 },
    { sku: "ALM-001", nombre: "Alambre galvanizado rollo", categoria: "Ferretería y herramientas", precio: 35000, costo: 24000, stock_minimo: 10 },
    { sku: "ESC-001", nombre: "Escalera de aluminio 2.5 m", categoria: "Ferretería y herramientas", precio: 220000, costo: 165000, stock_minimo: 2 },
    { sku: "LAP-001", nombre: "Laptop empresarial", categoria: "Equipos de cómputo", precio: 3200000, costo: 2500000, stock_minimo: 5 },
    { sku: "MON-001", nombre: "Monitor 24 pulgadas", categoria: "Equipos de cómputo", precio: 650000, costo: 480000, stock_minimo: 8 },
    { sku: "SRV-001", nombre: "Servidor rack", categoria: "Equipos de cómputo", precio: 8500000, costo: 6800000, stock_minimo: 1 },
    { sku: "SSD-001", nombre: "SSD 1 TB", categoria: "Equipos de cómputo", precio: 320000, costo: 240000, stock_minimo: 10 },
    { sku: "IMP-001", nombre: "Impresora láser", categoria: "Equipos de cómputo", precio: 950000, costo: 720000, stock_minimo: 2 },
    { sku: "SWI-001", nombre: "Switch 24 puertos", categoria: "Redes y comunicaciones", precio: 950000, costo: 720000, stock_minimo: 3 },
    { sku: "ROU-001", nombre: "Router WiFi empresarial", categoria: "Redes y comunicaciones", precio: 280000, costo: 210000, stock_minimo: 5 },
    { sku: "CABR-001", nombre: "Cable de red Cat6 (m)", categoria: "Redes y comunicaciones", precio: 1800, costo: 1200, stock_minimo: 200 },
    { sku: "UPS-001", nombre: "UPS 1500 VA", categoria: "Redes y comunicaciones", precio: 780000, costo: 590000, stock_minimo: 2 },
    { sku: "LIC-001", nombre: "Licencia Office 365 anual", categoria: "Software y licencias", precio: 420000, costo: 360000, stock_minimo: 0 },
    { sku: "ANT-001", nombre: "Antivirus empresarial", categoria: "Software y licencias", precio: 180000, costo: 150000, stock_minimo: 0 },
    { sku: "CAD-001", nombre: "Licencia AutoCAD", categoria: "Software y licencias", precio: 1200000, costo: 1000000, stock_minimo: 0 },
    { sku: "WIN-001", nombre: "Windows 11 Pro", categoria: "Software y licencias", precio: 450000, costo: 380000, stock_minimo: 0 },
  ];

  const productMap: Record<string, number> = {};
  const prodRes = await get<Page<ProductLite>>("/products?page=1&pageSize=100");
  const existingProducts = prodRes.data ?? [];
  for (const p of productos) {
    const found = existingProducts.find((x) => x.sku === p.sku);
    if (found) {
      productMap[p.sku] = found.id;
      log(`  · producto existente: ${p.sku}`);
    } else {
      const c = await post<IdResponse>("/products", {
        sku: p.sku,
        nombre: p.nombre,
        category_id: catMap[p.categoria],
        precio: p.precio,
        costo: p.costo,
        stock_minimo: p.stock_minimo,
      });
      productMap[p.sku] = c.id;
      log(`  + producto: ${p.sku} ${p.nombre}`);
    }
  }

  // 4. Usuarios adicionales
  const usuarios = [
    { nombre: "Laura Contadora", email: "contador@demo.com", password: "Demo1234!", rol: "contador" },
    { nombre: "Pedro Operador", email: "operador@demo.com", password: "Demo1234!", rol: "operador" },
    { nombre: "Carla Consulta", email: "consulta@demo.com", password: "Demo1234!", rol: "consulta" },
  ];
  for (const u of usuarios) {
    try {
      await post("/users", u);
      log(`  + usuario: ${u.email} (${u.rol})`);
    } catch {
      log(`  · usuario ya existe: ${u.email}`);
    }
  }

  // 5. Presupuestos
  const financeCats = await get<FinanceCategory[]>("/finance/categories");
  // Líneas presupuestables: gastos y la compra de inventario (activo, pero
  // planificable porque representa salida de caja).
  const gastoCats = (financeCats ?? []).filter(
    (c) => c.tipo === "gasto" || c.nombre === "Inventario"
  );
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const firstDayCurrent = new Date(y, m, 1);
  const lastDayCurrent = new Date(y, m + 1, 0);
  const prevStart = new Date(y, m - 1, 1);
  const prevEnd = new Date(y, m, 0);
  const fmt = isoDay;

  // Presupuesto del mes anterior: se crea ahora, pero se cierra al final.
  // Un presupuesto cerrado bloquea transacciones retroactivas (RN-11), así que
  // primero se carga la historia y luego se formaliza el cierre mensual.
  const closedName = `Presupuesto ${prevStart.toLocaleString("es-CO", { month: "long" })} (cerrado)`;
  let closedBudget: BudgetLite | undefined = (
    await get<Page<BudgetLite>>("/finance/budgets?page=1&pageSize=100")
  ).data?.find((b) => b.nombre === closedName);
  if (!closedBudget) {
    closedBudget = await post<BudgetLite>("/finance/budgets", {
      nombre: closedName,
      tipo_periodo: "mes",
      fecha_inicio: fmt(prevStart),
      fecha_fin: fmt(prevEnd),
      ingreso_meta: 18000000,
      alerta_pct: 80,
      lineas: gastoCats.map((c) => ({
        finance_category_id: c.id,
        monto_planeado: c.nombre.includes("Nómina")
          ? 4500000
          : c.nombre.includes("Arriendo")
            ? 2500000
            : c.nombre === "Inventario"
              ? 6000000
              : c.nombre.includes("Costo de ventas")
                ? 3000000
                : 1500000,
      })),
    });
    log(`  + presupuesto del mes anterior creado: id ${closedBudget.id}`);
  } else {
    log(`  · presupuesto del mes anterior existente: id ${closedBudget.id}`);
  }

  // Presupuesto del mes actual: se activa después del cierre anterior.
  const activeName = `Presupuesto ${firstDayCurrent.toLocaleString("es-CO", { month: "long" })} ${y}`;
  const budgetsList = await get<Page<BudgetLite>>("/finance/budgets?page=1&pageSize=100");
  let activeBudget: BudgetLite | undefined = (budgetsList.data ?? []).find((b) =>
    b.fecha_inicio.startsWith(fmt(firstDayCurrent))
  );
  if (!activeBudget) {
    activeBudget = await post<BudgetLite>("/finance/budgets", {
      nombre: activeName,
      tipo_periodo: "mes",
      fecha_inicio: fmt(firstDayCurrent),
      fecha_fin: fmt(lastDayCurrent),
      ingreso_meta: 25000000,
      alerta_pct: 80,
      lineas: gastoCats.map((c) => ({
        finance_category_id: c.id,
        monto_planeado: c.nombre.includes("Nómina")
          ? 5000000
          : c.nombre.includes("Arriendo")
            ? 2500000
            : c.nombre === "Inventario"
              ? 8000000
              : c.nombre.includes("Costo de ventas")
                ? 4000000
                : 2000000,
      })),
    });
    log(`  + presupuesto del mes actual creado: id ${activeBudget.id}`);
  } else {
    log(`  · presupuesto del mes actual existente: id ${activeBudget.id}`);
  }

  async function finalizeBudgets() {
    const list = await get<Page<BudgetLite>>("/finance/budgets?page=1&pageSize=100");
    const prev = (list.data ?? []).find((b) => b.nombre === closedName);
    const curr = (list.data ?? []).find((b) => b.nombre === activeName);
    try {
      if (prev && prev.estado !== "cerrado") {
        if (prev.estado !== "activo") {
          await post(`/finance/budgets/${prev.id}/activate`, {});
        }
        await post(`/finance/budgets/${prev.id}/close`, {});
        log("  ✓ presupuesto del mes anterior cerrado");
      }
      if (curr && curr.estado !== "activo") {
        await post(`/finance/budgets/${curr.id}/activate`, {});
        log("  ✓ presupuesto actual activado");
      }
    } catch (e) {
      log(`  · no se pudo finalizar presupuestos: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 6. Cuentas con capital inicial. Todo el dinero de la operación sale de aquí:
  // las compras de inventario se pagan desde el banco o quedan a crédito.
  const accounts = await get<AccountLite[]>("/finance/accounts");
  const caja = accounts.find((a) => a.tipo === "caja");
  let cajaId: number;
  if (caja) {
    cajaId = caja.id;
    await put(`/finance/accounts/${caja.id}`, {
      nombre: caja.nombre,
      tipo: "caja",
      saldo_inicial: 3000000,
      activo: true,
    });
  } else {
    const created = await post<IdResponse>("/finance/accounts", {
      nombre: "Caja principal",
      tipo: "caja",
      saldo_inicial: 3000000,
      activo: true,
    });
    cajaId = created.id;
  }
  const banco = accounts.find((a) => a.tipo === "banco");
  let bancoId: number;
  if (banco) {
    bancoId = banco.id;
    await put(`/finance/accounts/${banco.id}`, {
      nombre: banco.nombre,
      tipo: "banco",
      saldo_inicial: 90000000,
      activo: true,
    });
  } else {
    const created = await post<IdResponse>("/finance/accounts", {
      nombre: "Banco principal",
      tipo: "banco",
      saldo_inicial: 90000000,
      activo: true,
    });
    bancoId = created.id;
  }
  log("  · Capital inicial: Caja 3.000.000 · Banco 90.000.000");

  const invoiceRes = await get<Page<unknown>>("/invoices?page=1&pageSize=1");
  if ((invoiceRes.total ?? 0) > 0) {
    log("  · ya existen facturas: no se recrean documentos históricos");
    await finalizeBudgets();
    log("");
    log("=== Seed demo completado (datos existentes) ===");
    return;
  }

  // 7. Terceros: clientes y proveedores del maestro.
  const partyRes = await get<Page<ThirdPartyLite>>("/third-parties?page=1&pageSize=100");
  const existingParties = partyRes.data ?? [];
  async function ensureParty(input: {
    tipo: "cliente" | "proveedor";
    nombre: string;
    documento: string;
    email: string;
    condicion_pago: "contado" | "credito";
    dias_credito: number;
    ciudad: string;
  }) {
    const found = existingParties.find((p) => p.nombre === input.nombre);
    if (found) return found;
    const created = await post<IdResponse>("/third-parties", {
      tipo_documento: "NIT",
      activo: true,
      telefono: "+57 601 555 0100",
      direccion: "Calle 100 # 15-20",
      ...input,
    });
    const party: ThirdPartyLite = { id: created.id, nombre: input.nombre, tipo: input.tipo };
    existingParties.push(party);
    log(`  + tercero: ${input.nombre} (${input.tipo})`);
    return party;
  }

  const andina = await ensureParty({
    tipo: "cliente",
    nombre: "Constructora Andina S.A.S.",
    documento: "900123456-7",
    email: "compras@andina.com",
    condicion_pago: "credito",
    dias_credito: 30,
    ciudad: "Bogotá",
  });
  const norte = await ensureParty({
    tipo: "cliente",
    nombre: "Ingeniería del Norte Ltda.",
    documento: "800987654-3",
    email: "proyectos@ingnorte.com",
    condicion_pago: "contado",
    dias_credito: 0,
    ciudad: "Barranquilla",
  });
  const municipal = await ensureParty({
    tipo: "cliente",
    nombre: "Municipal de Obras Públicas",
    documento: "899999999-1",
    email: "licitaciones@mop.gov.co",
    condicion_pago: "contado",
    dias_credito: 0,
    ciudad: "Medellín",
  });
  const soluciones = await ensureParty({
    tipo: "cliente",
    nombre: "Soluciones IT S.A.S.",
    documento: "901234567-8",
    email: "compras@solit.com",
    condicion_pago: "credito",
    dias_credito: 30,
    ciudad: "Bogotá",
  });
  const rios = await ensureParty({
    tipo: "cliente",
    nombre: "Edificaciones Ríos",
    documento: "900555444-2",
    email: "obras@rios.com",
    condicion_pago: "credito",
    dias_credito: 45,
    ciudad: "Cali",
  });
  const mostrador = await ensureParty({
    tipo: "cliente",
    nombre: "Distribuidora Central",
    documento: "900777888-1",
    email: "ventas@districentral.com",
    condicion_pago: "contado",
    dias_credito: 0,
    ciudad: "Bogotá",
  });
  const provMateriales = await ensureParty({
    tipo: "proveedor",
    nombre: "Materiales del Caribe S.A.S.",
    documento: "900111222-5",
    email: "ventas@matcaribe.com",
    condicion_pago: "credito",
    dias_credito: 30,
    ciudad: "Cartagena",
  });
  const provFerreteria = await ensureParty({
    tipo: "proveedor",
    nombre: "Ferretería Industrial Bogotá",
    documento: "900333444-9",
    email: "pedidos@ferreind.com",
    condicion_pago: "contado",
    dias_credito: 0,
    ciudad: "Bogotá",
  });
  const provTecnologia = await ensureParty({
    tipo: "proveedor",
    nombre: "Tecnología Empresarial S.A.S.",
    documento: "900666777-3",
    email: "cuentas@tecnoempresa.com",
    condicion_pago: "credito",
    dias_credito: 45,
    ciudad: "Medellín",
  });
  const provLicencias = await ensureParty({
    tipo: "proveedor",
    nombre: "Software y Licencias Global",
    documento: "900888999-6",
    email: "facturacion@swglobal.com",
    condicion_pago: "contado",
    dias_credito: 0,
    ciudad: "Bogotá",
  });

  // 8. Facturas de compra: el inventario entra por documento y sale dinero del
  // banco (contado) o queda una cuenta por pagar (crédito).
  const compras = [
    {
      fecha: daysAgo(88),
      proveedor: provMateriales,
      condicion_pago: "credito" as const,
      dias_credito: 30,
      retenciones: true,
      items: [
        { product_id: productMap["CEM-001"], cantidad: 100, precio_unitario: 24000 },
        { product_id: productMap["ARE-001"], cantidad: 20, precio_unitario: 30000 },
        { product_id: productMap["GRA-001"], cantidad: 15, precio_unitario: 35000 },
        { product_id: productMap["LAD-001"], cantidad: 5000, precio_unitario: 550 },
        { product_id: productMap["VAR-001"], cantidad: 200, precio_unitario: 21000 },
        { product_id: productMap["PIN-001"], cantidad: 40, precio_unitario: 32000 },
        { product_id: productMap["CEM-002"], cantidad: 30, precio_unitario: 36000 },
        { product_id: productMap["MAL-001"], cantidad: 25, precio_unitario: 62000 },
        { product_id: productMap["TUB-001"], cantidad: 60, precio_unitario: 12000 },
        { product_id: productMap["CAB-001"], cantidad: 500, precio_unitario: 1700 },
      ],
    },
    {
      fecha: daysAgo(70),
      proveedor: provFerreteria,
      condicion_pago: "contado" as const,
      dias_credito: 0,
      retenciones: false,
      items: [
        { product_id: productMap["TAL-001"], cantidad: 8, precio_unitario: 240000 },
        { product_id: productMap["AMO-001"], cantidad: 6, precio_unitario: 135000 },
        { product_id: productMap["LLA-001"], cantidad: 10, precio_unitario: 45000 },
        { product_id: productMap["TOR-001"], cantidad: 40, precio_unitario: 8000 },
        { product_id: productMap["ALM-001"], cantidad: 20, precio_unitario: 24000 },
        { product_id: productMap["ESC-001"], cantidad: 4, precio_unitario: 165000 },
      ],
    },
    {
      fecha: daysAgo(50),
      proveedor: provTecnologia,
      condicion_pago: "credito" as const,
      dias_credito: 45,
      retenciones: true,
      items: [
        { product_id: productMap["LAP-001"], cantidad: 6, precio_unitario: 2500000 },
        { product_id: productMap["MON-001"], cantidad: 6, precio_unitario: 480000 },
        { product_id: productMap["SRV-001"], cantidad: 1, precio_unitario: 6800000 },
        { product_id: productMap["SSD-001"], cantidad: 10, precio_unitario: 240000 },
        { product_id: productMap["IMP-001"], cantidad: 2, precio_unitario: 720000 },
        { product_id: productMap["SWI-001"], cantidad: 3, precio_unitario: 720000 },
        { product_id: productMap["ROU-001"], cantidad: 5, precio_unitario: 210000 },
        { product_id: productMap["CABR-001"], cantidad: 500, precio_unitario: 1200 },
        { product_id: productMap["UPS-001"], cantidad: 2, precio_unitario: 590000 },
      ],
    },
    {
      fecha: daysAgo(22),
      proveedor: provLicencias,
      condicion_pago: "contado" as const,
      dias_credito: 0,
      retenciones: false,
      items: [
        { product_id: productMap["LIC-001"], cantidad: 8, precio_unitario: 360000 },
        { product_id: productMap["ANT-001"], cantidad: 10, precio_unitario: 150000 },
        { product_id: productMap["CAD-001"], cantidad: 2, precio_unitario: 1000000 },
        { product_id: productMap["WIN-001"], cantidad: 5, precio_unitario: 380000 },
      ],
    },
    {
      // Reposición para un contrato corporativo de fin de mes.
      fecha: daysAgo(33),
      proveedor: provTecnologia,
      condicion_pago: "contado" as const,
      dias_credito: 0,
      retenciones: false,
      items: [
        { product_id: productMap["SRV-001"], cantidad: 1, precio_unitario: 6800000 },
        { product_id: productMap["LAP-001"], cantidad: 3, precio_unitario: 2500000 },
        { product_id: productMap["MON-001"], cantidad: 2, precio_unitario: 480000 },
        { product_id: productMap["SSD-001"], cantidad: 4, precio_unitario: 240000 },
        { product_id: productMap["UPS-001"], cantidad: 1, precio_unitario: 590000 },
        { product_id: productMap["IMP-001"], cantidad: 1, precio_unitario: 720000 },
      ],
    },
  ];

  async function createConfirmedInvoice(payload: Record<string, unknown>) {
    const created = await post<IdResponse & { numero: string }>("/invoices", payload);
    await post(`/invoices/${created.id}/confirmar`, {});
    return get<InvoiceDetailLite>(`/invoices/${created.id}`);
  }

  const comprasCreadas: InvoiceDetailLite[] = [];
  for (const c of compras) {
    const base = c.items.reduce((sum, it) => sum + it.cantidad * it.precio_unitario, 0);
    const detail = await createConfirmedInvoice({
      tipo: "compra",
      fecha: c.fecha,
      contraparte: c.proveedor.nombre,
      party_id: c.proveedor.id,
      condicion_pago: c.condicion_pago,
      dias_credito: c.dias_credito,
      account_id: bancoId,
      retencion_fuente: c.retenciones ? Math.round(base * 0.025) : 0,
      retencion_ica: c.retenciones ? Math.round(base * 0.01) : 0,
      notas: "Compra de inventario para reposición.",
      items: c.items.map((it) => ({
        ...it,
        descuento_pct: 0,
        impuesto_pct: 19,
      })),
    });
    comprasCreadas.push(detail);
    log(`  + compra ${detail.numero} · ${c.proveedor.nombre} · ${money(detail.total_neto)}`);
  }

  // 9. Facturas de venta con fechas escalonadas: contado, crédito vencido,
  // crédito vigente y una devolución parcial (nota crédito).
  const ventas = [
    {
      fecha: daysAgo(75),
      cliente: andina,
      condicion_pago: "credito" as const,
      dias_credito: 30,
      cuenta: bancoId,
      retenciones: false,
      items: [
        { product_id: productMap["CEM-001"], cantidad: 30, precio_unitario: 32000, descuento_pct: 5 },
        { product_id: productMap["LAD-001"], cantidad: 1200, precio_unitario: 800, descuento_pct: 0 },
        { product_id: productMap["VAR-001"], cantidad: 60, precio_unitario: 28000, descuento_pct: 3 },
        { product_id: productMap["TUB-001"], cantidad: 20, precio_unitario: 18000, descuento_pct: 0 },
        { product_id: productMap["CAB-001"], cantidad: 150, precio_unitario: 2500, descuento_pct: 0 },
      ],
    },
    {
      fecha: daysAgo(60),
      cliente: soluciones,
      condicion_pago: "credito" as const,
      dias_credito: 30,
      cuenta: bancoId,
      retenciones: false,
      items: [
        { product_id: productMap["LAP-001"], cantidad: 4, precio_unitario: 3200000, descuento_pct: 8 },
        { product_id: productMap["MON-001"], cantidad: 4, precio_unitario: 650000, descuento_pct: 5 },
        { product_id: productMap["SWI-001"], cantidad: 2, precio_unitario: 950000, descuento_pct: 5 },
      ],
    },
    {
      fecha: daysAgo(45),
      cliente: norte,
      condicion_pago: "contado" as const,
      dias_credito: 0,
      cuenta: bancoId,
      retenciones: false,
      items: [
        { product_id: productMap["CABR-001"], cantidad: 500, precio_unitario: 1800, descuento_pct: 0 },
        { product_id: productMap["ROU-001"], cantidad: 3, precio_unitario: 280000, descuento_pct: 5 },
        { product_id: productMap["UPS-001"], cantidad: 2, precio_unitario: 780000, descuento_pct: 5 },
      ],
    },
    {
      fecha: daysAgo(30),
      cliente: rios,
      condicion_pago: "credito" as const,
      dias_credito: 45,
      cuenta: bancoId,
      retenciones: false,
      items: [
        { product_id: productMap["TAL-001"], cantidad: 2, precio_unitario: 320000, descuento_pct: 0 },
        { product_id: productMap["AMO-001"], cantidad: 2, precio_unitario: 180000, descuento_pct: 0 },
        { product_id: productMap["ESC-001"], cantidad: 1, precio_unitario: 220000, descuento_pct: 0 },
        { product_id: productMap["PIN-001"], cantidad: 10, precio_unitario: 45000, descuento_pct: 0 },
      ],
    },
    {
      fecha: daysAgo(18),
      cliente: municipal,
      condicion_pago: "contado" as const,
      dias_credito: 0,
      cuenta: cajaId,
      retenciones: true,
      items: [
        { product_id: productMap["CEM-001"], cantidad: 25, precio_unitario: 32000, descuento_pct: 0 },
        { product_id: productMap["TUB-001"], cantidad: 15, precio_unitario: 18000, descuento_pct: 0 },
        { product_id: productMap["CAB-001"], cantidad: 100, precio_unitario: 2500, descuento_pct: 0 },
      ],
    },
    {
      fecha: daysAgo(10),
      cliente: andina,
      condicion_pago: "credito" as const,
      dias_credito: 30,
      cuenta: bancoId,
      retenciones: false,
      items: [
        { product_id: productMap["CEM-001"], cantidad: 20, precio_unitario: 32000, descuento_pct: 5 },
        { product_id: productMap["VAR-001"], cantidad: 30, precio_unitario: 28000, descuento_pct: 3 },
        { product_id: productMap["MAL-001"], cantidad: 5, precio_unitario: 85000, descuento_pct: 0 },
      ],
    },
    {
      fecha: daysAgo(4),
      cliente: mostrador,
      condicion_pago: "contado" as const,
      dias_credito: 0,
      cuenta: bancoId,
      retenciones: false,
      items: [
        { product_id: productMap["SSD-001"], cantidad: 2, precio_unitario: 320000, descuento_pct: 0 },
        { product_id: productMap["MON-001"], cantidad: 2, precio_unitario: 650000, descuento_pct: 0 },
      ],
    },
    {
      // Contrato corporativo: servidor, portátiles y respaldo.
      fecha: daysAgo(8),
      cliente: mostrador,
      condicion_pago: "contado" as const,
      dias_credito: 0,
      cuenta: bancoId,
      retenciones: false,
      items: [
        { product_id: productMap["SRV-001"], cantidad: 1, precio_unitario: 8500000, descuento_pct: 5 },
        { product_id: productMap["LAP-001"], cantidad: 3, precio_unitario: 3200000, descuento_pct: 5 },
        { product_id: productMap["MON-001"], cantidad: 2, precio_unitario: 650000, descuento_pct: 5 },
        { product_id: productMap["SSD-001"], cantidad: 4, precio_unitario: 320000, descuento_pct: 5 },
        { product_id: productMap["UPS-001"], cantidad: 1, precio_unitario: 780000, descuento_pct: 5 },
        { product_id: productMap["IMP-001"], cantidad: 1, precio_unitario: 950000, descuento_pct: 5 },
      ],
    },
  ];

  const ventasCreadas: InvoiceDetailLite[] = [];
  for (const v of ventas) {
    const base = v.items.reduce(
      (sum, it) => sum + it.cantidad * it.precio_unitario * (1 - it.descuento_pct / 100),
      0
    );
    const detail = await createConfirmedInvoice({
      tipo: "venta",
      fecha: v.fecha,
      contraparte: v.cliente.nombre,
      party_id: v.cliente.id,
      condicion_pago: v.condicion_pago,
      dias_credito: v.dias_credito,
      account_id: v.cuenta,
      retencion_fuente: v.retenciones ? Math.round(base * 0.025) : 0,
      retencion_ica: v.retenciones ? Math.round(base * 0.01) : 0,
      notas: "Venta de materiales y equipos para proyecto.",
      items: v.items.map((it) => ({ ...it, impuesto_pct: 19 })),
    });
    ventasCreadas.push(detail);
    log(`  + venta ${detail.numero} · ${v.cliente.nombre} · ${money(detail.total_neto)}`);
  }

  // 10. Cobros y pagos parciales sobre las facturas a crédito.
  async function registerPayment(
    invoice: InvoiceDetailLite,
    monto: number,
    fecha: string,
    referencia: string
  ) {
    await post(`/invoices/${invoice.id}/payments`, {
      fecha,
      monto: Math.round(monto * 100) / 100,
      account_id: bancoId,
      metodo: "transferencia",
      referencia,
    });
    log(`  · pago ${referencia} · ${invoice.numero} · ${money(monto)}`);
  }

  const compraMateriales = comprasCreadas[0];
  const compraTecnologia = comprasCreadas[2];
  const ventaAndina = ventasCreadas[0];
  const ventaSoluciones = ventasCreadas[1];

  await registerPayment(compraMateriales, compraMateriales.total_neto, daysAgo(63), "TRF-COMP-001");
  await registerPayment(
    compraTecnologia,
    compraTecnologia.total_neto * 0.5,
    daysAgo(20),
    "TRF-COMP-002"
  );
  await registerPayment(ventaAndina, ventaAndina.total_neto * 0.6, daysAgo(55), "REC-001");
  await registerPayment(ventaSoluciones, ventaSoluciones.total_neto * 0.5, daysAgo(45), "REC-002");

  // 11. Notas crédito/débito sobre facturas confirmadas.
  const ventaDevolucion = ventasCreadas[5];
  const lineaCemento = ventaDevolucion.items.find(
    (it) => it.product_id === productMap["CEM-001"]
  );
  if (lineaCemento) {
    const nota = await post<IdResponse & { numero: string }>(
      `/invoices/${ventaDevolucion.id}/notas`,
      {
        tipo: "credito",
        fecha: daysAgo(7),
        motivo: "Devolución parcial de cemento por material defectuoso",
        afecta_stock: true,
        items: [{ invoice_item_id: lineaCemento.id, cantidad: 5 }],
      }
    );
    log(`  + nota crédito ${nota.numero} sobre ${ventaDevolucion.numero}`);
  }

  const ventaAjuste = ventasCreadas[3];
  const lineaPintura = ventaAjuste.items.find((it) => it.product_id === productMap["PIN-001"]);
  if (lineaPintura) {
    const nota = await post<IdResponse & { numero: string }>(
      `/invoices/${ventaAjuste.id}/notas`,
      {
        tipo: "debito",
        fecha: daysAgo(5),
        motivo: "Ajuste de precio por flete adicional",
        afecta_stock: false,
        items: [
          {
            invoice_item_id: lineaPintura.id,
            cantidad: 1,
            precio_unitario: 50000,
          },
        ],
      }
    );
    log(`  + nota débito ${nota.numero} sobre ${ventaAjuste.numero}`);
  }

  // 12. Gastos operativos recurrentes de los últimos meses.
  const catByNombre: Record<string, number> = Object.fromEntries(
    (financeCats ?? []).map((c) => [c.nombre, c.id])
  );
  const gastos = [
    { categoria: "Nómina", monto: 1600000, cuenta: bancoId, descripcion: "Nómina administrativa y operativa" },
    { categoria: "Arriendo", monto: 800000, cuenta: bancoId, descripcion: "Arriendo de oficina y bodega" },
    { categoria: "Servicios", monto: 250000, cuenta: cajaId, descripcion: "Servicios públicos" },
    { categoria: "Impuestos", monto: 200000, cuenta: bancoId, descripcion: "IVA e impuestos del periodo" },
    { categoria: "Otros gastos", monto: 150000, cuenta: cajaId, descripcion: "Papelería y aseo" },
  ];
  for (const fecha of [daysAgo(70), daysAgo(40), daysAgo(10)]) {
    for (const g of gastos) {
      const categoryId = catByNombre[g.categoria];
      if (!categoryId) continue;
      await post("/finance/transactions", {
        tipo: "gasto",
        monto: g.monto,
        fecha,
        finance_category_id: categoryId,
        account_id: g.cuenta,
        descripcion: g.descripcion,
      });
    }
  }
  log(`  + ${gastos.length * 3} gastos operativos registrados`);

  // 13. Conciliación bancaria demo en curso.
  // Cruza dos transferencias reales del periodo y deja una comisión bancaria
  // pendiente para probar las sugerencias y el cierre.
  const lineaRecaudo = Math.round(ventaAndina.total_neto * 0.6 * 100) / 100;
  const lineaPago = -Math.round(compraTecnologia.total_neto * 0.5 * 100) / 100;
  const comisionBanco = -35000;
  const saldoExtractoInicial = 90000000;
  const saldoExtractoFinal =
    Math.round((saldoExtractoInicial + lineaRecaudo + lineaPago + comisionBanco) * 100) / 100;
  const conciliacion = await post<IdResponse & { estado: string }>(
    "/finance/reconciliations",
    {
      account_id: bancoId,
      nombre: "Banco principal · conciliación en curso",
      fecha_inicio: daysAgo(80),
      fecha_fin: daysAgo(0),
      saldo_extracto_inicial: saldoExtractoInicial,
      saldo_extracto_final: saldoExtractoFinal,
      lineas: [
        {
          fecha: daysAgo(55),
          descripcion: "Recaudo de cartera · Constructora Andina",
          referencia: "REC-001",
          monto: lineaRecaudo,
        },
        {
          fecha: daysAgo(20),
          descripcion: "Pago a proveedor de tecnología",
          referencia: "TRF-COMP-002",
          monto: lineaPago,
        },
        {
          fecha: daysAgo(6),
          descripcion: "Comisión bancaria",
          referencia: "COM-BANCO-01",
          monto: comisionBanco,
          nota: "Pendiente de registrar como gasto",
        },
      ],
    }
  );
  log(`  + conciliación bancaria #${conciliacion.id} con 3 líneas del extracto`);

  // 14. Factura en borrador para probar edición y confirmación manual.
  const borrador = await post<IdResponse & { numero: string }>("/invoices", {
    tipo: "venta",
    fecha: daysAgo(1),
    contraparte: mostrador.nombre,
    party_id: mostrador.id,
    condicion_pago: "contado",
    account_id: cajaId,
    notas: "Borrador pendiente de revisión y confirmación.",
    items: [
      {
        product_id: productMap["CEM-001"],
        cantidad: 10,
        precio_unitario: 32000,
        descuento_pct: 0,
        impuesto_pct: 19,
      },
    ],
  });
  log(`  + factura borrador ${borrador.numero}`);

  // 15. Cotizaciones del embudo comercial (pipeline vigente).
  const quoteRes = await get<Page<unknown>>("/quotes?page=1&pageSize=1");
  if ((quoteRes.total ?? 0) === 0) {
  const clientes = [
    { nombre: "Constructora Andina S.A.S.", documento: "900123456-7", email: "compras@andina.com" },
    { nombre: "Ingeniería del Norte Ltda.", documento: "800987654-3", email: "proyectos@ingnorte.com" },
    { nombre: "Municipal de Obras Públicas", documento: "899999999-1", email: "licitaciones@mop.gov.co" },
    { nombre: "Soluciones IT S.A.S.", documento: "901234567-8", email: "compras@solit.com" },
    { nombre: "Edificaciones Ríos", documento: "900555444-2", email: "obras@rios.com" },
  ];
  // El pipeline se mantiene dentro del stock disponible para que una
  // cotización aprobada pueda convertirse en factura sin compras adicionales.
  const itemsSets = [
    [
      { product_id: productMap["CEM-001"], cantidad: 20, descuento_pct: 5, impuesto_pct: 19 },
      { product_id: productMap["LAD-001"], cantidad: 1000, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["VAR-001"], cantidad: 40, descuento_pct: 3, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["LAP-001"], cantidad: 1, descuento_pct: 8, impuesto_pct: 19 },
      { product_id: productMap["SSD-001"], cantidad: 4, descuento_pct: 8, impuesto_pct: 19 },
      { product_id: productMap["SWI-001"], cantidad: 1, descuento_pct: 5, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["TUB-001"], cantidad: 10, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["ROU-001"], cantidad: 1, descuento_pct: 5, impuesto_pct: 19 },
      { product_id: productMap["CAB-001"], cantidad: 50, descuento_pct: 5, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["LIC-001"], cantidad: 5, descuento_pct: 10, impuesto_pct: 19 },
      { product_id: productMap["ANT-001"], cantidad: 5, descuento_pct: 10, impuesto_pct: 19 },
      { product_id: productMap["CAD-001"], cantidad: 1, descuento_pct: 5, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["TAL-001"], cantidad: 1, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["AMO-001"], cantidad: 1, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["ESC-001"], cantidad: 1, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["PIN-001"], cantidad: 5, descuento_pct: 0, impuesto_pct: 19 },
    ],
  ];
  const valDays = [15, 20, 10, 30, 25];
  const quoteIds: number[] = [];
  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const q = await post<IdResponse>("/quotes", {
      customer_nombre: c.nombre,
      customer_documento: c.documento,
      customer_email: c.email,
      fecha_validez: fmt(new Date(Date.now() + valDays[i] * 86400000)),
      notas: "Cotización generada para proyecto de obra civil y sistemas.",
      items: itemsSets[i],
    });
    quoteIds.push(q.id);
    log(`  + cotización COT-${String(q.id).padStart(6, "0")} para ${c.nombre}`);
  }
  // Transiciones del embudo: enviar todas, aprobar algunas y rechazar una.
  // No se entregan para no descontar stock sin factura asociada.
  for (let i = 0; i < quoteIds.length; i++) {
    const id = quoteIds[i];
    await post(`/quotes/${id}/send`, {});
    if (i === 2) {
      await post(`/quotes/${id}/reject`, {});
      log(`  · cotización ${id} rechazada`);
    } else if (i === 0 || i === 3) {
      await post(`/quotes/${id}/approve`, {});
      log(`  · cotización ${id} aprobada`);
    } else {
      log(`  · cotización ${id} enviada`);
    }
  }  // end for quotes
  }  // end if quotes

  await finalizeBudgets();

  log("");
  log("=== Seed demo completado ===");
  log(`Credenciales demo: ${EMAIL} / ${PASSWORD}`);
  log("Roles adicionales: contador@demo.com, operador@demo.com, consulta@demo.com (clave Demo1234!)");
}

main().catch((e) => {
  console.error("Fallo en seed:", e.message);
  process.exit(1);
});

