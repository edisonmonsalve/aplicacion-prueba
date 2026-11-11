import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  EyeOutlined,
  LockOutlined,
  PlusOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { canWriteFinance } from "@/utils/roles";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import PageHeader from "@/components/PageHeader";
import TableSkeleton from "@/components/TableSkeleton";
import {
  createPeriodClosure,
  listPeriodClosures,
  reopenPeriodClosure,
} from "@/services/periodClosuresService";
import type { PeriodClosure, PeriodClosureEstado } from "@/types";
import { fmtDate, money } from "./FinanceUtils";

const ESTADO_META: Record<
  PeriodClosureEstado,
  { label: string; color: string; icon: React.ReactNode }
> = {
  cerrado: { label: "Cerrado", color: "blue", icon: <LockOutlined /> },
  reabierto: { label: "Reabierto", color: "orange", icon: <UnlockOutlined /> },
};

interface CreateValues {
  nombre: string;
  fechas: [Dayjs, Dayjs];
}

interface ReopenValues {
  motivo: string;
}

/**
 * Cierre formal de periodos.
 *
 * Un cierre guarda una foto de los totales del rango y bloquea nuevos asientos
 * dentro de él. Reabrir no borra el cierre: lo marca como reabierto con el
 * motivo y el usuario, y vuelve a permitir movimientos.
 */
