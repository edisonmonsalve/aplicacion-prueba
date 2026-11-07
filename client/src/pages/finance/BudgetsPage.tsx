import { useEffect, useState } from "react";
import { App, Button, Empty, Input, Select, Space, Table, Typography } from "antd";
import { EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { listBudgets } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { money, fmtDate, BudgetEstadoTag, periodLabel } from "./FinanceUtils";
import { canWriteFinance } from "@/utils/roles";
import type { BudgetEstado, BudgetListItem, BudgetPeriodo } from "@/types";
import TableSkeleton from "@/components/TableSkeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import BudgetFormModal from "./BudgetFormModal";

const PERIOD_OPTIONS = ["dia", "semana", "mes", "anio"].map((p) => ({ value: p, label: periodLabel(p as "dia" | "semana" | "mes" | "anio") }));
const STATUS_OPTIONS = (["borrador", "activo", "cerrado"] as BudgetEstado[]).map((e) => ({ value: e, label: e }));

export default function BudgetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();
  const canWrite = canWriteFinance(user?.rol);
  const [rows, setRows] = useState<BudgetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<BudgetEstado | undefined>();
  const [tipo, setTipo] = useState<BudgetPeriodo | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

  useDocumentTitle("Presupuestos");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBudgets({ page, pageSize, q: q || undefined, estado, tipo_periodo: tipo })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setTotal(r.total);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudieron cargar los presupuestos")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, q, estado, tipo, message]);

  const columns = [
    { title: "Nombre", dataIndex: "nombre" },
    { title: "Periodo", dataIndex: "tipo_periodo", render: (p: BudgetPeriodo) => periodLabel(p) },
    {
      title: "Rango",
      render: (_: unknown, r: BudgetListItem) => `${fmtDate(r.fecha_inicio)} → ${fmtDate(r.fecha_fin)}`,
    },
    { title: "Estado", dataIndex: "estado", render: (e: BudgetEstado) => <BudgetEstadoTag estado={e} /> },
    { title: "Líneas", dataIndex: "lineas", align: "right" as const },
    { title: "Planeado", dataIndex: "planeado_total", align: "right" as const, render: (v: number) => money(v) },
    { title: "Meta ingresos", dataIndex: "ingreso_meta", align: "right" as const, render: (v: number) => money(v) },
    { title: "Creado por", dataIndex: "creador" },
    {
      title: "",
      key: "actions",
      render: (_: unknown, r: BudgetListItem) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/finanzas/presupuestos/${r.id}`)}>
          Ver
        </Button>
      ),
    },
  ];

  const firstLoad = loading && rows.length === 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Presupuestos</Typography.Title>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Nuevo
          </Button>
        )}
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search allowClear placeholder="Nombre" onSearch={(v) => { setQ(v); setPage(1); }} style={{ width: 240 }} />
        <Select allowClear placeholder="Estado" style={{ width: 140 }} options={STATUS_OPTIONS} onChange={(v) => { setEstado(v); setPage(1); }} />
        <Select allowClear placeholder="Periodo" style={{ width: 140 }} options={PERIOD_OPTIONS} onChange={(v) => { setTipo(v); setPage(1); }} />
      </Space>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<BudgetListItem>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: "max-content" }}
          onRow={(r) => ({ onClick: () => navigate(`/finanzas/presupuestos/${r.id}`), style: { cursor: "pointer" } })}
          locale={{ emptyText: <Empty description="Aún no hay presupuestos" /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} presupuestos`,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
            },
          }}
        />
      )}

      <BudgetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(id) => {
          setModalOpen(false);
          navigate(`/finanzas/presupuestos/${id}`);
        }}
      />
    </div>
  );
}
