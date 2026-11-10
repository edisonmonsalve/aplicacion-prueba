import "dotenv/config";

const BASE = process.env.SEED_API_URL ?? "http://localhost:3000/api";
const EMAIL = process.env.SEED_EMAIL ?? "demo@demo.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "Demo1234!";

let token = "";

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    console.error(`  ✗ ${init.method ?? "GET"} ${path} -> ${res.status}`, data);
    throw new Error(`${path} failed (${res.status})`);
  }
  return data;
}

const get = (p: string) => api(p);
const post = (p: string, body: any) => api(p, { method: "POST", body: JSON.stringify(body) });
const put = (p: string, body: any) => api(p, { method: "PUT", body: JSON.stringify(body) });
const patch = (p: string, body: any) => api(p, { method: "PATCH", body: JSON.stringify(body) });

function log(msg: string) {
  console.log(msg);
}

async function main() {
  log("=== Iniciando seed demo (obra civil y sistemas) ===");

  // 1. Login
  const login = await post("/auth/login", { email: EMAIL, password: PASSWORD });
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
  const existingCats = await get("/categories");
  for (const nombre of categorias) {
    const found = (existingCats ?? []).find((c: any) => c.nombre === nombre);
    if (found) {
      catMap[nombre] = found.id;
      log(`  · categoría existente: ${nombre}`);
    } else {
      const c = await post("/categories", { nombre });
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
  const prodRes = await get("/products?page=1&pageSize=100");
  const existingProducts = prodRes.data ?? [];
  for (const p of productos) {
    const found = existingProducts.find((x: any) => x.sku === p.sku);
    if (found) {
      productMap[p.sku] = found.id;
      log(`  · producto existente: ${p.sku}`);
    } else {
      const c = await post("/products", {
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
  const financeCats = await get("/finance/categories");
  // Líneas presupuestables: gastos y la compra de inventario (activo, pero
  // planificable porque representa salida de caja).
  const gastoCats = (financeCats ?? []).filter(
    (c: any) => c.tipo === "gasto" || c.nombre === "Inventario"
  );
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const firstDayCurrent = new Date(y, m, 1);
  const lastDayCurrent = new Date(y, m + 1, 0);
  const prevStart = new Date(y, m - 1, 1);
  const prevEnd = new Date(y, m, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Presupuesto cerrado del mes anterior
  const closedName = `Presupuesto ${prevStart.toLocaleString("es-CO", { month: "long" })} (cerrado)`;
  let closedBudget: any = (await get("/finance/budgets?page=1&pageSize=100")).data?.find((b: any) => b.nombre === closedName);
  if (!closedBudget) {
    closedBudget = await post("/finance/budgets", {
      nombre: closedName,
      tipo_periodo: "mes",
      fecha_inicio: fmt(prevStart),
      fecha_fin: fmt(prevEnd),
      ingreso_meta: 18000000,
      alerta_pct: 80,
      lineas: gastoCats.map((c: any) => ({
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
    log(`  + presupuesto cerrado creado: id ${closedBudget.id}`);
    try {
      await post(`/finance/budgets/${closedBudget.id}/activate`, {});
      await post(`/finance/budgets/${closedBudget.id}/close`, {});
      log("  OK presupuesto anterior cerrado");
    } catch (e: any) {
      log(`  · no se pudo activar/cerrar: ${e.message}`);
    }
  } else {
    log(`  · presupuesto cerrado existente: id ${closedBudget.id}`);
  }

  // Presupuesto activo del mes actual
  const activeName = `Presupuesto ${firstDayCurrent.toLocaleString("es-CO", { month: "long" })} ${y}`;
  const budgetsList = await get("/finance/budgets?page=1&pageSize=100");
  let activeBudget: any = (budgetsList.data ?? []).find(
    (b: any) => b.estado === "activo" && b.fecha_inicio.startsWith(fmt(firstDayCurrent))
  );
  if (!activeBudget) {
    // intentar crear
    try {
      activeBudget = await post("/finance/budgets", {
        nombre: activeName,
        tipo_periodo: "mes",
        fecha_inicio: fmt(firstDayCurrent),
        fecha_fin: fmt(lastDayCurrent),
        ingreso_meta: 25000000,
        alerta_pct: 80,
        lineas: gastoCats.map((c: any) => ({
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
      log(`  + presupuesto activo creado: id ${activeBudget.id}`);
      await post(`/finance/budgets/${activeBudget.id}/activate`, {});
      log("  ✓ presupuesto actual activado");
    } catch (e: any) {
      log(`  · no se pudo crear/activar presupuesto actual: ${e.message}`);
      // reusar cualquiera activo
      const bl = await get("/finance/budgets?page=1&pageSize=100");
      activeBudget = (bl.data ?? []).find((b: any) => b.estado === "activo");
      if (activeBudget) log(`  · usando presupuesto activo existente id ${activeBudget.id}`);
    }
  } else {
    log(`  · presupuesto activo existente: id ${activeBudget.id}`);
  }

  // 6. Movimientos de stock (entradas primero)
  const movRes = await get("/movements?page=1&pageSize=1");
  if ((movRes.total ?? 0) === 0) {
  // Entradas (compras)
  const entradas = [
    ["CEM-001", 100],
    ["ARE-001", 20],
    ["GRA-001", 15],
    ["LAD-001", 5000],
    ["VAR-001", 200],
    ["PIN-001", 40],
    ["CEM-002", 30],
    ["MAL-001", 25],
    ["TUB-001", 60],
    ["CAB-001", 500],
    ["TAL-001", 8],
    ["AMO-001", 6],
    ["LLA-001", 10],
    ["TOR-001", 40],
    ["ALM-001", 20],
    ["ESC-001", 4],
    ["LAP-001", 12],
    ["MON-001", 15],
    ["SRV-001", 2],
    ["SSD-001", 20],
    ["IMP-001", 4],
    ["SWI-001", 6],
    ["ROU-001", 10],
    ["CABR-001", 1000],
    ["UPS-001", 4],
    ["LIC-001", 20],
    ["ANT-001", 20],
    ["CAD-001", 5],
    ["WIN-001", 10],
  ];
  for (const [sku, cant] of entradas) {
    await post("/movements", {
      product_id: productMap[sku as string],
      tipo: "entrada",
      cantidad: cant,
      motivo: "Compra inicial de inventario",
    });
  }
  log(`  + ${entradas.length} entradas de stock registradas`);

  // Salidas (entregas/ventas)
  const salidas = [
    ["CEM-001", 30],
    ["LAD-001", 1200],
    ["VAR-001", 60],
    ["TUB-001", 20],
    ["CAB-001", 150],
    ["LAP-001", 4],
    ["MON-001", 3],
    ["CABR-001", 300],
    ["TOR-001", 10],
  ];
  for (const [sku, cant] of salidas) {
    await post("/movements", {
      product_id: productMap[sku as string],
      tipo: "salida",
      cantidad: cant,
      motivo: "Entrega a obra / cliente",
    });
  }
  log(`  + ${salidas.length} salidas de stock registradas`);
  }  // end if movements

  // 7. Transacciones
  const txRes = await get("/finance/transactions?page=1&pageSize=1");
  if ((txRes.total ?? 0) === 0) {
  const accounts = await get("/finance/accounts");
  const accountId = accounts[0].id;
  const catByNombre = Object.fromEntries((financeCats ?? []).map((c: any) => [c.nombre, c.id]));
  const txs = [
    { tipo: "ingreso", monto: 8500000, categoria: "Ventas", descripcion: "Venta de materiales a constructora" },
    { tipo: "ingreso", monto: 3200000, categoria: "Ventas", descripcion: "Venta de equipos de cómputo" },
    { tipo: "ingreso", monto: 4800000, categoria: "Ventas", descripcion: "Servicio de instalación de red" },
    { tipo: "ingreso", monto: 1500000, categoria: "Otros ingresos", descripcion: "Mantenimiento preventivo" },
    { tipo: "ingreso", monto: 900000, categoria: "Otros ingresos", descripcion: "Reintegro de proveedor" },
    { tipo: "activo", monto: 5200000, categoria: "Inventario", descripcion: "Compra de cemento y agregados" },
    { tipo: "activo", monto: 2100000, categoria: "Inventario", descripcion: "Compra de equipos de cómputo" },
    { tipo: "gasto", monto: 4800000, categoria: "Nómina", descripcion: "Nómina quincenal" },
    { tipo: "gasto", monto: 2500000, categoria: "Arriendo", descripcion: "Arriendo de oficina y bodega" },
    { tipo: "gasto", monto: 650000, categoria: "Servicios", descripcion: "Servicios públicos" },
    { tipo: "gasto", monto: 1200000, categoria: "Impuestos", descripcion: "IVA del periodo" },
    { tipo: "gasto", monto: 350000, categoria: "Otros gastos", descripcion: "Papelería y aseo" },
    { tipo: "gasto", monto: 1800000, categoria: "Costo de ventas", descripcion: "Costo de materiales entregados" },
    { tipo: "ingreso", monto: 2700000, categoria: "Ventas", descripcion: "Venta de software y licencias" },
    { tipo: "activo", monto: 900000, categoria: "Inventario", descripcion: "Compra de licencias" },
  ];
  const today = fmt(new Date());
  for (const t of txs) {
    await post("/finance/transactions", {
      tipo: t.tipo,
      monto: t.monto,
      fecha: today,
      finance_category_id: catByNombre[t.categoria],
      account_id: accountId,
      descripcion: t.descripcion,
    });
  }
  log(`  + ${txs.length} transacciones registradas`);
  }  // end if transactions

  // 8. Cotizaciones
  const quoteRes = await get("/quotes?page=1&pageSize=1");
  if ((quoteRes.total ?? 0) === 0) {
  const clientes = [
    { nombre: "Constructora Andina S.A.S.", documento: "900123456-7", email: "compras@andina.com" },
    { nombre: "Ingeniería del Norte Ltda.", documento: "800987654-3", email: "proyectos@ingnorte.com" },
    { nombre: "Municipal de Obras Públicas", documento: "899999999-1", email: "licitaciones@mop.gov.co" },
    { nombre: "Soluciones IT S.A.S.", documento: "901234567-8", email: "compras@solit.com" },
    { nombre: "Edificaciones Ríos", documento: "900555444-2", email: "obras@rios.com" },
  ];
  const itemsSets = [
    [
      { product_id: productMap["CEM-001"], cantidad: 50, descuento_pct: 5, impuesto_pct: 19 },
      { product_id: productMap["LAD-001"], cantidad: 2000, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["VAR-001"], cantidad: 80, descuento_pct: 3, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["LAP-001"], cantidad: 5, descuento_pct: 8, impuesto_pct: 19 },
      { product_id: productMap["MON-001"], cantidad: 5, descuento_pct: 8, impuesto_pct: 19 },
      { product_id: productMap["SWI-001"], cantidad: 2, descuento_pct: 5, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["CABR-001"], cantidad: 500, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["ROU-001"], cantidad: 3, descuento_pct: 5, impuesto_pct: 19 },
      { product_id: productMap["UPS-001"], cantidad: 2, descuento_pct: 5, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["LIC-001"], cantidad: 10, descuento_pct: 10, impuesto_pct: 19 },
      { product_id: productMap["ANT-001"], cantidad: 10, descuento_pct: 10, impuesto_pct: 19 },
      { product_id: productMap["CAD-001"], cantidad: 2, descuento_pct: 5, impuesto_pct: 19 },
    ],
    [
      { product_id: productMap["TAL-001"], cantidad: 2, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["AMO-001"], cantidad: 2, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["ESC-001"], cantidad: 1, descuento_pct: 0, impuesto_pct: 19 },
      { product_id: productMap["PIN-001"], cantidad: 10, descuento_pct: 0, impuesto_pct: 19 },
    ],
  ];
  const valDays = [15, 20, 10, 30, 25];
  const quoteIds: number[] = [];
  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const q = await post("/quotes", {
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
  // Transiciones: enviar todas, aprobar algunas, rechazar una, entregar algunas
  for (let i = 0; i < quoteIds.length; i++) {
    const id = quoteIds[i];
    await post(`/quotes/${id}/send`, {});
    if (i === 2) {
      await post(`/quotes/${id}/reject`, {});
      log(`  · cotización ${id} rechazada`);
    } else if (i === 0 || i === 3) {
      await post(`/quotes/${id}/approve`, {});
      if (i === 0) {
        await post(`/quotes/${id}/deliver`, {});
        log(`  · cotización ${id} entregada (stock descontado)`);
      } else {
        log(`  · cotización ${id} aprobada`);
      }
    } else {
      log(`  · cotización ${id} enviada`);
    }
  }  // end if quotes
  }

  log("");
  log("=== Seed demo completado ===");
  log(`Credenciales demo: ${EMAIL} / ${PASSWORD}`);
  log("Roles adicionales: contador@demo.com, operador@demo.com, consulta@demo.com (clave Demo1234!)");
}

main().catch((e) => {
  console.error("Fallo en seed:", e.message);
  process.exit(1);
});