export default function PeriodClosuresPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const canWrite = canWriteFinance(user?.rol);

  const [rows, setRows] = useState<PeriodClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<PeriodClosure | null>(null);
  const [reopenTarget, setReopenTarget] = useState<PeriodClosure | null>(null);
  const [createForm] = Form.useForm<CreateValues>();
  const [reopenForm] = Form.useForm<ReopenValues>();

  useDocumentTitle("Cierres de periodo");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPeriodClosures());
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudieron cargar los cierres"));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      nombre: dayjs().format("MMMM YYYY"),
      fechas: [dayjs().startOf("month"), dayjs().endOf("month")],
    });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const values = await createForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await createPeriodClosure({
        nombre: values.nombre.trim(),
        fecha_inicio: values.fechas[0].format("YYYY-MM-DD"),
        fecha_fin: values.fechas[1].format("YYYY-MM-DD"),
      });
      message.success("Periodo cerrado");
      setCreateOpen(false);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo cerrar el periodo"));
    } finally {
      setSaving(false);
    }
  };

  const openReopen = (closure: PeriodClosure) => {
    reopenForm.resetFields();
    setReopenTarget(closure);
  };

  const submitReopen = async () => {
    if (!reopenTarget) return;
    const values = await reopenForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await reopenPeriodClosure(reopenTarget.id, values.motivo.trim());
      message.success("Cierre reabierto");
      setReopenTarget(null);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo reabrir el cierre"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Cierres de periodo"
        description="Congela los totales de un rango y bloquea nuevos asientos. Reabrir deja registro del motivo y del responsable."
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Nuevo cierre
            </Button>
          ) : undefined
        }
      />

      {loading && rows.length === 0 ? (
        <TableSkeleton />
      ) : (
        <Table<PeriodClosure>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty description="Aún no hay periodos cerrados. Cierra el mes para congelar sus totales." />
            ),
          }}
          columns={[
            { title: "Nombre", dataIndex: "nombre" },
            {
              title: "Periodo",
              key: "periodo",
              render: (_, r) => `${fmtDate(r.fecha_inicio)} — ${fmtDate(r.fecha_fin)}`,
            },
            {
              title: "Estado",
              dataIndex: "estado",
              render: (e: PeriodClosureEstado) => {
                const meta = ESTADO_META[e];
                return (
                  <Tag color={meta.color} icon={meta.icon}>
                    {meta.label}
                  </Tag>
                );
              },
            },
            {
              title: "Ingresos",
              key: "ingresos",
              align: "right",
              render: (_, r) => money(r.snapshot.resumen.ingresos_totales),
            },
            {
              title: "Utilidad",
              key: "utilidad",
              align: "right",
              render: (_, r) => (
                <Typography.Text type={r.snapshot.resumen.utilidad < 0 ? "danger" : undefined}>
                  {money(r.snapshot.resumen.utilidad)}
                </Typography.Text>
              ),
            },
            {
              title: "Transacciones",
              key: "transacciones",
              align: "right",
              render: (_, r) => r.snapshot.transacciones,
            },
            {
              title: "Cerrado por",
              key: "cerrado",
              render: (_, r) => (
                <span>
                  {r.cerrado_por}
                  <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                    {fmtDate(r.cerrado_at)}
                  </Typography.Text>
                </span>
              ),
            },
            {
              title: "Reapertura",
              key: "reapertura",
              render: (_, r) =>
                r.estado === "reabierto" ? (
                  <Tooltip title={r.motivo_reapertura ?? ""}>
                    <span>
                      {r.reabierto_por ?? "—"}
                      <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                        {r.reabierto_at ? fmtDate(r.reabierto_at) : ""}
                      </Typography.Text>
                    </span>
                  </Tooltip>
                ) : (
                  "—"
                ),
            },
            {
              title: "",
              key: "acciones",
              width: 190,
              render: (_, r) => (
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)}>
                    Ver
                  </Button>
                  {canWrite && r.estado === "cerrado" && (
                    <Button size="small" icon={<UnlockOutlined />} onClick={() => openReopen(r)}>
                      Reabrir
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}

      <Modal
        title="Nuevo cierre de periodo"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        okText="Cerrar periodo"
        cancelText="Cancelar"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          Se guardará una foto de los totales y no se podrán registrar asientos con
          fecha dentro del rango mientras el cierre esté vigente.
        </Typography.Paragraph>
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[{ required: true, min: 3, max: 120 }]}
          >
            <Input placeholder="Ej. Noviembre 2026" />
          </Form.Item>
          <Form.Item
            name="fechas"
            label="Rango del periodo"
            rules={[{ required: true, message: "Selecciona el rango" }]}
          >
            <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Reabrir cierre · ${reopenTarget?.nombre ?? ""}`}
        open={!!reopenTarget}
        onCancel={() => setReopenTarget(null)}
        onOk={submitReopen}
        okText="Reabrir"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          El cierre no se borra: quedará marcado como reabierto con el motivo y tu
          usuario. Después podrás registrar asientos dentro del periodo.
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
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Ej. Ajuste contable autorizado por gerencia"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detail ? `Cierre · ${detail.nombre}` : "Cierre"}
        open={!!detail}
        width={560}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Periodo">
                {fmtDate(detail.fecha_inicio)} — {fmtDate(detail.fecha_fin)}
              </Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={ESTADO_META[detail.estado].color}>
                  {ESTADO_META[detail.estado].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Cerrado por">
                {detail.cerrado_por} · {fmtDate(detail.cerrado_at)}
              </Descriptions.Item>
              {detail.estado === "reabierto" && (
                <Descriptions.Item label="Reapertura">
                  {detail.reabierto_por} · {detail.reabierto_at ? fmtDate(detail.reabierto_at) : ""}
                  <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
                    {detail.motivo_reapertura}
                  </Typography.Paragraph>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Card size="small" title="Resumen del periodo">
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Statistic
                    title="Ingresos (resultado)"
                    value={detail.snapshot.resumen.ingresos_totales}
                    precision={2}
                    prefix="$"
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Egresos de caja"
                    value={detail.snapshot.resumen.egresos}
                    precision={2}
                    prefix="$"
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Utilidad"
                    value={detail.snapshot.resumen.utilidad}
                    precision={2}
                    prefix="$"
                    valueStyle={{
                      color: detail.snapshot.resumen.utilidad < 0 ? "#cf1322" : "#389e0d",
                    }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Capital disponible"
                    value={detail.snapshot.resumen.capital_disponible}
                    precision={2}
                    prefix="$"
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="IVA neto"
                    value={detail.snapshot.resumen.iva_neto}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: detail.snapshot.resumen.iva_neto < 0 ? "#389e0d" : undefined }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Transacciones"
                    value={detail.snapshot.transacciones}
                  />
                </Col>
              </Row>
            </Card>

            <Card size="small" title="Facturas y cartera">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Facturas">{detail.snapshot.facturas.total}</Descriptions.Item>
                <Descriptions.Item label="Confirmadas">
                  {detail.snapshot.facturas.confirmadas}
                </Descriptions.Item>
                <Descriptions.Item label="Ventas">{detail.snapshot.facturas.ventas}</Descriptions.Item>
                <Descriptions.Item label="Compras">{detail.snapshot.facturas.compras}</Descriptions.Item>
                <Descriptions.Item label="Por cobrar">
                  {money(detail.snapshot.cartera.por_cobrar)}
                </Descriptions.Item>
                <Descriptions.Item label="Por pagar">
                  {money(detail.snapshot.cartera.por_pagar)}
                </Descriptions.Item>
                <Descriptions.Item label="Retenciones ventas">
                  {money(detail.snapshot.retenciones.ventas)}
                </Descriptions.Item>
                <Descriptions.Item label="Retenciones compras">
                  {money(detail.snapshot.retenciones.compras)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Foto generada el {fmtDate(detail.snapshot.generado_at)}. Los totales quedan
              congelados aunque después cambien los datos.
            </Typography.Text>
          </Space>
        )}
      </Drawer>
    </>
  );
}
