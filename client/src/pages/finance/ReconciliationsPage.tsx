import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  LockOutlined,
  PlusOutlined,
  StopOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { canWriteFinance } from "@/utils/roles";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import PageHeader from "@/components/PageHeader";
import TableSkeleton from "@/components/TableSkeleton";
import { getFinanceAccounts } from "@/services/financeService";
import {
  addStatementLine,
  closeReconciliation,
  createReconciliation,
  deleteStatementLine,
  getReconciliation,
  getReconciliationSuggestions,
  ignoreStatementLine,
  listReconciliations,
  matchStatementLine,
  reopenReconciliation,
  unmatchStatementLine,
  updateStatementLine,
} from "@/services/reconciliationsService";
import type {
  BankReconciliation,
  BankReconciliationListItem,
  BankStatementLine,
  FinanceAccount,
  ReconciliationCandidate,
  ReconciliationEstado,
  StatementLineEstado,
} from "@/types";
import { fmtDate, money } from "./FinanceUtils";

const money2 = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const ESTADO_META: Record<
  ReconciliationEstado,
  { label: string; color: string; icon: React.ReactNode }
> = {
  abierta: { label: "Abierta", color: "blue", icon: <UnlockOutlined /> },
  cerrada: { label: "Cerrada", color: "purple", icon: <LockOutlined /> },
};

const LINEA_META: Record<StatementLineEstado, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "orange" },
  conciliada: { label: "Conciliada", color: "green" },
  ignorada: { label: "Ignorada", color: "default" },
};

interface CreateValues {
  account_id: number;
  nombre: string;
  fechas: [Dayjs, Dayjs];
  saldo_extracto_inicial: number;
  saldo_extracto_final: number;
}

interface LineValues {
  fecha: Dayjs;
  descripcion: string;
  referencia?: string;
  monto: number;
  nota?: string;
}

interface MotivoValues {
  motivo: string;
}

interface NotaValues {
  nota: string;
}

const SignedAmount = ({ value }: { value: number }) => (
  <Typography.Text type={value < 0 ? "danger" : value > 0 ? "success" : undefined}>
    {money2(value)}
  </Typography.Text>
);

/**
 * Conciliación bancaria.
 *
 * El extracto del banco se carga como líneas con signo. Cada línea se cruza
 * contra un asiento de caja del sistema (mismo importe y cuenta), se ignora con
 * una nota o queda pendiente. La página muestra el saldo del sistema, el del
 * extracto y las partidas conciliatorias que explican la diferencia.
 */
