import { useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Table,
  Tooltip,
  Typography,
} from "antd";
import { EditOutlined, CheckOutlined, LockOutlined, DeleteOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { getBudget, deleteBudget, activateBudget, closeBudget } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { money, BudgetEstadoTag, EjecucionTag, periodLabel, fmtDate } from "./FinanceUtils";
import { canWriteFinance } from "@/utils/roles";
import type { BudgetDetail, BudgetLine, EjecucionEstado } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import BudgetFormModal from "./BudgetFormModal";

const EJECUCION_COLOR: Record<EjecucionEstado, string> = {
  ok: "#52c41a",
  alerta: "#fa8c16",
  excedido: "#ff4d4f",
};

export default function BudgetDetailPage() {
  const { id } = useParams();
  const budgetId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const canWrite = canWriteFinance(user?.rol);
  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useDocumentTitle("Detalle de presupuesto");

  const load = async () => {
    setLoading(true);
    try {
      const b = await getBudget(budgetId);
      setBudget(b);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo cargar el presupuesto"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId]);

  if (loading || !budget) return <Typography.Paragraph>Cargando…</Typography.Paragraph>;

  const r = budget.resumen;
  const isBorrador = budget.estado === "borrador";
  const isActivo = budget.estado === "activo";

  const doActivate = () => {
    modal.confirm({
      title: "Activar presupuesto",
      content: "Al activar, no podrá haber otro presupuesto activo en el mismo periodo.",
      onOk: async () => {
        try {
          await activateBudget(budget.id);
          message.success("Presupuesto activado");
          await load();
        } catch (err) {
          message.error(getErrorMessage(err));
        }
      },
    });
  };

  const doClose = () => {
    modal.confirm({
      title: "Cerrar presupuesto",
      content: "Un periodo cerrado no admite transacciones.",
      onOk: async () => {
        try {
          await closeBudget(budget.id);
          message.success("Presupuesto cerrado");
          await load();
        } catch (err) {
          message.error(getErrorMessage(err));
        }
      },
    });
  };

  const doDelete = () => {
    modal.confirm({
      title: "Eliminar presupuesto",
      content: "Esta acción no se puede deshacer.",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteBudget(budget.id);
          message.success("Presupuesto eliminado");
          navigate("/finanzas/presupuestos");
        } catch (err) {
          message.error(getErrorMessage(err));
        }
      },
    });
  };

  const columns = [
    { title: "Categoría", dataIndex: "categoria" },
    { title: "Producto", dataIndex: "producto", render: (v: string | null) => v ?? "—" },
    { title: <Tooltip title="Monto planeado para la línea">Planeado</Tooltip>, dataIndex: "monto_planeado", align: "right" as const, render: (v: number) => money(v) },
    { title: <Tooltip title="Monto real ejecutado en el periodo">Real</Tooltip>, dataIndex: "real", align: "right" as const, render: (v: number) => money(v) },
    { title: <Tooltip title="Monto disponible (planeado - real)">Disponible</Tooltip>, dataIndex: "disponible", align: "right" as const, render: (v: number) => money(v) },
    { title: <Tooltip title="Porcentaje de ejecución (real / planeado)">Ejecución</Tooltip>, dataIndex: "ejecucion_pct", align: "right" as const, render: (v: number) => `${v.toFixed(0)}%` },
    { title: <Tooltip title="Estado según el porcentaje de ejecución">Estado</Tooltip>, dataIndex: "estado", render: (e: EjecucionEstado) => <EjecucionTag estado={e} /> },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Space>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {budget.nombre}
          </Typography.Title>
          <BudgetEstadoTag estado={budget.estado} />
        </Space>
        {canWrite && (
          <Space>
            {isBorrador && (
              <>
                <Button icon={<EditOutlined />} onClick={() => setModalOpen(true)}>
                  Editar
                </Button>
                <Button type="primary" icon={<CheckOutlined />} onClick={doActivate}>
                  Activar
                </Button>
                <Button danger icon={<DeleteOutlined />} onClick={doDelete}>
                  Eliminar
                </Button>
              </>
            )}
            {isActivo && (
              <Button icon={<LockOutlined />} onClick={doClose}>
                Cerrar
              </Button>
            )}
          </Space>
        )}
      </div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Consulta la ejecución del presupuesto por línea, las alertas, la proyección de cierre y el cumplimiento
        de la meta de ingresos.
      </Typography.Paragraph>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label={<Tooltip title="Granularidad del periodo">Periodo</Tooltip>}>{periodLabel(budget.tipo_periodo)}</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Fechas del periodo">Rango</Tooltip>}>
          {fmtDate(budget.fecha_inicio)} → {fmtDate(budget.fecha_fin)}
        </Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Ingreso esperado en el periodo">Meta de ingresos</Tooltip>}>{money(budget.ingreso_meta)}</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Porcentaje a partir del cual se alerta">Alerta (%)</Tooltip>}>{budget.alerta_pct}%</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Usuario creador">Creado por</Tooltip>}>{budget.creador}</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Ingresos reales del periodo">Ingresos reales</Tooltip>}>{money(r.ingresos_reales)}</Descriptions.Item>
      </Descriptions>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Monto total planeado"><Typography.Text type="secondary">Planeado total</Typography.Text></Tooltip>
            <Typography.Title level={4} style={{ margin: 0 }}>{money(r.planeado_total)}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Monto real ejecutado"><Typography.Text type="secondary">Real total</Typography.Text></Tooltip>
            <Typography.Title level={4} style={{ margin: 0 }}>{money(r.real_total)}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Tooltip title="Monto disponible (planeado - real)"><Typography.Text type="secondary">Disponible total</Typography.Text></Tooltip>
            <Typography.Title level={4} style={{ margin: 0 }}>{money(r.disponible_total)}</Typography.Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Typography.Text type="secondary">Ejecución</Typography.Text>
            <Progress
              percent={Math.min(r.ejecucion_pct, 100)}
              strokeColor={EJECUCION_COLOR[r.estado]}
              format={() => `${r.ejecucion_pct.toFixed(0)}%`}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <div>
            <Tooltip title="Proyección de gasto al cierre del periodo"><Typography.Text type="secondary">Proyección de cierre</Typography.Text></Tooltip>
            <div>{r.proyeccion === null ? "—" : money(r.proyeccion)}</div>
          </div>
          <div>
            <Tooltip title="Porcentaje de la meta de ingresos alcanzada"><Typography.Text type="secondary">Cumplimiento de ingreso</Typography.Text></Tooltip>
            <div>{r.cumplimiento_ingreso_pct.toFixed(0)}%</div>
          </div>
          <div>
            <Tooltip title="Estado según el porcentaje de ejecución"><Typography.Text type="secondary">Estado de ejecución</Typography.Text></Tooltip>
            <div>
              <EjecucionTag estado={r.estado} />
            </div>
          </div>
        </Space>
      </Card>

      <Table<BudgetLine>
        rowKey="id"
        dataSource={budget.lineas}
        columns={columns}
        pagination={false}
        scroll={{ x: "max-content" }}
      />

      <BudgetFormModal
        open={modalOpen}
        budget={budget}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
