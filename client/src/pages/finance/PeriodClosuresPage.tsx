import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  InputNumber,
  Modal,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CalendarOutlined,
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
  createFiscalClosure,
  createPeriodClosure,
  listPeriodClosures,
  previewFiscalYear,
  reopenPeriodClosure,
} from "@/services/periodClosuresService";
import type { FiscalYearPreview, PeriodClosure, PeriodClosureEstado } from "@/types";
import { fmtDate, money } from "./FinanceUtils";

const ESTADO_META: Record<
  PeriodClosureEstado,
  { label: string; color: string; icon: React.ReactNode }
> = {
  cerrado: { label: "Cerrado", color: "blue", icon: <LockOutlined /> },
  reabierto: { label: "Reabierto", color: "orange", icon: <UnlockOutlined /> },
};

type TabKey = "periodo" | "ejercicio";

interface CreateValues {
  nombre: string;
  fechas: [Dayjs, Dayjs];
}

interface FiscalValues {
  anio: number;
}

interface ReopenValues {
  motivo: string;
}

/**
 * Cierre formal de periodos y de ejercicios.
 *
 * Un cierre guarda una foto de los totales del rango y bloquea nuevos asientos
 * dentro de él. El cierre de ejercicio cubre el año completo y añade resultado
 * y balance al 31 de diciembre. Reabrir no borra el cierre: lo marca como
 * reabierto con el motivo y el usuario, y vuelve a permitir movimientos.
 */
