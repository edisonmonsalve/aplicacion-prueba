import { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, DatePicker, Empty, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { listTransactions, reverseTransaction, getFinanceAccounts, getFinanceCategories } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { money, fmtDate } from "./FinanceUtils";
import { canWriteFinance } from "@/utils/roles";
import type {
  FinanceTransaction,
  TransactionsQuery,
  TransactionsSummary,
  TransactionSortKey,
  FinanceCategory,
  FinanceAccount,
} from "@/types";
import TableSkeleton from "@/components/TableSkeleton";
import PageHeader from "@/components/PageHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { fetchAllPages, downloadCsv } from "@/utils/csv";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import TransactionFormModal from "./TransactionFormModal";

const SORT_KEYS: TransactionSortKey[] = [
  "fecha",
  "tipo",
  "categoria",
  "cuenta",
  "producto",
  "monto",
];

const SORT_BY_FIELD: Record<string, TransactionSortKey> = {
  fecha: "fecha",
  tipo: "tipo",
  categoria: "categoria",
  cuenta: "cuenta",
  producto: "producto",
  monto: "monto",
};

const TIPO_OPTIONS = [
  { value: "ingreso", label: "Ingreso" },
  { value: "gasto", label: "Gasto" },
  { value: "activo", label: "Activo" },
  { value: "pasivo", label: "Pasivo" },
];

const TIPO_META: Record<FinanceTransaction["tipo"], { color: string; label: string }> = {
  ingreso: { color: "green", label: "Ingreso" },
  gasto: { color: "red", label: "Gasto" },
  activo: { color: "blue", label: "Activo" },
  pasivo: { color: "purple", label: "Pasivo" },
};

const CATEGORY_TIPO_LABEL: Record<FinanceCategory["tipo"], string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  activo: "Activo",
  pasivo: "Pasivo",
};

