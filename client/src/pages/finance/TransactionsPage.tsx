import { useEffect, useState } from "react";
import { App, Button, DatePicker, Empty, Select, Space, Table, Tag, Typography } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
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
];

export default function TransactionsPage() {
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const canWrite = canWriteFinance(user?.rol);
  const [rows, setRows] = useState<FinanceTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tipo, setTipo] = useState<"ingreso" | "gasto" | undefined>();
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
    { title: "Fecha", dataIndex: "fecha", render: (v: string) => fmtDate(v) },
    {
      title: "Tipo",
      dataIndex: "tipo",
      render: (t: FinanceTransaction["tipo"]) => (
        <Tag color={t === "ingreso" ? "green" : "red"}>{t === "ingreso" ? "Ingreso" : "Gasto"}</Tag>
      ),
    },
    { title: "Categoría", dataIndex: "categoria" },
    { title: "Cuenta", dataIndex: "cuenta" },
    { title: "Producto", dataIndex: "producto", render: (v: string | null) => v ?? "—" },
    { title: "Descripción", dataIndex: "descripcion", render: (v: string | null) => v ?? "—" },
    { title: "Monto", dataIndex: "monto", align: "right" as const, render: (v: number, r: FinanceTransaction) => (
      <Typography.Text type={r.tipo === "ingreso" ? "success" : "danger"} strong>
        {r.tipo === "ingreso" ? "+" : "-"}{money(v)}
      </Typography.Text>
    ) },
    {
      title: "Estado",
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
      title: "Acciones",
      key: "actions",
      render: (_: unknown, r: FinanceTransaction) =>
        canWrite &&
        r.anulada_de === null &&
        !r.anulada && (
          <Button
            size="small"
            danger
            loading={reversing === r.id}
            onClick={() => handleReverse(r.id)}
          >
            Anular
          </Button>
        ),
    },
  ];

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

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Tipo"
          style={{ width: 140 }}
          options={TIPO_OPTIONS}
          value={tipo}
          onChange={(v) => { setTipo(v); setPage(1); }}
        />
        <Select
          allowClear
          placeholder="Categoría"
          style={{ width: 220 }}
          value={categoryId}
          onChange={(v) => { setCategoryId(v); setPage(1); }}
          options={categories.map((c) => ({ value: c.id, label: `${c.tipo === "ingreso" ? "Ingreso" : "Gasto"} · ${c.nombre}` }))}
          showSearch
          optionFilterProp="label"
        />
        <Select
          allowClear
          placeholder="Cuenta"
          style={{ width: 200 }}
          value={accountId}
          onChange={(v) => { setAccountId(v); setPage(1); }}
          options={accounts.map((a) => ({ value: a.id, label: a.nombre }))}
        />
        <DatePicker.RangePicker
          format="YYYY-MM-DD"
          value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
          onChange={(v) => {
            setDesde(v?.[0]?.format("YYYY-MM-DD"));
            setHasta(v?.[1]?.format("YYYY-MM-DD"));
            setPage(1);
          }}
        />
      </Space>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<FinanceTransaction>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty description="Aún no hay transacciones" /> }}
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
