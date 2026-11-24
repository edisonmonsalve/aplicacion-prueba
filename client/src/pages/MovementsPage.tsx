import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
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
import dayjs from "dayjs";
import { getMovements, type MovementSortKey, type MovementsQuery } from "@/services/movementsService";
import { getProducts } from "@/services/productsService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import EmptyState from "@/components/EmptyState";
import { formatCurrency, formatNumber } from "@/utils/format";
import { canSeeCosts } from "@/utils/roles";
import { fetchAllPages } from "@/utils/csv";
import { exportReportCsv, printReport, type ReportColumn, type ReportDocument } from "@/utils/reportExport";
import type { StockMovement } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDateRange } from "@/hooks/useDateRange";
import TableSkeleton from "@/components/TableSkeleton";
import PageHeader from "@/components/PageHeader";
import FilterBar, { FilterField } from "@/components/FilterBar";
import RelativeTime from "@/components/RelativeTime";
import PeriodRangePicker from "@/components/PeriodRangePicker";
import ReportExport from "@/components/ReportExport";
import LoadError from "@/components/LoadError";
import useLatestRequest from "@/hooks/useLatestRequest";
import { useUrlFilters } from "@/hooks/useUrlFilters";

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

type MovementSummary = {
  entradas: number;
  salidas: number;
  unidades_entrada: number;
  unidades_salida: number;
};

const EMPTY_SUMMARY: MovementSummary = {
  entradas: 0,
  salidas: 0,
  unidades_entrada: 0,
  unidades_salida: 0,
};

/** Cabecera con ayuda: el subrayado punteado invita a enfocarla con el teclado. */
const ColumnTitle = ({ children, hint }: { children: string; hint: string }) => (
  <Tooltip title={hint}>
    <span className="ui-column-help" tabIndex={0}>
      {children}
    </span>
  </Tooltip>
);

