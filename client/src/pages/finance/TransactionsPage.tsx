import { useEffect, useState } from "react";
import { Alert, App, Button, DatePicker, Empty, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { listTransactions, reverseTransaction, getFinanceAccounts, getFinanceCategories } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { money, fmtDate } from "./FinanceUtils";
import { canWriteFinance } from "@/utils/roles";
import type { FinanceTransaction, TransactionsQuery, FinanceCategory, FinanceAccount } from "@/types";
import TableSkeleton from "@/components/TableSkeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { fetchAllPages, downloadCsv } from "@/utils/csv";
import TransactionFormModal from "./TransactionFormModal";

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
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tipo, setTipo] = useState<FinanceTransaction["tipo"] | undefined>();
  const [desde, setDesde] = useState<string | undefined>(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [hasta, setHasta] = useState<string | undefined>(dayjs().format("YYYY-MM-DD"));
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [accountId, setAccountId] = useState<number | undefined>();
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
      const q: TransactionsQuery = { page, pageSize, tipo, desde, hasta, finance_category_id: categoryId, account_id: accountId };
      const r = await listTransactions(q);
      setRows(r.data);
      setTotal(r.total);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudieron cargar las transacciones"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, tipo, desde, hasta, categoryId, accountId]);

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
        listTransactions({ page: p, pageSize: 100, tipo, desde, hasta, finance_category_id: categoryId, account_id: accountId })
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
          { header: "Anulada", value: (r) => (r.anulada ? "Sí" : "No") },
        ],
        all
      );
    } catch {
      message.error("No se pudo exportar");
    }
  };

  const columns = [
    { title: <Tooltip title="Fecha de la transacción">Fecha</Tooltip>, dataIndex: "fecha", render: (v: string) => fmtDate(v) },
    {
      title: <Tooltip title="Naturaleza contable del asiento">Tipo</Tooltip>,
      dataIndex: "tipo",
      render: (t: FinanceTransaction["tipo"]) => {
        const meta = TIPO_META[t];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    { title: <Tooltip title="Categoría financiera">Categoría</Tooltip>, dataIndex: "categoria" },
    { title: <Tooltip title="Cuenta financiera">Cuenta</Tooltip>, dataIndex: "cuenta" },
    { title: <Tooltip title="Producto asociado">Producto</Tooltip>, dataIndex: "producto", render: (v: string | null) => v ?? "—" },
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

  const defaultDesde = dayjs().startOf("month").format("YYYY-MM-DD");
  const defaultHasta = dayjs().format("YYYY-MM-DD");
  const hasFilters = Boolean(
    tipo || categoryId || accountId || desde !== defaultDesde || hasta !== defaultHasta
  );

  const clearFilters = () => {
    setTipo(undefined);
    setCategoryId(undefined);
    setAccountId(undefined);
    setDesde(defaultDesde);
    setHasta(defaultHasta);
    setPage(1);
  };

  const firstLoad = loading && rows.length === 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Transacciones</Typography.Title>
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
      </div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Registra y consulta los asientos reales. Las transacciones no se editan ni se borran: se anulan
        con una contrapartida. Los asientos de factura se anulan desde la propia factura.
      </Typography.Paragraph>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Los asientos de cabecera se generan al confirmar facturas (ingreso neto, IVA y costo de ventas). Las cotizaciones no contabilizan."
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
            onChange={(v) => { setTipo(v); setPage(1); }}
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
            onChange={(v) => { setCategoryId(v); setPage(1); }}
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
            onChange={(v) => { setAccountId(v); setPage(1); }}
            options={accounts.map((a) => ({ value: a.id, label: a.nombre }))}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Rango de fechas
          </Typography.Text>
          <DatePicker.RangePicker
            format="YYYY-MM-DD"
            value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
            onChange={(v) => {
              setDesde(v?.[0]?.format("YYYY-MM-DD"));
              setHasta(v?.[1]?.format("YYYY-MM-DD"));
              setPage(1);
            }}
          />
        </div>
        {hasFilters && (
          <Button onClick={clearFilters}>Limpiar filtros</Button>
        )}
      </div>

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
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
            },
          }}
        />
      )}

      <TransactionFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
