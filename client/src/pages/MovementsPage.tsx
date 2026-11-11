import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { TableProps } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getMovements, type MovementSortKey, type MovementsQuery } from "@/services/movementsService";
import { getProducts } from "@/services/productsService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency } from "@/utils/format";
import { canSeeCosts } from "@/utils/roles";
import { downloadCsv, fetchAllPages, type CsvColumn } from "@/utils/csv";
import type { StockMovement } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import TableSkeleton from "@/components/TableSkeleton";
import PageHeader from "@/components/PageHeader";
import { useUrlFilters } from "@/hooks/useUrlFilters";

const DATE_FMT = "DD/MM/YYYY";

const SORT_KEYS: MovementSortKey[] = [
  "fecha",
  "producto",
  "tipo",
  "origen",
  "cantidad",
  "costo",
  "precio",
];

const SORT_BY_FIELD: Record<string, MovementSortKey> = {
  created_at: "fecha",
  producto: "producto",
  tipo: "tipo",
  origen: "origen",
  cantidad: "cantidad",
  costo_unitario: "costo",
  precio_unitario: "precio",
};

const ORIGEN_META: Record<StockMovement["origen"], { color: string; label: string }> = {
  compra: { color: "blue", label: "Compra" },
  venta: { color: "green", label: "Venta" },
  entrega: { color: "cyan", label: "Entrega" },
  merma: { color: "red", label: "Merma" },
  ajuste: { color: "default", label: "Ajuste" },
};

interface ProductOption {
  value: number;
  label: string;
}