/** Un mismo documento alimenta el CSV y la vista imprimible en PDF. */
function buildReportDoc(
  rows: StockMovement[],
  summary: MovementSummary,
  verCosto: boolean,
  desde?: string,
  hasta?: string
): ReportDocument {
  const columns: ReportColumn[] = [
    { header: "Fecha", format: "date" },
    { header: "SKU" },
    { header: "Producto" },
    { header: "Tipo" },
    { header: "Origen" },
    { header: "Cantidad", format: "number", align: "right" },
    ...(verCosto
      ? [
          { header: "Costo unitario", format: "money" as const, align: "right" as const },
          { header: "Costo total", format: "money" as const, align: "right" as const },
          { header: "Precio unitario", format: "money" as const, align: "right" as const },
        ]
      : []),
    { header: "Documento" },
    { header: "Motivo" },
    { header: "Usuario" },
  ];

  return {
    title: "Movimientos de stock",
    subtitle: `Periodo: ${desde ?? "todo"} — ${hasta ?? "todo"} · ${rows.length} movimiento(s)`,
    meta: [
      { label: "Entradas", value: `${summary.entradas} mov. · ${summary.unidades_entrada} uds` },
      { label: "Salidas", value: `${summary.salidas} mov. · ${summary.unidades_salida} uds` },
      { label: "Total", value: `${rows.length} movimientos` },
    ],
    sections: [
      {
        title: "Historial",
        columns,
        rows: rows.map((m) => [
          m.created_at,
          m.sku,
          m.producto,
          m.tipo === "entrada" ? "Entrada" : "Salida",
          ORIGEN_META[m.origen]?.label ?? m.origen,
          m.cantidad,
          ...(verCosto
            ? [
                m.costo_unitario,
                m.costo_unitario === null ? null : m.costo_unitario * m.cantidad,
                m.precio_unitario,
              ]
            : []),
          m.invoice_id
            ? `Factura #${m.invoice_id}`
            : m.quote_id
              ? `Cotización #${m.quote_id}`
              : "",
          m.motivo ?? "",
          m.usuario,
        ]),
      },
    ],
    notes: verCosto
      ? undefined
      : ["Los importes se omiten porque el rol no tiene acceso a costos."],
  };
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
  const {
    range,
    periodo,
    desde,
    hasta,
    changeRange,
    selectPeriodo,
    shiftPeriodo,
    enPeriodoActual,
  } = useDateRange({ allowClear: true, resetPage: true });
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
  // El esquema del servidor admite como máximo 100 por página: acotar aquí
  // evita un 400 si la URL se comparte con un tamaño mayor.
  const pageSize = getPositiveInt("pageSize", 10, 100);
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
  const [summary, setSummary] = useState<MovementSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(q);
  const { start, isCurrent } = useLatestRequest();

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

  const load = useCallback(() => {
    const requestId = start();
    setLoading(true);
    setError(null);
    getMovements(query)
      .then((res) => {
        if (isCurrent(requestId)) {
          setMovements(res.data);
          setTotal(res.total);
          setSummary(res.summary);
        }
      })
      .catch((err) => {
        if (isCurrent(requestId)) {
          // Sin datos huérfanos del filtro anterior: el error explica por qué
          // la tabla está vacía y el botón Reintentar repite la misma consulta.
          setMovements([]);
          setTotal(0);
          setSummary(EMPTY_SUMMARY);
          setError(getErrorMessage(err, "No se pudo cargar el historial"));
        }
      })
      .finally(() => {
        if (isCurrent(requestId)) setLoading(false);
      });
  }, [query, start, isCurrent]);

  useEffect(() => {
    load();
  }, [load]);

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

  const fetchExportRows = () =>
    fetchAllPages<StockMovement>((p) =>
      getMovements({ ...query, page: p, pageSize: 100 })
    );

  const exportCsv = async () => {
    const rows = await fetchExportRows();
    exportReportCsv(
      `movimientos-${dayjs().format("YYYY-MM-DD")}.csv`,
      buildReportDoc(rows, summary, verCosto, desde, hasta)
    );
  };

  const exportPdf = async (target?: Window | null) => {
    const rows = await fetchExportRows();
    printReport(buildReportDoc(rows, summary, verCosto, desde, hasta), target);
  };

  const columns: TableProps<StockMovement>["columns"] = [
    {
      title: (
        <ColumnTitle hint="Fecha y hora en que se registró el movimiento">
          Fecha
        </ColumnTitle>
      ),
      dataIndex: "created_at",
      sorter: true,
      sortOrder: sortOrderFor("fecha"),
      render: (value: string) => <RelativeTime value={value} />,
    },
    {
      title: (
        <ColumnTitle hint="Producto afectado; el enlace abre su ficha en el catálogo">
          Producto
        </ColumnTitle>
      ),
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
      title: (
        <ColumnTitle hint="Entrada suma stock; salida lo descuenta">
          Tipo
        </ColumnTitle>
      ),
      dataIndex: "tipo",
      sorter: true,
      sortOrder: sortOrderFor("tipo"),
      render: (tipo: StockMovement["tipo"]) =>
        tipo === "entrada" ? <Tag color="green">Entrada</Tag> : <Tag color="orange">Salida</Tag>,
    },
    {
      title: (
        <ColumnTitle hint="Documento o motivo que originó el movimiento">
          Origen
        </ColumnTitle>
      ),
      dataIndex: "origen",
      sorter: true,
      sortOrder: sortOrderFor("origen"),
      render: (origen: StockMovement["origen"]) => {
        const meta = ORIGEN_META[origen] ?? ORIGEN_META.ajuste;
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: (
        <ColumnTitle hint="Unidades del movimiento: las entradas van con + y las salidas con −">
          Cantidad
        </ColumnTitle>
      ),
      dataIndex: "cantidad",
      sorter: true,
      sortOrder: sortOrderFor("cantidad"),
      align: "right",
      render: (_, m) =>
        m.tipo === "entrada" ? `+${formatNumber(m.cantidad)}` : `−${formatNumber(m.cantidad)}`,
    },
    ...(verCosto
      ? ([
          {
            title: (
              <ColumnTitle hint="Costo por unidad guardado en la entrada; si la salida no tiene uno histórico se usa el costo actual del producto. Base del costo de ventas">
                Costo unitario
              </ColumnTitle>
            ),
            dataIndex: "costo_unitario",
            align: "right",
            sorter: true,
            sortOrder: sortOrderFor("costo"),
            render: (value: number | null) =>
              value === null ? (
                <Typography.Text type="secondary">—</Typography.Text>
              ) : (
                <span className="num">{formatCurrency(value)}</span>
              ),
          },
          {
            title: (
              <ColumnTitle hint="Costo unitario multiplicado por la cantidad">
                Costo total
              </ColumnTitle>
            ),
            align: "right",
            render: (_: unknown, m: StockMovement) =>
              m.costo_unitario === null ? (
                <Typography.Text type="secondary">—</Typography.Text>
              ) : (
                <span className="num">{formatCurrency(m.costo_unitario * m.cantidad)}</span>
              ),
          },
          {
            title: (
              <ColumnTitle hint="Precio comercial de la venta (no es costo). Solo se muestra en salidas con precio registrado">
                Precio unitario
              </ColumnTitle>
            ),
            dataIndex: "precio_unitario",
            align: "right",
            sorter: true,
            sortOrder: sortOrderFor("precio"),
            render: (value: number | null) =>
              value === null ? (
                <Typography.Text type="secondary">—</Typography.Text>
              ) : (
                <span className="num">{formatCurrency(value)}</span>
              ),
          },
        ] as NonNullable<TableProps<StockMovement>["columns"]>)
      : []),
    {
      title: (
        <ColumnTitle hint="Factura o cotización vinculada al movimiento">
          Documento
        </ColumnTitle>
      ),
      render: (_, m) =>
        m.invoice_id ? (
          <Link to={`/facturas/${m.invoice_id}`}>Factura #{m.invoice_id}</Link>
        ) : m.quote_id ? (
          <Link to={`/cotizaciones/${m.quote_id}`}>Cotización #{m.quote_id}</Link>
        ) : (
          "—"
        ),
    },
    {
      title: <ColumnTitle hint="Motivo o referencia libre del movimiento">Motivo</ColumnTitle>,
      dataIndex: "motivo",
      render: (v: string | null) => v ?? "—",
    },
    {
      title: <ColumnTitle hint="Persona que registró el movimiento">Usuario</ColumnTitle>,
      dataIndex: "usuario",
    },
  ];

  return (
    <div>
      {contextHolder}
      <PageHeader
        title="Movimientos de stock"
        description="Consulta el historial de entradas y salidas. El stock solo cambia registrando movimientos."
        extra={
          <ReportExport
            disabled={loading || !!error || total === 0}
            onCsv={exportCsv}
            onPdf={exportPdf}
          />
        }
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <PeriodRangePicker
          range={range}
          periodo={periodo}
          onChange={changeRange}
          onSelectPeriodo={selectPeriodo}
          onShift={shiftPeriodo}
          enPeriodoActual={enPeriodoActual}
          allowClear
          size="small"
        />
      </Card>

      <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
        <FilterField label="Buscar" width={300}>
          <Input.Search
            allowClear
            placeholder="SKU, producto, motivo o usuario"
            aria-label="Buscar movimientos"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: "100%" }}
          />
        </FilterField>
        <FilterField label="Producto" width={300}>
          <Select
            aria-label="Producto"
            placeholder="Buscar por SKU o nombre"
            allowClear
            showSearch
            filterOption={false}
            onSearch={setProductSearch}
            loading={productLoading}
            notFoundContent={productLoading ? <Spin size="small" /> : undefined}
            style={{ width: "100%" }}
            value={query.product_id}
            options={productSelectOptions}
            onChange={(product_id) => updateFilters({ product_id })}
          />
        </FilterField>
        <FilterField label="Tipo de movimiento" width={160}>
          <Select
            aria-label="Tipo de movimiento"
            placeholder="Todos"
            allowClear
            style={{ width: "100%" }}
            value={query.tipo}
            options={[
              { value: "entrada", label: "Entradas" },
              { value: "salida", label: "Salidas" },
            ]}
            onChange={(tipo) => updateFilters({ tipo })}
          />
        </FilterField>
        <FilterField label="Origen" width={160}>
          <Select
            aria-label="Origen"
            placeholder="Todos"
            allowClear
            style={{ width: "100%" }}
            value={query.origen}
            options={(Object.keys(ORIGEN_META) as StockMovement["origen"][]).map((o) => ({
              value: o,
              label: ORIGEN_META[o].label,
            }))}
            onChange={(origen) => updateFilters({ origen })}
          />
        </FilterField>
        {(query.invoice_id !== undefined || query.quote_id !== undefined) && (
          <Tag color="processing" style={{ marginBottom: 6 }}>
            {query.invoice_id ? `Factura #${query.invoice_id}` : `Cotización #${query.quote_id}`}
          </Tag>
        )}
      </FilterBar>

      {error && (
        <LoadError
          message="No se pudo cargar el historial de movimientos"
          description={error}
          onRetry={load}
        />
      )}

      {!error && (
        <Space size={8} wrap style={{ marginBottom: 16 }} role="status" aria-live="polite">
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
      )}

      {error ? null : firstLoad ? (
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
              <EmptyState
                variant="inline"
                eyebrow="Inventario"
                title={hasFilters ? "Sin resultados" : "Aún no hay movimientos"}
                description={
                  hasFilters
                    ? "No hay movimientos que coincidan con los filtros."
                    : "Las entradas y salidas de stock aparecerán aquí."
                }
                action={hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
              />
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
