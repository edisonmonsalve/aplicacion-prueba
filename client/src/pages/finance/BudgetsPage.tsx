import { useEffect, useState } from "react";
import { App, Button, Empty, Input, Select, Table, Tooltip, Typography } from "antd";
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
const STATUS_OPTIONS = (["borrador", "activo", "cerrado"] as BudgetEstado[]).map((e) => ({
  value: e,
  label: e.charAt(0).toUpperCase() + e.slice(1),
}));

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
  const [searchText, setSearchText] = useState("");
  const [estado, setEstado] = useState<BudgetEstado | undefined>();
  const [tipo, setTipo] = useState<BudgetPeriodo | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

  const hasFilters = Boolean(q || estado || tipo);

  const clearFilters = () => {
    setQ("");
    setSearchText("");
    setEstado(undefined);
    setTipo(undefined);
    setPage(1);
  };

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
    { title: <Tooltip title="Nombre del presupuesto">Nombre</Tooltip>, dataIndex: "nombre" },
    { title: <Tooltip title="Granularidad del periodo">Periodo</Tooltip>, dataIndex: "tipo_periodo", render: (p: BudgetPeriodo) => periodLabel(p) },
    {
      title: <Tooltip title="Fechas de inicio y fin del periodo">Rango</Tooltip>,
      render: (_: unknown, r: BudgetListItem) => `${fmtDate(r.fecha_inicio)} → ${fmtDate(r.fecha_fin)}`,
    },
    { title: <Tooltip title="Estado del presupuesto">Estado</Tooltip>, dataIndex: "estado", render: (e: BudgetEstado) => <BudgetEstadoTag estado={e} /> },
    { title: <Tooltip title="Cantidad de líneas planeadas en el presupuesto">Líneas</Tooltip>, dataIndex: "lineas", align: "right" as const },
    { title: <Tooltip title="Monto total planeado en todas las líneas">Planeado</Tooltip>, dataIndex: "planeado_total", align: "right" as const, render: (v: number) => money(v) },
    { title: <Tooltip title="Ingreso total esperado para el periodo">Meta ingresos</Tooltip>, dataIndex: "ingreso_meta", align: "right" as const, render: (v: number) => money(v) },
    { title: <Tooltip title="Usuario que creó el presupuesto">Creado por</Tooltip>, dataIndex: "creador" },
    {
      title: "",
      key: "actions",
      render: (_: unknown, r: BudgetListItem) => (
        <Tooltip title="Ver el detalle y la ejecución del presupuesto">
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/finanzas/presupuestos/${r.id}`)}>
            Ver
          </Button>
        </Tooltip>
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
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Planifica cuánto puedes gastar por periodo, categoría o producto. Solo puede haber un presupuesto activo
        por periodo.
      </Typography.Paragraph>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Buscar
          </Typography.Text>
          <Input.Search
            allowClear
            placeholder="Nombre del presupuesto"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(v) => { setQ(v); setPage(1); }}
            style={{ width: 240 }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Estado
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 140 }}
            value={estado}
            options={STATUS_OPTIONS}
            onChange={(v) => { setEstado(v); setPage(1); }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Periodo
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 140 }}
            value={tipo}
            options={PERIOD_OPTIONS}
            onChange={(v) => { setTipo(v); setPage(1); }}
          />
        </div>
        {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
      </div>

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
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters
                    ? "No hay presupuestos que coincidan con los filtros"
                    : "Aún no hay presupuestos"
                }
              >
                {hasFilters ? (
                  <Button onClick={clearFilters}>Limpiar filtros</Button>
                ) : (
                  canWrite && (
                    <Button type="primary" onClick={() => setModalOpen(true)}>
                      Crear el primero
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
