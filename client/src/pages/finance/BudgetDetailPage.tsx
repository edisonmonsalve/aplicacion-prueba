import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { EditOutlined, CheckOutlined, LockOutlined, DeleteOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { getBudget, deleteBudget, activateBudget, closeBudget } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import {
  money,
  BudgetEstadoTag,
  EjecucionTag,
  ejecucionColor,
  periodLabel,
  fmtDate,
  TIPO_LABEL,
} from "./FinanceUtils";
import { canWriteFinance } from "@/utils/roles";
import type { BudgetDetail, BudgetLine, EjecucionEstado, FinanceCategoryTipo } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import BudgetFormModal from "./BudgetFormModal";

const TIPO_COLOR: Record<string, string> = {
  ingreso: "green",
  gasto: "red",
  activo: "blue",
  pasivo: "purple",
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

  // Superar la meta de ingreso es positivo; superar el límite de un gasto es
  // una alerta. Se muestran por separado para no tratar ambos casos igual.
  const ingresosSuperados = budget.lineas.filter(
    (l) => l.tipo_categoria === "ingreso" && l.estado === "excedido"
  );
  const gastosExcedidos = budget.lineas.filter(
    (l) => l.tipo_categoria !== "ingreso" && l.estado === "excedido"
  );
  const lineasNoIngreso = budget.lineas.filter((l) => l.tipo_categoria !== "ingreso");
  const soloIngreso = budget.lineas.length > 0 && lineasNoIngreso.length === 0;
  const hayGastoAlerta = lineasNoIngreso.some((l) => l.estado === "alerta");
  const tipoResumen: FinanceCategoryTipo | undefined = soloIngreso ? "ingreso" : undefined;
  const estadoResumen: EjecucionEstado = soloIngreso
    ? r.estado
    : gastosExcedidos.length > 0
      ? "excedido"
      : hayGastoAlerta
        ? "alerta"
        : "ok";
  const nombreLinea = (l: BudgetLine) =>
    `${l.categoria}${l.producto ? ` · ${l.producto}` : l.producto_categoria ? ` · ${l.producto_categoria}` : ""}`;

  const doActivate = () => {
    modal.confirm({
      title: "Activar presupuesto",
      content:
        "Desde este momento las transacciones del periodo se compararán contra las líneas planeadas. Solo puede haber un presupuesto activo por periodo.",
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
      content:
        "El periodo dejará de admitir nuevas transacciones y no podrás reabrirlo. La ejecución quedará disponible solo para consulta.",
      okButtonProps: { danger: true },
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
      content:
        "Se eliminarán el presupuesto y sus líneas. Las transacciones ya registradas no se modifican. Esta acción no se puede deshacer.",
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
    {
      title: <Tooltip title="Categoría financiera planificada">Categoría</Tooltip>,
      dataIndex: "categoria",
      render: (categoria: string, l: BudgetLine) => (
        <Space size={4}>
          <Tag color={TIPO_COLOR[l.tipo_categoria]}>{TIPO_LABEL(l.tipo_categoria)}</Tag>
          <span>{categoria}</span>
        </Space>
      ),
    },
    {
      title: <Tooltip title="Nivel al que se imputa la ejecución real">Alcance</Tooltip>,
      key: "alcance",
      render: (_: unknown, l: BudgetLine) =>
        l.producto
          ? `Producto · ${l.producto}`
          : l.producto_categoria
            ? `Categoría producto · ${l.producto_categoria}`
            : "General",
    },
    { title: <Tooltip title="Monto planeado para la línea">Planeado</Tooltip>, dataIndex: "monto_planeado", align: "right" as const, render: (v: number) => money(v) },
    { title: <Tooltip title="Monto real ejecutado en el periodo">Real</Tooltip>, dataIndex: "real", align: "right" as const, render: (v: number) => money(v) },
    { title: <Tooltip title="Monto disponible (planeado - real)">Disponible</Tooltip>, dataIndex: "disponible", align: "right" as const, render: (v: number) => money(v) },
    {
      title: <Tooltip title="Porcentaje de ejecución (real / planeado)">Ejecución</Tooltip>,
      dataIndex: "ejecucion_pct",
      width: 190,
      render: (v: number, l: BudgetLine) => (
        <Tooltip
          title={
            l.tipo_categoria === "ingreso" && l.estado === "excedido"
              ? "Meta superada: es un resultado positivo"
              : `${v.toFixed(0)}% ejecutado`
          }
        >
          <Progress
            percent={Math.min(v, 100)}
            size="small"
            strokeColor={ejecucionColor(l.estado, l.tipo_categoria)}
            format={() => `${v.toFixed(0)}%`}
            style={{ minWidth: 150 }}
          />
        </Tooltip>
      ),
    },
    {
      title: <Tooltip title="Estado según el porcentaje de ejecución y el tipo de categoría">Estado</Tooltip>,
      dataIndex: "estado",
      render: (e: EjecucionEstado, l: BudgetLine) => (
        <EjecucionTag estado={e} tipo={l.tipo_categoria} />
      ),
    },
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
          <Space wrap>
            {(isBorrador || isActivo) && (
              <Tooltip
                title={
                  isBorrador
                    ? "Editar datos y líneas mientras el presupuesto siga en borrador"
                    : "Ajustar los montos planificados; la ejecución se recalcula al instante"
                }
              >
                <Button icon={<EditOutlined />} onClick={() => setModalOpen(true)}>
                  {isActivo ? "Ajustar" : "Editar"}
                </Button>
              </Tooltip>
            )}
            {isBorrador && (
              <>
                <Tooltip title="Comenzar a comparar las transacciones del periodo contra este presupuesto">
                  <Button type="primary" icon={<CheckOutlined />} onClick={doActivate}>
                    Activar
                  </Button>
                </Tooltip>
                <Tooltip title="Eliminar el presupuesto y sus líneas">
                  <Button danger icon={<DeleteOutlined />} onClick={doDelete}>
                    Eliminar
                  </Button>
                </Tooltip>
              </>
            )}
            {isActivo && (
              <Tooltip title="Cerrar el periodo para que no admita más transacciones">
                <Button icon={<LockOutlined />} onClick={doClose}>
                  Cerrar
                </Button>
              </Tooltip>
            )}
          </Space>
        )}
      </div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Consulta la ejecución del presupuesto por línea, las alertas, la proyección de cierre y el cumplimiento
        de la meta de ingresos.
      </Typography.Paragraph>

      {budget.estado === "borrador" && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Este presupuesto está en borrador"
          description="Puedes editarlo o activarlo. Al activarlo empezará a comparar las transacciones reales contra las líneas planeadas."
        />
      )}
      {budget.estado === "activo" && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Periodo activo"
          description="Las transacciones con fecha dentro del periodo se comparan automáticamente contra las líneas de este presupuesto."
        />
      )}
      {budget.estado === "cerrado" && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Periodo cerrado"
          description="Este periodo ya no admite nuevas transacciones. Consulta la ejecución histórica o crea un presupuesto para el siguiente periodo."
        />
      )}

      {ingresosSuperados.length > 0 && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Meta de ingresos superada"
          description={
            <>
              Vas por encima de lo esperado en{" "}
              <strong>{ingresosSuperados.map(nombreLinea).join(", ")}</strong>. Es un resultado
              positivo: no requiere ajuste por exceso.
            </>
          }
        />
      )}
      {gastosExcedidos.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Límites superados"
          description={
            <>
              Estas líneas superaron su monto planeado:{" "}
              <strong>{gastosExcedidos.map(nombreLinea).join(", ")}</strong>. Puedes usar
              «{isActivo ? "Ajustar" : "Editar"}» para revisar los montos o redistribuir el
              presupuesto.
            </>
          }
        />
      )}

      <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} style={{ marginBottom: 16 }}>
        <Descriptions.Item label={<Tooltip title="Granularidad del periodo">Periodo</Tooltip>}>{periodLabel(budget.tipo_periodo)}</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Fechas del periodo">Rango</Tooltip>}>
          {fmtDate(budget.fecha_inicio)} → {fmtDate(budget.fecha_fin)}
        </Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Ingreso esperado en el periodo">Meta de ingresos</Tooltip>}>{money(budget.ingreso_meta)}</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Porcentaje a partir del cual se alerta">Alerta (%)</Tooltip>}>{budget.alerta_pct}%</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Usuario creador">Creado por</Tooltip>}>{budget.creador}</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Ingresos reales del periodo">Ingresos reales</Tooltip>}>{money(r.ingresos_reales)}</Descriptions.Item>
      </Descriptions>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
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
            <Tooltip title="Porcentaje del monto planeado que ya se ejecutó">
              <Typography.Text type="secondary">Ejecución</Typography.Text>
            </Tooltip>
            <Progress
              percent={Math.min(r.ejecucion_pct, 100)}
              strokeColor={ejecucionColor(estadoResumen, tipoResumen)}
              format={() => `${r.ejecucion_pct.toFixed(0)}%`}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap>
          <div>
            <Tooltip title="Proyección de gasto al cierre del periodo"><Typography.Text type="secondary">Proyección de cierre</Typography.Text></Tooltip>
            <div>{r.proyeccion === null ? "—" : money(r.proyeccion)}</div>
          </div>
          <div>
            <Tooltip title="Porcentaje de la meta de ingresos alcanzada"><Typography.Text type="secondary">Cumplimiento de ingreso</Typography.Text></Tooltip>
            <div>
              {r.cumplimiento_ingreso_pct.toFixed(0)}%
              {r.cumplimiento_ingreso_pct >= 100 && (
                <Tag color="green" style={{ marginLeft: 8 }}>
                  Meta superada
                </Tag>
              )}
            </div>
          </div>
          <div>
            <Tooltip
              title={
                soloIngreso
                  ? "Porcentaje de la meta de ingresos alcanzada"
                  : "Estado de los gastos: superar el límite es una alerta; el sobrecumplimiento de ingresos no cuenta como exceso"
              }
            >
              <Typography.Text type="secondary">Estado de ejecución</Typography.Text>
            </Tooltip>
            <div>
              <EjecucionTag estado={estadoResumen} tipo={tipoResumen} />
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
        locale={{ emptyText: "Este presupuesto aún no tiene líneas" }}
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
