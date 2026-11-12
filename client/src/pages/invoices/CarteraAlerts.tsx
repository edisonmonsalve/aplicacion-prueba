import { useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import { getCarteraAlertas, saveCarteraFollowup } from "@/services/invoicesService";
import { getErrorMessage } from "@/utils/errors";
import { useAuth } from "@/context/AuthContext";
import type {
  CarteraAlert,
  CarteraAlertReport,
  CarteraAlertSeveridad,
  CarteraFollowupEstado,
  InvoiceTipo,
} from "@/types";
import { fmtDate, money } from "./InvoiceUtils";

const SEVERIDAD_META: Record<CarteraAlertSeveridad, { label: string; color: string }> = {
  critica: { label: "Crítica", color: "red" },
  alta: { label: "Alta", color: "volcano" },
  media: { label: "Media", color: "gold" },
  baja: { label: "Baja", color: "blue" },
};

const SEVERIDAD_OPTIONS = (
  Object.keys(SEVERIDAD_META) as CarteraAlertSeveridad[]
).map((value) => ({ value, label: SEVERIDAD_META[value].label }));

const FOLLOWUP_META: Record<CarteraFollowupEstado, { label: string; color: string }> = {
  pendiente: { label: "Sin gestionar", color: "default" },
  recordado: { label: "Recordado", color: "blue" },
  promesa: { label: "Promesa de pago", color: "gold" },
  escalado: { label: "Escalado", color: "red" },
  resuelto: { label: "Resuelto", color: "green" },
};

const FOLLOWUP_OPTIONS = (
  Object.keys(FOLLOWUP_META) as CarteraFollowupEstado[]
).map((value) => ({ value, label: FOLLOWUP_META[value].label }));

interface FormValues {
  estado: CarteraFollowupEstado;
  proximo_contacto?: Dayjs | null;
  nota?: string;
}

interface Props {
  tipo?: InvoiceTipo;
}

/**
 * Panel de alertas de cartera priorizadas por severidad y mora.
 *
 * Las alertas se calculan en el servidor desde la misma cartera del aging; el
 * seguimiento que se guarda aquí es solo gestión de cobro y queda auditado.
 */
export default function CarteraAlerts({ tipo = "venta" }: Props) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { user } = useAuth();
  const [form] = Form.useForm<FormValues>();

  const [report, setReport] = useState<CarteraAlertReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [severidad, setSeveridad] = useState<CarteraAlertSeveridad | undefined>();
  const [incluirResueltos, setIncluirResueltos] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<CarteraAlert | null>(null);
  const [saving, setSaving] = useState(false);

  const puedeGestionar = user?.rol === "admin" || user?.rol === "contador";
  const esCobro = tipo === "venta";

  const load = () => setReload((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCarteraAlertas({
      tipo,
      severidad,
      incluir_resueltos: incluirResueltos,
    })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => {
        if (!cancelled) message.error(getErrorMessage(err, "No se pudieron cargar las alertas"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, severidad, incluirResueltos, reload]);

  useEffect(() => {
    if (!selected) return;
    form.resetFields();
    form.setFieldsValue({
      estado: selected.seguimiento?.estado ?? "recordado",
      proximo_contacto: selected.seguimiento?.proximo_contacto
        ? dayjs(selected.seguimiento.proximo_contacto)
        : null,
      nota: selected.seguimiento?.nota ?? "",
    });
  }, [selected, form]);

  const save = async () => {
    if (!selected) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveCarteraFollowup(selected.invoice_id, {
        estado: values.estado,
        nota: values.nota?.trim() || null,
        proximo_contacto: values.proximo_contacto?.format("YYYY-MM-DD") ?? null,
      });
      message.success("Seguimiento guardado");
      setSelected(null);
      load();
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo guardar el seguimiento"));
    } finally {
      setSaving(false);
    }
  };

  const resumen = report?.resumen;
  const alertType =
    (resumen?.por_severidad.critica ?? 0) > 0
      ? "error"
      : (resumen?.total ?? 0) > 0
        ? "warning"
        : "success";

  return (
    <>
      <Card
        size="small"
        title={esCobro ? "Alertas de cobro" : "Alertas de pago"}
        style={{ marginBottom: 16 }}
        extra={
          <Space wrap>
            <Select
              allowClear
              size="small"
              placeholder="Todas las severidades"
              style={{ width: 180 }}
              value={severidad}
              options={SEVERIDAD_OPTIONS}
              onChange={setSeveridad}
            />
            <Checkbox
              checked={incluirResueltos}
              onChange={(e) => setIncluirResueltos(e.target.checked)}
            >
              Incluir resueltas
            </Checkbox>
            <Button size="small" loading={loading} onClick={load}>
              Actualizar
            </Button>
          </Space>
        }
      >
        {resumen && (
          <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Corte al {report ? fmtDate(report.as_of) : "—"} · Las alertas se recalculan con la
              cartera y el aging.
            </Typography.Text>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Tag color="red">Críticas: {resumen.por_severidad.critica}</Tag>
              <Tag color="volcano">Altas: {resumen.por_severidad.alta}</Tag>
              <Tag color="gold">Medias: {resumen.por_severidad.media}</Tag>
              <Tag color="blue">Bajas: {resumen.por_severidad.baja}</Tag>
              <Tag>Sin gestionar: {resumen.sin_gestion}</Tag>
              {resumen.gestion_vencida > 0 && (
                <Tag color="red">Contactos vencidos: {resumen.gestion_vencida}</Tag>
              )}
              {resumen.promesas > 0 && <Tag color="gold">Promesas: {resumen.promesas}</Tag>}
            </div>
          </div>
        )}

        {resumen && (
          <Typography.Paragraph
            type={alertType === "success" ? "success" : "warning"}
            style={{ marginBottom: 12 }}
          >
            {resumen.total === 0
              ? "No hay alertas de cartera para los filtros seleccionados."
              : `${
                  report && report.alertas.length === resumen.total
                    ? `${resumen.total} alerta(s)`
                    : `${report?.alertas.length ?? 0} de ${resumen.total} alerta(s)`
                } en ${resumen.clientes_afectados} cliente(s). Saldo vencido: ${money(
                  resumen.monto_vencido
                )} · Por vencer en 7 días: ${money(resumen.monto_por_vencer_7d)}.`}
          </Typography.Paragraph>
        )}

        <Table<CarteraAlert>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={report?.alertas ?? []}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 8, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{
            emptyText: incluirResueltos
              ? "No hay alertas para los filtros seleccionados."
              : "No hay alertas pendientes. Las gestiones resueltas se ocultan.",
          }}
          columns={[
            {
              title: "Severidad",
              dataIndex: "severidad",
              width: 100,
              render: (s: CarteraAlertSeveridad) => (
                <Tag color={SEVERIDAD_META[s].color}>{SEVERIDAD_META[s].label}</Tag>
              ),
            },
            {
              title: "Alerta",
              dataIndex: "titulo",
              render: (_, row) => (
                <Tooltip title={row.detalle}>
                  <div>
                    <strong>{row.titulo}</strong>
                    <div style={{ color: "#888", fontSize: 12, maxWidth: 320 }}>{row.accion}</div>
                  </div>
                </Tooltip>
              ),
            },
            { title: "Cliente", dataIndex: "contraparte" },
            {
              title: "Factura",
              dataIndex: "numero",
              render: (_, row) => (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => navigate(`/facturas/${row.invoice_id}`)}
                >
                  {row.numero}
                </Button>
              ),
            },
            {
              title: "Vencimiento",
              dataIndex: "fecha_vencimiento",
              render: (v: string | null, row) => (
                <div>
                  <div>{v ? fmtDate(v) : "—"}</div>
                  {row.regla !== "sin_vencimiento" && (
                    <Typography.Text
                      type={row.dias_vencido > 0 ? "danger" : "secondary"}
                      style={{ fontSize: 12 }}
                    >
                      {row.dias_vencido > 0
                        ? `${row.dias_vencido} días de mora`
                        : row.dias_vencido === 0
                          ? "Vence hoy"
                          : `Vence en ${Math.abs(row.dias_vencido)} días`}
                    </Typography.Text>
                  )}
                </div>
              ),
            },
            {
              title: "Saldo",
              dataIndex: "saldo_pendiente",
              align: "right",
              render: (v: number) => <strong>{money(v)}</strong>,
            },
            {
              title: "Gestión",
              dataIndex: "seguimiento",
              render: (_, row) => {
                if (!row.seguimiento || row.seguimiento.estado === "pendiente") {
                  return <Tag>Sin gestionar</Tag>;
                }
                const meta = FOLLOWUP_META[row.seguimiento.estado];
                return (
                  <div>
                    <Tag color={row.seguimiento.vencido ? "red" : meta.color}>
                      {row.seguimiento.vencido ? "Contacto vencido" : meta.label}
                    </Tag>
                    {row.seguimiento.proximo_contacto && (
                      <div style={{ fontSize: 12, color: "#888" }}>
                        Próximo: {fmtDate(row.seguimiento.proximo_contacto)}
                      </div>
                    )}
                  </div>
                );
              },
            },
            ...(puedeGestionar
              ? [
                  {
                    title: "",
                    key: "acciones",
                    render: (_: unknown, row: CarteraAlert) => (
                      <Button size="small" onClick={() => setSelected(row)}>
                        Gestionar
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Modal
        title={selected ? `Seguimiento de cobro · ${selected.numero}` : "Seguimiento de cobro"}
        open={!!selected}
        onCancel={() => setSelected(null)}
        onOk={save}
        okText="Guardar seguimiento"
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnHidden
        width={540}
      >
        {selected && (
          <>
            <Space direction="vertical" size={2} style={{ marginBottom: 12 }}>
              <span>
                {selected.contraparte} · Saldo <strong>{money(selected.saldo_pendiente)}</strong>
              </span>
              <span style={{ color: "#888" }}>{selected.detalle}</span>
              <Typography.Text type="warning">Sugerencia: {selected.accion}</Typography.Text>
            </Space>

            <Form<FormValues> form={form} layout="vertical">
              <Form.Item
                name="estado"
                label="Estado de la gestión"
                rules={[{ required: true, message: "Selecciona un estado" }]}
              >
                <Select options={FOLLOWUP_OPTIONS} />
              </Form.Item>
              <Form.Item
                name="proximo_contacto"
                label="Próximo contacto"
                dependencies={["estado"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (getFieldValue("estado") === "promesa" && !value) {
                        return Promise.reject(
                          new Error("Una promesa de pago requiere la fecha del próximo contacto")
                        );
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="nota" label="Nota">
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder="Acuerdo, canal de contacto, compromiso del cliente…"
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  );
}
