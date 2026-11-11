import { useEffect, useState } from "react";import { App, Button, Empty, Input, Select, Table, Tooltip, Typography } from "antd";
import { EyeOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { listBudgets } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { money, fmtDate, BudgetEstadoTag, periodLabel } from "./FinanceUtils";
import { canWriteFinance } from "@/utils/roles";
import type { BudgetEstado, BudgetListItem, BudgetPeriodo, BudgetSortKey } from "@/types";
import TableSkeleton from "@/components/TableSkeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import BudgetFormModal from "./BudgetFormModal";

const SORT_KEYS: BudgetSortKey[] = [
  "nombre",
  "periodo",
  "inicio",
  "estado",
  "lineas",
  "planeado",
  "meta",
  "creador",
];

const SORT_BY_FIELD: Record<string, BudgetSortKey> = {
  nombre: "nombre",
  tipo_periodo: "periodo",
  inicio: "inicio",
  estado: "estado",
  lineas: "lineas",
  planeado_total: "planeado",
  ingreso_meta: "meta",
  creador: "creador",
};

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
  const { get, getPositiveInt, update } = useUrlFilters();
  const q = get("q") ?? "";
  const estado = (get("estado") as BudgetEstado) ?? undefined;
  const tipo = (get("tipo_periodo") as BudgetPeriodo) ?? undefined;
  const rawSort = get("sort");
  const sort = SORT_KEYS.includes(rawSort as BudgetSortKey)
    ? (rawSort as BudgetSortKey)
    : undefined;
  const rawOrder = get("order");
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined;
  const page = getPositiveInt("page", 1);
  const pageSize = getPositiveInt("pageSize", 10);
  const [searchText, setSearchText] = useState(q);
  const [modalOpen, setModalOpen] = useState(false);

  const hasFilters = Boolean(q || estado || tipo);

  const clearFilters = () => {
    setSearchText("");
    update({ q: undefined, estado: undefined, tipo_periodo: undefined, page: undefined });
  };

  useDocumentTitle("Presupuestos");

  // Si la URL cambia (atrás/adelante), el buscador refleja el texto activo.
  useEffect(() => {
    setSearchText(q);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBudgets({ page, pageSize, q: q || undefined, estado, tipo_periodo: tipo, sort, order: sort ? order : undefined })
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
  }, [page, pageSize, q, estado, tipo, sort, order, message]);

  const sortOrderFor = (key: BudgetSortKey): "ascend" | "descend" | null =>
    sort === key ? (order === "desc" ? "descend" : "ascend") : null;

  const columns = [
    {
      title: <Tooltip title="Nombre del presupuesto">Nombre</Tooltip>,
      dataIndex: "nombre",
      sorter: true,
      sortOrder: sortOrderFor("nombre"),
    },
    {
      title: <Tooltip title="Granularidad del periodo">Periodo</Tooltip>,
      dataIndex: "tipo_periodo",
      sorter: true,
      sortOrder: sortOrderFor("periodo"),
      render: (p: BudgetPeriodo) => periodLabel(p),
    },
    {
      title: <Tooltip title="Fechas de inicio y fin del periodo">Rango</Tooltip>,
      key: "inicio",
      sorter: true,
      sortOrder: sortOrderFor("inicio"),
      render: (_: unknown, r: BudgetListItem) => `${fmtDate(r.fecha_inicio)} → ${fmtDate(r.fecha_fin)}`,
    },
    {
      title: <Tooltip title="Estado del presupuesto">Estado</Tooltip>,
      dataIndex: "estado",
      sorter: true,
      sortOrder: sortOrderFor("estado"),
      render: (e: BudgetEstado) => <BudgetEstadoTag estado={e} />,
    },
    {
      title: <Tooltip title="Cantidad de líneas planeadas en el presupuesto">Líneas</Tooltip>,
      dataIndex: "lineas",
      align: "right" as const,
      sorter: true,
      sortOrder: sortOrderFor("lineas"),
    },
    {
      title: <Tooltip title="Monto total planeado en todas las líneas">Planeado</Tooltip>,
      dataIndex: "planeado_total",
      align: "right" as const,
      sorter: true,
      sortOrder: sortOrderFor("planeado"),
      render: (v: number) => money(v),
    },
    {
      title: <Tooltip title="Ingreso total esperado para el periodo">Meta ingresos</Tooltip>,
      dataIndex: "ingreso_meta",
      align: "right" as const,
      sorter: true,
      sortOrder: sortOrderFor("meta"),
      render: (v: number) => money(v),
    },
    {
      title: <Tooltip title="Usuario que creó el presupuesto">Creado por</Tooltip>,
      dataIndex: "creador",
      sorter: true,
      sortOrder: sortOrderFor("creador"),
    },
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
            onSearch={(v) => update({ q: v || undefined, page: undefined })}
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
            onChange={(v) => update({ estado: v, page: undefined })}
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
            onChange={(v) => update({ tipo_periodo: v, page: undefined })}
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