export default function PeriodClosuresPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const canWrite = canWriteFinance(user?.rol);

  const [rows, setRows] = useState<PeriodClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("periodo");
  const [createOpen, setCreateOpen] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(dayjs().year() - 1);
  const [preview, setPreview] = useState<FiscalYearPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<PeriodClosure | null>(null);
  const [reopenTarget, setReopenTarget] = useState<PeriodClosure | null>(null);
  const [createForm] = Form.useForm<CreateValues>();
  const [fiscalForm] = Form.useForm<FiscalValues>();
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

  useEffect(() => {
    if (!fiscalOpen) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreview(null);
    previewFiscalYear(fiscalYear)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((err) => {
        if (!cancelled) {
          message.error(getErrorMessage(err, "No se pudo calcular la vista previa"));
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fiscalOpen, fiscalYear, message]);

  const periodoRows = rows.filter((r) => r.tipo !== "ejercicio");
  const fiscalRows = rows.filter((r) => r.tipo === "ejercicio");

  const openCreate = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      nombre: dayjs().format("MMMM YYYY"),
      fechas: [dayjs().startOf("month"), dayjs().endOf("month")],
    });
    setCreateOpen(true);
  };

  const openFiscal = () => {
    const anio = dayjs().year() - 1;
    fiscalForm.setFieldsValue({ anio });
    setFiscalYear(anio);
    setFiscalOpen(true);
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

  const submitFiscal = async () => {
    const values = await fiscalForm.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      await createFiscalClosure(Number(values.anio));
      message.success(`Ejercicio ${values.anio} cerrado`);
      setFiscalOpen(false);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo cerrar el ejercicio"));
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

  const estadoTag = (estado: PeriodClosureEstado) => {
    const meta = ESTADO_META[estado];
    return (
      <Tag color={meta.color} icon={meta.icon}>
        {meta.label}
      </Tag>
    );
  };

  const reopenInfo = (r: PeriodClosure) =>
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
    );

  const periodTable =
    loading && periodoRows.length === 0 ? (
      <TableSkeleton />
    ) : (
      <Table<PeriodClosure>
        rowKey="id"
        loading={loading}
        dataSource={periodoRows}
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
            render: (e: PeriodClosureEstado) => estadoTag(e),
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
            render: (_, r) => reopenInfo(r),
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
    );

  const fiscalTable =
    loading && fiscalRows.length === 0 ? (
      <TableSkeleton />
    ) : (
      <Table<PeriodClosure>
        rowKey="id"
        loading={loading}
        dataSource={fiscalRows}
        scroll={{ x: "max-content" }}
        locale={{
          emptyText: (
            <Empty description="Aún no hay ejercicios cerrados. Cierra el año para congelar su resultado y balance." />
          ),
        }}
        columns={[
          {
            title: "Ejercicio",
            dataIndex: "anio",
            render: (a: number | null) => <strong>{a ?? "—"}</strong>,
          },
          {
            title: "Periodo",
            key: "periodo",
            render: (_, r) => `${fmtDate(r.fecha_inicio)} — ${fmtDate(r.fecha_fin)}`,
          },
          {
            title: "Estado",
            dataIndex: "estado",
            render: (e: PeriodClosureEstado) => estadoTag(e),
          },
          {
            title: "Resultado",
            key: "resultado",
            align: "right",
            render: (_, r) => {
              const utilidad = r.snapshot.resultado?.utilidad ?? r.snapshot.resumen.utilidad;
              return (
                <Typography.Text type={utilidad < 0 ? "danger" : undefined}>
                  {money(utilidad)}
                </Typography.Text>
              );
            },
          },
          {
            title: "Patrimonio",
            key: "patrimonio",
            align: "right",
            render: (_, r) => money(r.snapshot.balance?.patrimonio ?? 0),
          },
          {
            title: "Meses cerrados",
            key: "meses",
            align: "right",
            render: (_, r) => r.snapshot.meses_cerrados?.length ?? 0,
          },
          {
            title: "Balance",
            key: "balance",
            render: (_, r) =>
              r.snapshot.balance ? (
                <Tag color={r.snapshot.balance.cuadra ? "green" : "orange"}>
                  {r.snapshot.balance.cuadra ? "Cuadra" : "Revisar"}
                </Tag>
              ) : (
                "—"
              ),
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
            render: (_, r) => reopenInfo(r),
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
    );

  return (
    <>
      <PageHeader
        title="Cierres"
        description={
          tab === "periodo"
            ? "Congela los totales de un rango y bloquea nuevos asientos. Reabrir deja registro del motivo y del responsable."
            : "Cierra el año completo y congela resultado y balance al 31 de diciembre. Reabrir exige motivo y queda auditado."
        }
        extra={
          canWrite ? (
            tab === "periodo" ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Nuevo cierre
              </Button>
            ) : (
              <Button type="primary" icon={<CalendarOutlined />} onClick={openFiscal}>
                Cerrar ejercicio
              </Button>
            )
          ) : undefined
        }
      />

      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as TabKey)}
        items={[
          {
            key: "periodo",
            label: "Cierres de periodo",
            children: periodTable,
          },
          {
            key: "ejercicio",
            label: "Cierres de ejercicio",
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="El cierre anual no genera asientos"
                  description="Congela el resultado y el balance al 31 de diciembre y bloquea nuevos movimientos en todo el año. No crea asientos de cierre ni de apertura: el patrimonio del balance se sigue derivando. Puede convivir con cierres mensuales; reabrir el anual no reabre los meses."
                />
                {fiscalTable}
              </>
            ),
          },
        ]}
      />

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
        title="Cerrar ejercicio"
        open={fiscalOpen}
        onCancel={() => setFiscalOpen(false)}
        onOk={submitFiscal}
        okText="Cerrar ejercicio"
        cancelText="Cancelar"
        confirmLoading={saving}
        okButtonProps={{ disabled: !preview || preview.existe_cierre_vigente }}
        destroyOnHidden
        width={640}
      >
        <Typography.Paragraph type="secondary">
          El cierre cubre del 1 de enero al 31 de diciembre. Guarda una foto del
          resultado y del balance; no crea asientos ni borra datos.
        </Typography.Paragraph>
        <Form
          form={fiscalForm}
          layout="vertical"
          onValuesChange={(_, values) => {
            const anio = Number(values.anio);
            if (Number.isInteger(anio) && anio > 0) setFiscalYear(anio);
          }}
        >
          <Form.Item
            name="anio"
            label="Año a cerrar"
            rules={[{ required: true, message: "Selecciona el año" }]}
          >
            <InputNumber
              min={2000}
              max={dayjs().year()}
              precision={0}
              style={{ width: 160 }}
            />
          </Form.Item>
        </Form>

        {previewLoading ? (
          <Spin />
        ) : preview ? (
          <>
            {preview.existe_cierre_vigente && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={`El ejercicio ${preview.anio} ya tiene un cierre vigente`}
                description="Reabre el cierre existente antes de volver a cerrar el año."
              />
            )}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Ingresos del ejercicio"
                  value={preview.snapshot.resultado?.ingresos ?? 0}
                  precision={2}
                  prefix="$"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Utilidad del ejercicio"
                  value={preview.snapshot.resultado?.utilidad ?? 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{
                    color:
                      (preview.snapshot.resultado?.utilidad ?? 0) < 0 ? "#cf1322" : "#389e0d",
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Patrimonio al cierre"
                  value={preview.snapshot.balance?.patrimonio ?? 0}
                  precision={2}
                  prefix="$"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Meses cerrados"
                  value={preview.snapshot.meses_cerrados?.length ?? 0}
                />
              </Col>
            </Row>
            <Space wrap style={{ marginTop: 12 }}>
              <Tag color="blue">
                Activo: {money(preview.snapshot.balance?.activo ?? 0)}
              </Tag>
              <Tag color="volcano">
                Pasivo: {money(preview.snapshot.balance?.pasivo ?? 0)}
              </Tag>
              <Tag color="cyan">
                Caja: {money(preview.snapshot.balance?.caja_bancos ?? 0)}
              </Tag>
              <Tag color={preview.snapshot.balance?.cuadra ? "green" : "orange"}>
                {preview.snapshot.balance?.cuadra ? "Balance cuadrado" : "Balance a revisar"}
              </Tag>
            </Space>
          </>
        ) : null}
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
          {reopenTarget?.tipo === "ejercicio" &&
            " Reabrir el ejercicio no reabre los cierres mensuales que ya existan."}
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
        title={
          detail
            ? detail.tipo === "ejercicio"
              ? `Cierre de ejercicio ${detail.anio ?? ""}`
              : `Cierre · ${detail.nombre}`
            : "Cierre"
        }
        open={!!detail}
        width={620}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Tipo">
                {detail.tipo === "ejercicio" ? "Ejercicio anual" : "Periodo"}
              </Descriptions.Item>
              <Descriptions.Item label="Periodo">
                {fmtDate(detail.fecha_inicio)} — {fmtDate(detail.fecha_fin)}
              </Descriptions.Item>
              <Descriptions.Item label="Estado">{estadoTag(detail.estado)}</Descriptions.Item>
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

            {detail.tipo === "ejercicio" && detail.snapshot.resultado && (
              <Card size="small" title={`Resultado del ejercicio ${detail.anio ?? ""}`}>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="Ingresos"
                      value={detail.snapshot.resultado.ingresos}
                      precision={2}
                      prefix="$"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Costo de ventas"
                      value={detail.snapshot.resultado.costo_ventas}
                      precision={2}
                      prefix="$"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Margen bruto"
                      value={detail.snapshot.resultado.margen_bruto}
                      precision={2}
                      prefix="$"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Gastos"
                      value={detail.snapshot.resultado.gastos}
                      precision={2}
                      prefix="$"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Utilidad"
                      value={detail.snapshot.resultado.utilidad}
                      precision={2}
                      prefix="$"
                      valueStyle={{
                        color: detail.snapshot.resultado.utilidad < 0 ? "#cf1322" : "#389e0d",
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Utilidad %"
                      value={detail.snapshot.resultado.utilidad_pct}
                      precision={2}
                      suffix="%"
                    />
                  </Col>
                </Row>
              </Card>
            )}

            {detail.tipo === "ejercicio" && detail.snapshot.balance && (
              <Card size="small" title="Balance al 31 de diciembre">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Activo">
                    {money(detail.snapshot.balance.activo)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Pasivo">
                    {money(detail.snapshot.balance.pasivo)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Patrimonio">
                    {money(detail.snapshot.balance.patrimonio)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Caja y bancos">
                    {money(detail.snapshot.balance.caja_bancos)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Inventario">
                    {money(detail.snapshot.balance.inventario)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Cartera por cobrar">
                    {money(detail.snapshot.balance.cartera_por_cobrar)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Cartera por pagar">
                    {money(detail.snapshot.balance.cartera_por_pagar)}
                  </Descriptions.Item>
                  <Descriptions.Item label="IVA por pagar">
                    {money(detail.snapshot.balance.iva_por_pagar)}
                  </Descriptions.Item>
                  <Descriptions.Item label="IVA a favor">
                    {money(detail.snapshot.balance.iva_a_favor)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ecuación">
                    <Tag color={detail.snapshot.balance.cuadra ? "green" : "orange"}>
                      {detail.snapshot.balance.cuadra ? "Cuadra" : "Revisar"}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

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

            {detail.tipo === "ejercicio" && detail.snapshot.meses_cerrados && (
              <Card size="small" title="Meses cerrados incluidos">
                {detail.snapshot.meses_cerrados.length === 0 ? (
                  <Typography.Text type="secondary">
                    No había cierres mensuales vigentes al cerrar el ejercicio.
                  </Typography.Text>
                ) : (
                  <Space direction="vertical" size={2}>
                    {detail.snapshot.meses_cerrados.map((m) => (
                      <Typography.Text key={m.id}>
                        {m.nombre} · {fmtDate(m.fecha_inicio)} — {fmtDate(m.fecha_fin)}
                      </Typography.Text>
                    ))}
                  </Space>
                )}
              </Card>
            )}

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