export default function ReconciliationsPage() {
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const canWrite = canWriteFinance(user?.rol);

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [rows, setRows] = useState<BankReconciliationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BankReconciliation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm] = Form.useForm<CreateValues>();

  const [lineOpen, setLineOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BankStatementLine | null>(null);
  const [lineForm] = Form.useForm<LineValues>();

  const [matchTarget, setMatchTarget] = useState<BankStatementLine | null>(null);
  const [matchDays, setMatchDays] = useState(7);
  const [matchLoading, setMatchLoading] = useState(false);
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);

  const [ignoreTarget, setIgnoreTarget] = useState<BankStatementLine | null>(null);
  const [ignoreForm] = Form.useForm<NotaValues>();

  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenForm] = Form.useForm<MotivoValues>();

  useDocumentTitle("Conciliación bancaria");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listReconciliations());
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudieron cargar las conciliaciones"));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getFinanceAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const refreshDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      try {
        const data = await getReconciliation(id);
        setDetail(data);
        return data;
      } catch (err) {
        message.error(getErrorMessage(err, "No se pudo cargar la conciliación"));
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [message]
  );

  const refreshAll = async (id: number) => {
    await Promise.all([load(), refreshDetail(id)]);
  };

  const openCreate = () => {
    const banco = accounts.find((a) => a.tipo === "banco" && a.activo) ?? accounts[0];
    createForm.resetFields();
    createForm.setFieldsValue({
      account_id: banco?.id,
      nombre: `Conciliación ${dayjs().format("MMMM YYYY")}`,
      fechas: [dayjs().startOf("month"), dayjs()],
      saldo_extracto_inicial: 0,
      saldo_extracto_final: 0,
    });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const values = await createForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const created = await createReconciliation({
        account_id: values.account_id,
        nombre: values.nombre.trim(),
        fecha_inicio: values.fechas[0].format("YYYY-MM-DD"),
        fecha_fin: values.fechas[1].format("YYYY-MM-DD"),
        saldo_extracto_inicial: values.saldo_extracto_inicial ?? 0,
        saldo_extracto_final: values.saldo_extracto_final ?? 0,
      });
      message.success("Conciliación creada");
      setCreateOpen(false);
      await load();
      const data = await refreshDetail(created.id);
      if (data) setDetail(data);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo crear la conciliación"));
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row: BankReconciliationListItem) => {
    setDetail(null);
    await refreshDetail(row.id);
  };

  const openAddLine = () => {
    if (!detail) return;
    setEditingLine(null);
    lineForm.resetFields();
    lineForm.setFieldsValue({
      fecha: dayjs().isAfter(detail.fecha_fin)
        ? dayjs(detail.fecha_fin)
        : dayjs().isBefore(detail.fecha_inicio)
          ? dayjs(detail.fecha_inicio)
          : dayjs(),
      monto: -1,
    });
    setLineOpen(true);
  };

  const openEditLine = (line: BankStatementLine) => {
    setEditingLine(line);
    lineForm.setFieldsValue({
      fecha: dayjs(line.fecha),
      descripcion: line.descripcion,
      referencia: line.referencia ?? undefined,
      monto: line.monto,
      nota: line.nota ?? undefined,
    });
    setLineOpen(true);
  };

  const submitLine = async () => {
    if (!detail) return;
    const values = await lineForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const input = {
        fecha: values.fecha.format("YYYY-MM-DD"),
        descripcion: values.descripcion.trim(),
        referencia: values.referencia?.trim() || undefined,
        monto: values.monto,
        nota: values.nota?.trim() || undefined,
      };
      if (editingLine) {
        await updateStatementLine(detail.id, editingLine.id, input);
        message.success("Línea actualizada");
      } else {
        await addStatementLine(detail.id, input);
        message.success("Línea agregada");
      }
      setLineOpen(false);
      setEditingLine(null);
      await refreshAll(detail.id);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo guardar la línea"));
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (line: BankStatementLine) => {
    if (!detail) return;
    try {
      await deleteStatementLine(detail.id, line.id);
      message.success("Línea eliminada");
      await refreshAll(detail.id);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo eliminar la línea"));
    }
  };

  const openMatch = async (line: BankStatementLine) => {
    if (!detail) return;
    setMatchTarget(line);
    setCandidates([]);
    setMatchLoading(true);
    try {
      const suggestions = await getReconciliationSuggestions(detail.id, matchDays);
      const found = suggestions.find((s) => s.linea_id === line.id);
      setCandidates(found?.candidatos ?? []);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudieron buscar coincidencias"));
    } finally {
      setMatchLoading(false);
    }
  };

  const reloadCandidates = async (dias: number) => {
    if (!detail || !matchTarget) return;
    setMatchDays(dias);
    setMatchLoading(true);
    try {
      const suggestions = await getReconciliationSuggestions(detail.id, dias);
      const found = suggestions.find((s) => s.linea_id === matchTarget.id);
      setCandidates(found?.candidatos ?? []);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudieron buscar coincidencias"));
    } finally {
      setMatchLoading(false);
    }
  };

  const confirmMatch = async (candidate: ReconciliationCandidate) => {
    if (!detail || !matchTarget) return;
    setSaving(true);
    try {
      await matchStatementLine(detail.id, matchTarget.id, candidate.transaction_id);
      message.success("Línea conciliada");
      setMatchTarget(null);
      await refreshAll(detail.id);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo conciliar la línea"));
    } finally {
      setSaving(false);
    }
  };

  const unmatch = async (line: BankStatementLine) => {
    if (!detail) return;
    try {
      await unmatchStatementLine(detail.id, line.id);
      message.success("Línea desconectada");
      await refreshAll(detail.id);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo desconectar la línea"));
    }
  };

  const openIgnore = (line: BankStatementLine) => {
    ignoreForm.resetFields();
    setIgnoreTarget(line);
  };

  const submitIgnore = async () => {
    if (!detail || !ignoreTarget) return;
    const values = await ignoreForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await ignoreStatementLine(detail.id, ignoreTarget.id, values.nota.trim());
      message.success("Línea ignorada");
      setIgnoreTarget(null);
      await refreshAll(detail.id);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo ignorar la línea"));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!detail) return;
    modal.confirm({
      title: "Cerrar la conciliación",
      content:
        "La conciliación quedará congelada con una foto de sus totales. Podrás reabrirla después dejando el motivo.",
      okText: "Cerrar conciliación",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await closeReconciliation(detail.id);
          message.success("Conciliación cerrada");
          await refreshAll(detail.id);
        } catch (err) {
          message.error(getErrorMessage(err, "No se pudo cerrar la conciliación"));
        }
      },
    });
  };

  const submitReopen = async () => {
    if (!detail) return;
    const values = await reopenForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await reopenReconciliation(detail.id, values.motivo.trim());
      message.success("Conciliación reabierta");
      setReopenOpen(false);
      await refreshAll(detail.id);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo reabrir la conciliación"));
    } finally {
      setSaving(false);
    }
  };

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.nombre} (${a.tipo === "banco" ? "banco" : "caja"})`,
      })),
    [accounts]
  );

  return (
    <>
      <PageHeader
        title="Conciliación bancaria"
        description="Cruza el extracto del banco con los movimientos de caja del sistema. Las diferencias quedan explicadas por líneas pendientes y asientos que el banco aún no procesa."
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Nueva conciliación
            </Button>
          ) : undefined
        }
      />

      {loading && rows.length === 0 ? (
        <TableSkeleton />
      ) : (
        <Table<BankReconciliationListItem>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty description="Aún no hay conciliaciones. Crea una y carga las líneas del extracto del banco." />
            ),
          }}
          columns={[
            {
              title: "Cuenta",
              key: "cuenta",
              render: (_, r) => (
                <span>
                  {r.cuenta}
                  <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                    {r.cuenta_tipo === "banco" ? "Banco" : "Caja"}
                  </Typography.Text>
                </span>
              ),
            },
            { title: "Nombre", dataIndex: "nombre" },
            {
              title: "Periodo",
              key: "periodo",
              render: (_, r) => `${fmtDate(r.fecha_inicio)} – ${fmtDate(r.fecha_fin)}`,
            },
            {
              title: "Saldo extracto",
              dataIndex: "saldo_extracto_final",
              align: "right",
              render: (v: number) => money(v),
            },
            {
              title: "Líneas",
              key: "lineas",
              render: (_, r) => (
                <Space direction="vertical" size={0} style={{ minWidth: 130 }}>
                  <Progress
                    percent={Math.round(r.pct_conciliado)}
                    size="small"
                    status={r.pendientes > 0 ? "active" : "success"}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {r.conciliadas} conciliadas · {r.pendientes} pendientes · {r.ignoradas}{" "}
                    ignoradas
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: "Estado",
              dataIndex: "estado",
              render: (e: ReconciliationEstado) => {
                const meta = ESTADO_META[e];
                return (
                  <Tag color={meta.color} icon={meta.icon}>
                    {meta.label}
                  </Tag>
                );
              },
            },
            {
              title: "Cierre",
              key: "cierre",
              render: (_, r) =>
                r.estado === "cerrada" ? (
                  <Tooltip title={r.motivo_reapertura ?? ""}>
                    <span>
                      {r.cerrada_por ?? "—"}
                      <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                        {r.cerrada_at ? fmtDate(r.cerrada_at) : ""}
                      </Typography.Text>
                    </span>
                  </Tooltip>
                ) : (
                  <Typography.Text type="secondary">En curso</Typography.Text>
                ),
            },
            {
              title: "",
              key: "acciones",
              width: 110,
              render: (_, r) => (
                <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>
                  Ver
                </Button>
              ),
            },
          ]}
        />
      )}

      <Modal
        title="Nueva conciliación bancaria"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        okText="Crear conciliación"
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnHidden
        width={560}
      >
        <Typography.Paragraph type="secondary">
          Elige la cuenta y el periodo. Después agrega las líneas del extracto con sus
          importes: positivo para entradas y negativo para salidas.
        </Typography.Paragraph>
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="account_id"
            label="Cuenta financiera"
            rules={[{ required: true, message: "Selecciona la cuenta" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={accountOptions}
              placeholder="Banco o caja"
            />
          </Form.Item>
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, min: 3, max: 120 }]}
          >
            <Input placeholder="Ej. Banco Bogotá · octubre 2026" />
          </Form.Item>
          <Form.Item
            name="fechas"
            label="Periodo"
            rules={[{ required: true, message: "Selecciona el periodo" }]}
          >
            <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="saldo_extracto_inicial"
                label="Saldo inicial del extracto"
                rules={[{ required: true }]}
              >
                <InputNumber<number>
                  style={{ width: "100%" }}
                  precision={2}
                  step={1000}
                  prefix="$"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="saldo_extracto_final"
                label="Saldo final del extracto"
                rules={[{ required: true }]}
              >
                <InputNumber<number>
                  style={{ width: "100%" }}
                  precision={2}
                  step={1000}
                  prefix="$"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={detail ? `Conciliación · ${detail.nombre}` : "Conciliación"}
        open={!!detail}
        width={1000}
        onClose={() => setDetail(null)}
        loading={detailLoading}
      >
        {detail && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Cuenta">
                {detail.cuenta} ({detail.cuenta_tipo === "banco" ? "banco" : "caja"})
              </Descriptions.Item>
              <Descriptions.Item label="Periodo">
                {fmtDate(detail.fecha_inicio)} – {fmtDate(detail.fecha_fin)}
              </Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={ESTADO_META[detail.estado].color} icon={ESTADO_META[detail.estado].icon}>
                  {ESTADO_META[detail.estado].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Creada por">
                {detail.creador} · {detail.created_at ? fmtDate(detail.created_at) : ""}
              </Descriptions.Item>
              {detail.estado === "cerrada" && (
                <Descriptions.Item label="Cierre" span={2}>
                  {detail.cerrada_por ?? "—"} ·{" "}
                  {detail.cerrada_at ? fmtDate(detail.cerrada_at) : ""}
                  {detail.motivo_reapertura && (
                    <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
                      Reapertura: {detail.reabierta_por} · {detail.motivo_reapertura}
                    </Typography.Paragraph>
                  )}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Saldo del sistema"
                    value={detail.resumen.saldo_sistema}
                    formatter={(v) => money(Number(v))}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Saldo del extracto"
                    value={detail.resumen.saldo_extracto_final}
                    formatter={(v) => money(Number(v))}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Diferencia"
                    value={detail.resumen.diferencia}
                    formatter={(v) => money(Number(v))}
                    valueStyle={{
                      color:
                        Math.abs(detail.resumen.diferencia) < 0.005
                          ? "#389e0d"
                          : "#cf1322",
                    }}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Typography.Text type="secondary">Avance</Typography.Text>
                  <Progress
                    percent={Math.round(detail.resumen.pct_conciliado)}
                    status={detail.resumen.lineas_pendientes > 0 ? "active" : "success"}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {detail.resumen.lineas_conciliadas} de {detail.resumen.lineas_total} líneas
                  </Typography.Text>
                </Card>
              </Col>
            </Row>

            {!detail.resumen.extracto_cuadra && (
              <Alert
                type="error"
                showIcon
                message="El extracto no cuadra"
                description={`El saldo final (${money2(
                  detail.resumen.saldo_extracto_final
                )}) no es igual al saldo inicial más sus líneas (${money2(
                  detail.resumen.saldo_extracto_calculado
                )}). Revisa los saldos o las líneas.`}
              />
            )}
            {Math.abs(detail.resumen.diferencia_no_explicada) >= 0.005 && (
              <Alert
                type="warning"
                showIcon
                message="Diferencia no explicada"
                description={`Quedan ${money2(
                  detail.resumen.diferencia_no_explicada
                )} sin explicar. Normalmente viene de un saldo inicial del extracto distinto al del sistema.`}
              />
            )}
            {detail.estado === "abierta" && detail.resumen.puede_cerrar && (
              <Alert
                type="success"
                showIcon
                message="Todo conciliado"
                description="Las líneas del extracto están resueltas y el extracto cuadra. Puedes cerrar la conciliación."
              />
            )}

            <Space wrap>
              {canWrite && detail.estado === "abierta" && (
                <Button icon={<PlusOutlined />} onClick={openAddLine}>
                  Agregar línea
                </Button>
              )}
              {canWrite && detail.estado === "abierta" && (
                <Tooltip
                  title={
                    detail.resumen.puede_cerrar
                      ? "Congela la conciliación con una foto de sus totales"
                      : "Resuelve las líneas y cuadra el extracto para cerrar"
                  }
                >
                  <Button
                    type="primary"
                    icon={<LockOutlined />}
                    disabled={!detail.resumen.puede_cerrar}
                    onClick={close}
                  >
                    Cerrar conciliación
                  </Button>
                </Tooltip>
              )}
              {canWrite && detail.estado === "cerrada" && (
                <Button
                  icon={<UnlockOutlined />}
                  onClick={() => {
                    reopenForm.resetFields();
                    setReopenOpen(true);
                  }}
                >
                  Reabrir
                </Button>
              )}
            </Space>

            <Card
              size="small"
              title={`Líneas del extracto (${detail.lineas.length})`}
              extra={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Positivo = entrada · Negativo = salida
                </Typography.Text>
              }
            >
              <Table<BankStatementLine>
                rowKey="id"
                size="small"
                dataSource={detail.lineas}
                pagination={false}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "Agrega las líneas del extracto del banco." }}
                columns={[
                  { title: "Fecha", dataIndex: "fecha", render: (v: string) => fmtDate(v) },
                  {
                    title: "Descripción",
                    key: "descripcion",
                    render: (_, l) => (
                      <span>
                        {l.descripcion}
                        {l.referencia && (
                          <Typography.Text
                            type="secondary"
                            style={{ display: "block", fontSize: 12 }}
                          >
                            Ref. {l.referencia}
                          </Typography.Text>
                        )}
                      </span>
                    ),
                  },
                  {
                    title: "Monto",
                    dataIndex: "monto",
                    align: "right",
                    render: (v: number) => <SignedAmount value={v} />,
                  },
                  {
                    title: "Estado",
                    dataIndex: "estado",
                    render: (e: StatementLineEstado) => (
                      <Tag color={LINEA_META[e].color}>{LINEA_META[e].label}</Tag>
                    ),
                  },
                  {
                    title: "Cruce",
                    key: "cruce",
                    render: (_, l) => {
                      if (l.estado === "ignorada") {
                        return (
                          <Tooltip title={l.nota ?? ""}>
                            <Typography.Text type="secondary">{l.nota ?? "Ignorada"}</Typography.Text>
                          </Tooltip>
                        );
                      }
                      if (l.estado === "conciliada" && l.tx_categoria) {
                        return (
                          <span>
                            {l.tx_categoria}
                            {l.tx_factura ? ` · ${l.tx_factura}` : ""}
                            <Typography.Text
                              type="secondary"
                              style={{ display: "block", fontSize: 12 }}
                            >
                              {l.tx_fecha ? fmtDate(l.tx_fecha) : ""}
                              {l.tx_descripcion ? ` · ${l.tx_descripcion}` : ""}
                            </Typography.Text>
                          </span>
                        );
                      }
                      return <Typography.Text type="secondary">Sin cruzar</Typography.Text>;
                    },
                  },
                  ...(canWrite
                    ? [
                        {
                          title: "",
                          key: "acciones",
                          width: 260,
                          render: (_: unknown, l: BankStatementLine) => (
                            <Space wrap size={4}>
                              {detail.estado === "abierta" && l.estado === "pendiente" && (
                                <Button
                                  size="small"
                                  type="primary"
                                  icon={<LinkOutlined />}
                                  onClick={() => openMatch(l)}
                                >
                                  Conciliar
                                </Button>
                              )}
                              {detail.estado === "abierta" && l.estado === "conciliada" && (
                                <Button
                                  size="small"
                                  onClick={() => unmatch(l)}
                                  icon={<StopOutlined />}
                                >
                                  Desconciliar
                                </Button>
                              )}
                              {detail.estado === "abierta" && l.estado !== "conciliada" && (
                                <Button
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => openEditLine(l)}
                                />
                              )}
                              {detail.estado === "abierta" && l.estado === "pendiente" && (
                                <Button size="small" onClick={() => openIgnore(l)}>
                                  Ignorar
                                </Button>
                              )}
                              {detail.estado === "abierta" && l.estado !== "conciliada" && (
                                <Popconfirm
                                  title="¿Eliminar la línea?"
                                  okText="Eliminar"
                                  cancelText="Cancelar"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => removeLine(l)}
                                >
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              )}
                            </Space>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </Card>

            <Card size="small" title="Resumen de partidas conciliatorias">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Saldo inicial del sistema">
                  {money2(detail.resumen.saldo_inicial_sistema)}
                </Descriptions.Item>
                <Descriptions.Item label="Saldo inicial del extracto">
                  {money2(detail.resumen.saldo_extracto_inicial)}
                </Descriptions.Item>
                <Descriptions.Item label="Extracto sin conciliar">
                  {money2(detail.resumen.monto_pendiente)}
                </Descriptions.Item>
                <Descriptions.Item label="Líneas ignoradas">
                  {money2(detail.resumen.monto_ignorado)}
                </Descriptions.Item>
                <Descriptions.Item label="Sistema sin extracto">
                  {money2(detail.resumen.monto_sistema_sin_conciliar)} (
                  {detail.resumen.movimientos_sin_conciliar})
                </Descriptions.Item>
                <Descriptions.Item label="Diferencia explicada">
                  {money2(detail.resumen.diferencia_explicada)}
                </Descriptions.Item>
                <Descriptions.Item label="Diferencia no explicada">
                  {money2(detail.resumen.diferencia_no_explicada)}
                </Descriptions.Item>
                <Descriptions.Item label="Líneas resueltas">
                  {detail.resumen.lineas_total - detail.resumen.lineas_pendientes} /{" "}
                  {detail.resumen.lineas_total}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Collapse
              items={[
                {
                  key: "movimientos",
                  label: `Movimientos del sistema en el periodo (${detail.movimientos.length})`,
                  children: (
                    <Table
                      rowKey="id"
                      size="small"
                      dataSource={detail.movimientos}
                      pagination={{ pageSize: 10, hideOnSinglePage: true }}
                      scroll={{ x: "max-content" }}
                      columns={[
                        {
                          title: "Fecha",
                          dataIndex: "fecha",
                          render: (v: string) => fmtDate(v),
                        },
                        {
                          title: "Categoría",
                          key: "categoria",
                          render: (_, m) => (
                            <span>
                              {m.categoria}
                              {m.factura && (
                                <Typography.Text
                                  type="secondary"
                                  style={{ display: "block", fontSize: 12 }}
                                >
                                  {m.factura}
                                </Typography.Text>
                              )}
                            </span>
                          ),
                        },
                        {
                          title: "Descripción",
                          dataIndex: "descripcion",
                          render: (v: string | null) => v ?? "—",
                        },
                        {
                          title: "Monto",
                          dataIndex: "monto_firmado",
                          align: "right",
                          render: (v: number) => <SignedAmount value={v} />,
                        },
                        {
                          title: "Estado",
                          key: "estado",
                          render: (_, m) =>
                            m.line_id ? (
                              <Tag color="green" icon={<CheckCircleOutlined />}>
                                Conciliado
                              </Tag>
                            ) : m.otra_conciliacion ? (
                              <Tag color="blue">En otra conciliación</Tag>
                            ) : (
                              <Tag color="orange">Sin extracto</Tag>
                            ),
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Modal
        title={editingLine ? "Editar línea del extracto" : "Agregar línea del extracto"}
        open={lineOpen}
        onCancel={() => {
          setLineOpen(false);
          setEditingLine(null);
        }}
        onOk={submitLine}
        okText={editingLine ? "Guardar" : "Agregar"}
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          Usa un monto negativo para las salidas del banco y positivo para las entradas.
        </Typography.Paragraph>
        <Form form={lineForm} layout="vertical">
          <Form.Item
            name="fecha"
            label="Fecha"
            rules={[{ required: true, message: "Selecciona la fecha" }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="descripcion"
            label="Descripción"
            rules={[{ required: true, min: 2, max: 255 }]}
          >
            <Input placeholder="Ej. Transferencia recibida del cliente" />
          </Form.Item>
          <Form.Item name="referencia" label="Referencia">
            <Input placeholder="Ej. REC-001" maxLength={100} />
          </Form.Item>
          <Form.Item
            name="monto"
            label="Monto"
            rules={[{ required: true, message: "Indica el monto" }]}
          >
            <InputNumber<number>
              style={{ width: "100%" }}
              precision={2}
              step={1000}
              prefix="$"
              placeholder="Negativo para salidas"
            />
          </Form.Item>
          <Form.Item name="nota" label="Nota">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Conciliar línea del extracto"
        open={!!matchTarget}
        onCancel={() => setMatchTarget(null)}
        footer={null}
        destroyOnHidden
        width={760}
      >
        {matchTarget && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Línea">
                {matchTarget.descripcion}
                {matchTarget.referencia ? ` · ${matchTarget.referencia}` : ""}
              </Descriptions.Item>
              <Descriptions.Item label="Monto">
                <SignedAmount value={matchTarget.monto} />
              </Descriptions.Item>
            </Descriptions>

            <Space>
              <Typography.Text type="secondary">Tolerancia de fechas</Typography.Text>
              <Select
                value={matchDays}
                style={{ width: 150 }}
                onChange={(value) => reloadCandidates(value)}
                options={[
                  { value: 3, label: "± 3 días" },
                  { value: 7, label: "± 7 días" },
                  { value: 15, label: "± 15 días" },
                  { value: 30, label: "± 30 días" },
                ]}
              />
            </Space>

            <Table<ReconciliationCandidate>
              rowKey="transaction_id"
              size="small"
              loading={matchLoading}
              dataSource={candidates}
              pagination={false}
              scroll={{ x: "max-content" }}
              locale={{
                emptyText: (
                  <Empty description="No hay movimientos del sistema con el mismo importe en la tolerancia elegida. Ajusta los días o revisa el monto de la línea." />
                ),
              }}
              columns={[
                { title: "Fecha", dataIndex: "fecha", render: (v: string) => fmtDate(v) },
                {
                  title: "Categoría",
                  key: "categoria",
                  render: (_, c) => (
                    <span>
                      {c.categoria}
                      {c.factura && (
                        <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                          {c.factura}
                        </Typography.Text>
                      )}
                    </span>
                  ),
                },
                {
                  title: "Descripción",
                  dataIndex: "descripcion",
                  render: (v: string | null) => v ?? "—",
                },
                {
                  title: "Monto",
                  dataIndex: "monto_firmado",
                  align: "right",
                  render: (v: number) => <SignedAmount value={v} />,
                },
                {
                  title: "Días",
                  dataIndex: "diferencia_dias",
                  align: "right",
                  render: (v: number) => `± ${v}`,
                },
                {
                  title: "",
                  key: "accion",
                  render: (_, c) => (
                    <Button
                      size="small"
                      type="primary"
                      loading={saving}
                      onClick={() => confirmMatch(c)}
                    >
                      Conciliar
                    </Button>
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title="Ignorar línea del extracto"
        open={!!ignoreTarget}
        onCancel={() => setIgnoreTarget(null)}
        onOk={submitIgnore}
        okText="Ignorar"
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          La línea quedará resuelta sin cruzarla con el sistema. Explica el motivo (por ejemplo,
          una comisión bancaria pendiente de registrar).
        </Typography.Paragraph>
        <Form form={ignoreForm} layout="vertical">
          <Form.Item
            name="nota"
            label="Motivo"
            rules={[
              { required: true, min: 3, max: 500 },
              { whitespace: true, message: "Explica el motivo" },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Reabrir conciliación"
        open={reopenOpen}
        onCancel={() => setReopenOpen(false)}
        onOk={submitReopen}
        okText="Reabrir"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          La conciliación no se borra: quedará abierta de nuevo con el motivo y tu usuario en la
          auditoría.
        </Typography.Paragraph>
        <Form form={reopenForm} layout="vertical">
          <Form.Item
            name="motivo"
            label="Motivo de la reapertura"
            rules={[
              { required: true, min: 5, max: 500 },
              { whitespace: true, message: "Explica el motivo" },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