export default function MovementsPage() {
  const { user } = useAuth();
  const verCosto = canSeeCosts(user?.rol);
  const [messageApi, contextHolder] = message.useMessage();
  const { get, getNumber, getPositiveInt, update } = useUrlFilters();

  // Los filtros viven en la URL: "Historial" desde productos llega con
  // ?product_id=... y los enlaces se pueden recargar o compartir.
  const productId = getNumber("product_id");
  const invoiceId = getNumber("invoice_id");
  const quoteId = getNumber("quote_id");
  const tipo = (get("tipo") as MovementsQuery["tipo"]) ?? undefined;
  const origen = (get("origen") as MovementsQuery["origen"]) ?? undefined;
  const q = get("q") ?? "";
  const desde = get("desde");
  const hasta = get("hasta");
  const rawSort = get("sort");
  const sort = SORT_KEYS.includes(rawSort as MovementSortKey)
    ? (rawSort as MovementSortKey)
    : undefined;
  // El costo y el precio solo se pueden ordenar si el rol puede verlos.
  const effectiveSort =
    (sort === "costo" || sort === "precio") && !verCosto ? undefined : sort;
  const rawOrder = get("order");
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined;
  const page = getPositiveInt("page", 1);
  const pageSize = getPositiveInt("pageSize", 10);
  const query = useMemo<MovementsQuery>(
    () => ({
      page,
      pageSize,
      product_id: productId,
      tipo,
      origen,
      invoice_id: invoiceId,
      quote_id: quoteId,
      q: q || undefined,
      desde,
      hasta,
      sort: effectiveSort,
      order: effectiveSort ? order : undefined,
    }),
    [page, pageSize, productId, tipo, origen, invoiceId, quoteId, q, desde, hasta, effectiveSort, order]
  );

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState({
    entradas: 0,
    salidas: 0,
    unidades_entrada: 0,
    unidades_salida: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [text, setText] = useState(q);

  // M2: búsqueda remota del producto, sin limitarse a los primeros 100.
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);

  useDocumentTitle("Movimientos");

  const updateFilters = (changes: Partial<MovementsQuery>) =>
    update({ ...changes, page: undefined });

  const sortOrderFor = (key: MovementSortKey): "ascend" | "descend" | null =>
    effectiveSort === key ? (order === "desc" ? "descend" : "ascend") : null;

  // El buscador refleja el filtro de la URL al llegar desde otro módulo.
  useEffect(() => {
    setText(q);
  }, [q]);

  // M1: búsqueda con debounce para no consultar en cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = text.trim();
      if (next !== q) update({ q: next || undefined, page: undefined });
    }, 400);
    return () => clearTimeout(timer);
  }, [text, q, update]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getMovements(query)
      .then((res) => {
        if (ignore) return;
        setMovements(res.data);
        setTotal(res.total);
        setSummary(res.summary);
      })
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudo cargar el historial")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [query, messageApi]);

  // Opciones del selector: búsqueda remota por SKU o nombre.
  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      setProductLoading(true);
      getProducts({ page: 1, pageSize: 20, q: productSearch.trim() || undefined })
        .then((res) => {
          if (!ignore) {
            setProductOptions(
              res.data.map((p) => ({ value: p.id, label: `${p.sku} · ${p.nombre}` }))
            );
          }
        })
        .catch((err) => {
          if (!ignore) messageApi.error(getErrorMessage(err, "No se pudieron buscar productos"));
        })
        .finally(() => {
          if (!ignore) setProductLoading(false);
        });
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [productSearch, messageApi]);

  // Mantiene visible el producto activo aunque no esté en las opciones de la búsqueda.
  useEffect(() => {
    if (!productId) {
      setSelectedProduct(null);
      return;
    }
    let ignore = false;
    getProducts({ page: 1, pageSize: 1, ids: String(productId) })
      .then((res) => {
        const p = res.data.find((item) => item.id === productId) ?? res.data[0];
        if (p && !ignore) setSelectedProduct({ value: p.id, label: `${p.sku} · ${p.nombre}` });
      })
      .catch(() => {
        // Si falla, el selector simplemente muestra el id; no bloquea el historial.
      });
    return () => {
      ignore = true;
    };
  }, [productId]);

  const productSelectOptions = useMemo(() => {
    if (!selectedProduct) return productOptions;
    return productOptions.some((o) => o.value === selectedProduct.value)
      ? productOptions
      : [selectedProduct, ...productOptions];
  }, [productOptions, selectedProduct]);

  const hasFilters =
    query.product_id !== undefined ||
    query.tipo !== undefined ||
    query.origen !== undefined ||
    query.invoice_id !== undefined ||
    query.quote_id !== undefined ||
    Boolean(q) ||
    Boolean(desde) ||
    Boolean(hasta);

  const firstLoad = loading && movements.length === 0;

  const clearFilters = () => {
    setText("");
    setProductSearch("");
    updateFilters({
      product_id: undefined,
      tipo: undefined,
      origen: undefined,
      invoice_id: undefined,
      quote_id: undefined,
      q: undefined,
      desde: undefined,
      hasta: undefined,
    });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages<StockMovement>((p) =>
        getMovements({ ...query, page: p, pageSize: 100 })
      );
      const columns: CsvColumn<StockMovement>[] = [
        { header: "Fecha", value: (m) => dayjs(m.created_at).format("DD/MM/YYYY HH:mm") },
        { header: "SKU", value: (m) => m.sku },
        { header: "Producto", value: (m) => m.producto },
        { header: "Tipo", value: (m) => (m.tipo === "entrada" ? "Entrada" : "Salida") },
        { header: "Origen", value: (m) => ORIGEN_META[m.origen]?.label ?? m.origen },
        { header: "Cantidad", value: (m) => m.cantidad },
        ...(verCosto
          ? [
              { header: "Costo unitario", value: (m: StockMovement) => m.costo_unitario ?? "" },
              {
                header: "Costo total",
                value: (m: StockMovement) =>
                  m.costo_unitario === null ? "" : m.costo_unitario * m.cantidad,
              },
              { header: "Precio unitario", value: (m: StockMovement) => m.precio_unitario ?? "" },
            ]
          : []),
        {
          header: "Documento",
          value: (m) => (m.invoice_id ? `Factura #${m.invoice_id}` : m.quote_id ? `Cotización #${m.quote_id}` : ""),
        },
        { header: "Motivo", value: (m) => m.motivo ?? "" },
        { header: "Usuario", value: (m) => m.usuario },
      ];
      downloadCsv(`movimientos-${dayjs().format("YYYY-MM-DD")}.csv`, columns, all);
      messageApi.success(`${all.length} movimiento(s) exportado(s)`);
    } catch (err) {
      messageApi.error(getErrorMessage(err, "No se pudo exportar"));
    } finally {
      setExporting(false);
    }
  };

  const columns: TableProps<StockMovement>["columns"] = [
    {
      title: <Tooltip title="Fecha y hora en que se registró el movimiento">Fecha</Tooltip>,
      dataIndex: "created_at",
      sorter: true,
      sortOrder: sortOrderFor("fecha"),
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: <Tooltip title="Producto afectado por el movimiento">Producto</Tooltip>,
      dataIndex: "producto",
      sorter: true,
      sortOrder: sortOrderFor("producto"),
      render: (_, m) => (
        <Tooltip title="Abrir este producto en el catálogo">
          <Link to={`/products?q=${encodeURIComponent(m.sku)}`}>
            {m.sku} · {m.producto}
          </Link>
        </Tooltip>
      ),
    },
    {
      title: <Tooltip title="Entrada (suma stock) o salida (resta stock)">Tipo</Tooltip>,
      dataIndex: "tipo",
      sorter: true,
      sortOrder: sortOrderFor("tipo"),
      render: (tipo: StockMovement["tipo"]) =>
        tipo === "entrada" ? <Tag color="green">Entrada</Tag> : <Tag color="orange">Salida</Tag>,
    },
    {
      title: <Tooltip title="Documento que originó el movimiento">Origen</Tooltip>,
      dataIndex: "origen",
      sorter: true,
      sortOrder: sortOrderFor("origen"),
      render: (origen: StockMovement["origen"]) => {
        const meta = ORIGEN_META[origen] ?? ORIGEN_META.ajuste;
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: <Tooltip title="Unidades del movimiento">Cantidad</Tooltip>,
      dataIndex: "cantidad",
      sorter: true,
      sortOrder: sortOrderFor("cantidad"),
      align: "right",
      render: (_, m) => (m.tipo === "entrada" ? `+${m.cantidad}` : `-${m.cantidad}`),
    },
    ...(verCosto
      ? ([
          {
            title: (
              <Tooltip title="Costo histórico por unidad: en entradas es el costo de compra; en salidas, el costo del producto al momento de la salida (base del costo de ventas)">
                Costo unitario
              </Tooltip>
            ),
            dataIndex: "costo_unitario",
            align: "right",
            sorter: true,
            sortOrder: sortOrderFor("costo"),
            render: (value: number | null) => (value === null ? "—" : formatCurrency(value)),
          },
          {
            title: <Tooltip title="Costo histórico por unidad multiplicado por la cantidad">Costo total</Tooltip>,
            align: "right",
            render: (_: unknown, m: StockMovement) =>
              m.costo_unitario === null ? "—" : formatCurrency(m.costo_unitario * m.cantidad),
          },
          {
            title: (
              <Tooltip title="Precio comercial de la venta (no es costo). Solo se muestra en salidas con precio registrado">
                Precio unitario
              </Tooltip>
            ),
            dataIndex: "precio_unitario",
            align: "right",
            sorter: true,
            sortOrder: sortOrderFor("precio"),
            render: (value: number | null) => (value === null ? "—" : formatCurrency(value)),
          },
        ] as NonNullable<TableProps<StockMovement>["columns"]>)
      : []),
    {
      title: <Tooltip title="Factura o cotización vinculada">Documento</Tooltip>,
      render: (_, m) =>
        m.invoice_id ? (
          <Link to={`/facturas/${m.invoice_id}`}>Factura #{m.invoice_id}</Link>
        ) : m.quote_id ? (
          <Link to={`/cotizaciones/${m.quote_id}`}>Cotización #{m.quote_id}</Link>
        ) : (
          "—"
        ),
    },
    { title: <Tooltip title="Motivo o referencia del movimiento">Motivo</Tooltip>, dataIndex: "motivo", render: (v: string | null) => v ?? "—" },
    { title: <Tooltip title="Usuario que registró el movimiento">Usuario</Tooltip>, dataIndex: "usuario" },
  ];

  return (
    <div>
      {contextHolder}
      <PageHeader
        title="Movimientos de stock"
        description="Consulta el historial de entradas y salidas. El stock solo cambia registrando movimientos."
        extra={
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportCsv}>
            Exportar CSV
          </Button>
        }
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Buscar
          </Typography.Text>
          <Input.Search
            allowClear
            placeholder="SKU, producto, motivo o usuario"
            aria-label="Buscar movimientos"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: 300, maxWidth: "100%" }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Producto
          </Typography.Text>
          <Select
            placeholder="Buscar por SKU o nombre"
            allowClear
            showSearch
            filterOption={false}
            onSearch={setProductSearch}
            loading={productLoading}
            notFoundContent={productLoading ? <Spin size="small" /> : undefined}
            style={{ width: 300, maxWidth: "100%" }}
            value={query.product_id}
            options={productSelectOptions}
            onChange={(product_id) => updateFilters({ product_id })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Tipo de movimiento
          </Typography.Text>
          <Select
            placeholder="Todos"
            allowClear
            style={{ width: 160 }}
            value={query.tipo}
            options={[
              { value: "entrada", label: "Entradas" },
              { value: "salida", label: "Salidas" },
            ]}
            onChange={(tipo) => updateFilters({ tipo })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Origen
          </Typography.Text>
          <Select
            placeholder="Todos"
            allowClear
            style={{ width: 160 }}
            value={query.origen}
            options={(Object.keys(ORIGEN_META) as StockMovement["origen"][]).map((o) => ({
              value: o,
              label: ORIGEN_META[o].label,
            }))}
            onChange={(origen) => updateFilters({ origen })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Rango de fechas
          </Typography.Text>
          <DatePicker.RangePicker
            format={DATE_FMT}
            allowClear
            value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
            onChange={(v) =>
              updateFilters({
                desde: v?.[0]?.format("YYYY-MM-DD"),
                hasta: v?.[1]?.format("YYYY-MM-DD"),
              })
            }
            style={{ width: 280, maxWidth: "100%" }}
          />
        </div>
        {(query.invoice_id !== undefined || query.quote_id !== undefined) && (
          <Tag color="processing" style={{ marginBottom: 6 }}>
            {query.invoice_id ? `Factura #${query.invoice_id}` : `Cotización #${query.quote_id}`}
          </Tag>
        )}
        {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
      </div>

      <Space size={8} wrap style={{ marginBottom: 16 }}>
        <Tag color="green" style={{ margin: 0, padding: "4px 10px" }}>
          Entradas: <strong>{summary.entradas}</strong> mov. · <strong>{summary.unidades_entrada}</strong> uds
        </Tag>
        <Tag color="orange" style={{ margin: 0, padding: "4px 10px" }}>
          Salidas: <strong>{summary.salidas}</strong> mov. · <strong>{summary.unidades_salida}</strong> uds
        </Tag>
        <Tag color="blue" style={{ margin: 0, padding: "4px 10px" }}>
          Total: <strong>{total}</strong> movimientos
        </Tag>
      </Space>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<StockMovement>
          rowKey="id"
          columns={columns}
          dataSource={movements}
          loading={loading}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters
                    ? "No hay movimientos que coincidan con los filtros"
                    : "Aún no hay movimientos"
                }
              >
                {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
              </Empty>
            ),
          }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra.action === "sort") {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const nextSort = s?.order ? SORT_BY_FIELD[String(s.field)] : undefined;
              // Al cambiar el orden se vuelve a la primera página.
              update({
                page: 1,
                pageSize: pagination.pageSize ?? query.pageSize,
                sort: nextSort,
                order: nextSort
                  ? s?.order === "descend"
                    ? "desc"
                    : "asc"
                  : undefined,
              });
              return;
            }
            // Paginar conserva el orden vigente.
            update({
              page: pagination.current ?? 1,
              pageSize: pagination.pageSize ?? query.pageSize,
            });
          }}
        />
      )}
    </div>
  );
}