export default function TransactionsPage() {
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const canWrite = canWriteFinance(user?.rol);
  const [rows, setRows] = useState<FinanceTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<TransactionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { get, getNumber, getPositiveInt, update } = useUrlFilters();
  const defaultDesde = dayjs().startOf("month").format("YYYY-MM-DD");
  const defaultHasta = dayjs().format("YYYY-MM-DD");
  const page = getPositiveInt("page", 1);
  const pageSize = getPositiveInt("pageSize", 10);
  const tipo = (get("tipo") as FinanceTransaction["tipo"]) ?? undefined;
  const desde = get("desde") ?? defaultDesde;
  const hasta = get("hasta") ?? defaultHasta;
  const categoryId = getNumber("finance_category_id");
  const accountId = getNumber("account_id");
  const rawSort = get("sort");
  const sort = SORT_KEYS.includes(rawSort as TransactionSortKey)
    ? (rawSort as TransactionSortKey)
    : undefined;
  const rawOrder = get("order");
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined;
  const filters = useMemo<TransactionsQuery>(
    () => ({
      page,
      pageSize,
      tipo,
      desde,
      hasta,
      finance_category_id: categoryId,
      account_id: accountId,
      sort,
      order: sort ? order : undefined,
    }),
    [page, pageSize, tipo, desde, hasta, categoryId, accountId, sort, order]
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [reversing, setReversing] = useState<number | null>(null);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);

  useEffect(() => {
    getFinanceCategories().then(setCategories).catch(() => {});
    getFinanceAccounts().then(setAccounts).catch(() => {});
  }, []);

  useDocumentTitle("Transacciones");

  const load = async () => {
    setLoading(true);
    try {
      const r = await listTransactions(filters);
      setRows(r.data);
      setTotal(r.total);
      setResumen(r.resumen);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudieron cargar las transacciones"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleReverse = (id: number) => {
    modal.confirm({
      title: "Anular transacción",
      content: "Se creará una contrapartida del mismo importe. La transacción original quedará marcada como anulada.",
      okButtonProps: { danger: true },
      onOk: async () => {
        setReversing(id);
        try {
          await reverseTransaction(id);
          message.success("Transacción anulada");
          await load();
        } catch (err) {
          message.error(getErrorMessage(err));
        } finally {
          setReversing(null);
        }
      },
    });
  };

  const exportCsv = async () => {
    try {
      const all = await fetchAllPages<FinanceTransaction>((p) =>
        listTransactions({ ...filters, page: p, pageSize: 100 })
      );
      downloadCsv(
        `transacciones-${dayjs().format("YYYY-MM-DD")}.csv`,
        [
          { header: "Fecha", value: (r) => fmtDate(r.fecha) },
          { header: "Tipo", value: (r) => r.tipo },
          { header: "Categoría", value: (r) => r.categoria },
          { header: "Cuenta", value: (r) => r.cuenta },
          { header: "Producto", value: (r) => r.producto ?? "" },
          { header: "Descripción", value: (r) => r.descripcion ?? "" },
          { header: "Monto", value: (r) => r.monto },
          { header: "Afecta caja", value: (r) => (r.afecta_caja === 1 ? "Sí" : "No") },
          { header: "Anulada", value: (r) => (r.anulada ? "Sí" : "No") },
        ],
        all
      );
    } catch {
      message.error("No se pudo exportar");
    }
  };

  const sortOrderFor = (key: TransactionSortKey): "ascend" | "descend" | null =>
    sort === key ? (order === "desc" ? "descend" : "ascend") : null;

  const columns = [
    {
      title: <Tooltip title="Fecha de la transacción">Fecha</Tooltip>,
      dataIndex: "fecha",
      sorter: true,
      sortOrder: sortOrderFor("fecha"),
      render: (v: string) => fmtDate(v),
    },
    {
      title: <Tooltip title="Naturaleza contable del asiento">Tipo</Tooltip>,
      dataIndex: "tipo",
      sorter: true,
      sortOrder: sortOrderFor("tipo"),
      render: (t: FinanceTransaction["tipo"]) => {
        const meta = TIPO_META[t];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: <Tooltip title="Categoría financiera del asiento">Categoría</Tooltip>,
      dataIndex: "categoria",
      sorter: true,
      sortOrder: sortOrderFor("categoria"),
      render: (v: string, r: FinanceTransaction) => (
        <Space size={4} wrap>
          {v}
          {r.afecta_caja === 0 && (
            <Tooltip title="Asiento informativo: afecta utilidad/margen, pero no mueve caja ni saldos.">
              <Tag>No afecta caja</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: <Tooltip title="Cuenta financiera">Cuenta</Tooltip>,
      dataIndex: "cuenta",
      sorter: true,
      sortOrder: sortOrderFor("cuenta"),
    },
    {
      title: <Tooltip title="Producto asociado">Producto</Tooltip>,
      dataIndex: "producto",
      sorter: true,
      sortOrder: sortOrderFor("producto"),
      render: (v: string | null) => v ?? "—",
    },
    {
      title: <Tooltip title="Documento que originó el asiento">Documento</Tooltip>,
      render: (_: unknown, r: FinanceTransaction) =>
        r.invoice_id ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/facturas/${r.invoice_id}`)}>
            Factura #{r.invoice_id}
          </Button>
        ) : r.quote_id ? (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/cotizaciones/${r.quote_id}`)}>
            Cotización #{r.quote_id}
          </Button>
        ) : (
          "—"
        ),
    },
    { title: <Tooltip title="Descripción de la transacción">Descripción</Tooltip>, dataIndex: "descripcion", render: (v: string | null) => v ?? "—" },
    {
      title: <Tooltip title="Importe del asiento">Monto</Tooltip>,
      dataIndex: "monto",
      align: "right" as const,
      sorter: true,
      sortOrder: sortOrderFor("monto"),
      render: (v: number, r: FinanceTransaction) => (
        <Typography.Text
          type={r.tipo === "ingreso" ? "success" : r.tipo === "gasto" ? "danger" : "secondary"}
          strong
        >
          {r.tipo === "ingreso" ? "+" : r.tipo === "gasto" ? "-" : ""}
          {money(v)}
        </Typography.Text>
      ),
    },
    {
      title: <Tooltip title="Vigente, anulada o anulación">Estado</Tooltip>,
      render: (_: unknown, r: FinanceTransaction) =>
        r.anulada_de !== null ? (
          <Tag color="default">Anulación</Tag>
        ) : r.anulada ? (
          <Tag color="orange">Anulada</Tag>
        ) : (
          <Tag color="blue">Vigente</Tag>
        ),
    },
    {
      title: <Tooltip title="Acciones disponibles">Acciones</Tooltip>,
      key: "actions",
      render: (_: unknown, r: FinanceTransaction) => {
        const automatic = r.invoice_id !== null || r.quote_id !== null || r.stock_movement_id !== null;
        if (!canWrite || r.anulada_de !== null || r.anulada) return null;
        if (automatic) {
          return (
            <Tooltip title="Asiento automático: se anula desde su factura o documento de origen">
              <Tag>Automático</Tag>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="Anular con una contrapartida del mismo importe">
            <Button
              size="small"
              danger
              loading={reversing === r.id}
              onClick={() => handleReverse(r.id)}
            >
              Anular
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  const hasFilters = Boolean(
    tipo || categoryId || accountId || desde !== defaultDesde || hasta !== defaultHasta
  );

  const clearFilters = () => {
    update({
      tipo: undefined,
      finance_category_id: undefined,
      account_id: undefined,
      desde: undefined,
      hasta: undefined,
      page: undefined,
    });
  };

  const firstLoad = loading && rows.length === 0;

  return (
    <div>
      <PageHeader
        title="Transacciones"
        description="Registra y consulta los asientos reales. Las transacciones no se editan ni se borran: se anulan con una contrapartida. Los asientos de factura se anulan desde la propia factura."
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>
              Exportar CSV
            </Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                Nueva
              </Button>
            )}
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Los asientos de cabecera se generan al confirmar facturas (ingreso neto, IVA y costo de ventas). Las cotizaciones no contabilizan."
        description="El costo de ventas y el IVA son asientos informativos: se marcan como «No afecta caja» y no modifican el capital disponible."
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Tipo
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 140 }}
            options={TIPO_OPTIONS}
            value={tipo}
            onChange={(v) => update({ tipo: v, page: undefined })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Categoría
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todas"
            style={{ width: 220 }}
            value={categoryId}
            onChange={(v) => update({ finance_category_id: v, page: undefined })}
            options={categories.map((c) => ({ value: c.id, label: `${CATEGORY_TIPO_LABEL[c.tipo]} · ${c.nombre}` }))}
            showSearch
            optionFilterProp="label"
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Cuenta
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todas"
            style={{ width: 200 }}
            value={accountId}
            onChange={(v) => update({ account_id: v, page: undefined })}
            options={accounts.map((a) => ({ value: a.id, label: a.nombre }))}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Rango de fechas
          </Typography.Text>
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
            onChange={(v) =>
              update({
                desde: v?.[0]?.format("YYYY-MM-DD"),
                hasta: v?.[1]?.format("YYYY-MM-DD"),
                page: undefined,
              })
            }
          />
        </div>
        {hasFilters && (
          <Button onClick={clearFilters}>Limpiar filtros</Button>
        )}
      </div>

      {resumen && (
        <Space size={[8, 8]} wrap style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">Totales del filtro (sin anuladas):</Typography.Text>
          <Tooltip title="Suma de los asientos de tipo ingreso">
            <Tag color="green">Ingresos: {money(resumen.ingresos)}</Tag>
          </Tooltip>
          <Tooltip title="Suma de los asientos de tipo gasto">
            <Tag color="red">Egresos: {money(resumen.egresos)}</Tag>
          </Tooltip>
          <Tooltip title="Ingresos menos egresos del filtro actual">
            <Tag color={resumen.neto < 0 ? "red" : "blue"}>Neto: {money(resumen.neto)}</Tag>
          </Tooltip>
        </Space>
      )}

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<FinanceTransaction>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters
                    ? "No hay transacciones que coincidan con los filtros"
                    : "Aún no hay transacciones"
                }
              >
                {hasFilters ? (
                  <Button onClick={clearFilters}>Limpiar filtros</Button>
                ) : (
                  canWrite && (
                    <Button type="primary" onClick={() => setModalOpen(true)}>
                      Registrar la primera
                    </Button>
                  )
                )}
              </Empty>
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} transacciones`,
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra.action === "sort") {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const nextSort = s?.order ? SORT_BY_FIELD[String(s.field)] : undefined;
              // Al cambiar el orden se vuelve a la primera página.
              update({
                page: 1,
                pageSize: pagination.pageSize ?? pageSize,
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
              pageSize: pagination.pageSize ?? pageSize,
            });
          }}
        />
      )}

      <TransactionFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
