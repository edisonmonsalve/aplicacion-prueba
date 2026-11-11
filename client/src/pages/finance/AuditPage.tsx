import { useEffect, useMemo, useState } from "react";
import {
  App,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { listAudit } from "@/services/auditService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import PageHeader from "@/components/PageHeader";
import TableSkeleton from "@/components/TableSkeleton";
import type { AuditEntity, AuditEntry, AuditList } from "@/types";

const FMT = "YYYY-MM-DD";

const ENTIDAD_META: Record<AuditEntity, { label: string; color: string }> = {
  budget: { label: "Presupuesto", color: "geekblue" },
  transaction: { label: "Transacción", color: "green" },
  account: { label: "Cuenta", color: "cyan" },
  payment: { label: "Pago", color: "gold" },
  period_closure: { label: "Cierre", color: "purple" },
  invoice_adjustment: { label: "Nota", color: "cyan" },
};

const ENTIDAD_OPTIONS = (Object.keys(ENTIDAD_META) as AuditEntity[]).map((value) => ({
  value,
  label: ENTIDAD_META[value].label,
}));

const ACCION_META: Record<string, { label: string; color: string }> = {
  crear: { label: "Crear", color: "green" },
  actualizar: { label: "Actualizar", color: "blue" },
  eliminar: { label: "Eliminar", color: "red" },
  activar: { label: "Activar", color: "cyan" },
  cerrar: { label: "Cerrar", color: "purple" },
  anular: { label: "Anular", color: "volcano" },
  reabrir: { label: "Reabrir", color: "orange" },
};

const ACCION_OPTIONS = Object.keys(ACCION_META).map((value) => ({
  value,
  label: ACCION_META[value].label,
}));

const fechaHora = (value: string) => {
  const d = dayjs(value);
  return d.isValid() ? d.format("DD/MM/YYYY HH:mm") : value;
};

const JsonBlock = ({ title, value }: { title: string; value: Record<string, unknown> | null }) => (
  <div style={{ marginTop: 8 }}>
    <Typography.Text strong style={{ fontSize: 12 }}>
      {title}
    </Typography.Text>
    <pre
      style={{
        margin: "4px 0 0",
        padding: 8,
        borderRadius: 6,
        background: "rgba(0, 0, 0, 0.04)",
        fontSize: 12,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {value ? JSON.stringify(value, null, 2) : "—"}
    </pre>
  </div>
);

export default function AuditPage() {
  const { message } = App.useApp();
  const { get, getNumber, getPositiveInt, update } = useUrlFilters();
  const [report, setReport] = useState<AuditList | null>(null);
  const [loading, setLoading] = useState(true);

  const page = getPositiveInt("page", 1);
  const pageSize = getPositiveInt("pageSize", 20);
  const rawEntidad = get("entidad");
  const entidad = rawEntidad && rawEntidad in ENTIDAD_META ? (rawEntidad as AuditEntity) : undefined;
  const entidadId = getNumber("entidad_id");
  const accion = get("accion");
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(() => {
    const inicial = get("desde");
    const final = get("hasta");
    if (!inicial && !final) return null;
    return [
      inicial && dayjs(inicial).isValid() ? dayjs(inicial) : dayjs().subtract(30, "day"),
      final && dayjs(final).isValid() ? dayjs(final) : dayjs(),
    ];
  });

  useDocumentTitle("Auditoría");

  const filters = useMemo(
    () => ({
      page,
      pageSize,
      entidad,
      entidad_id: entidadId,
      accion,
      desde: range?.[0].format(FMT),
      hasta: range?.[1].format(FMT),
    }),
    [page, pageSize, entidad, entidadId, accion, range]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAudit(filters)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar la auditoría")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, message]);

  const changeRange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!value || !value[0] || !value[1]) {
      setRange(null);
      update({ desde: undefined, hasta: undefined, page: undefined });
      return;
    }
    const next: [dayjs.Dayjs, dayjs.Dayjs] = [value[0], value[1]];
    setRange(next);
    update({ desde: next[0].format(FMT), hasta: next[1].format(FMT), page: undefined });
  };

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Bitácora de solo lectura del módulo financiero: quién cambió qué, cuándo y con qué valores antes y después. No permite editar ni borrar registros."
      />

      {report && report.resumen_por_entidad.length > 0 && (
        <Space wrap style={{ marginBottom: 16 }}>
          {report.resumen_por_entidad.map((r) => (
            <Tag key={r.entidad} color={ENTIDAD_META[r.entidad]?.color ?? "default"}>
              {ENTIDAD_META[r.entidad]?.label ?? r.entidad}: {r.total}
            </Tag>
          ))}
        </Space>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} lg={6}>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
              Entidad
            </Typography.Text>
            <Select
              allowClear
              style={{ width: "100%" }}
              placeholder="Todas"
              value={entidad}
              options={ENTIDAD_OPTIONS}
              onChange={(value) => update({ entidad: value, page: undefined })}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
              Acción
            </Typography.Text>
            <Select
              allowClear
              style={{ width: "100%" }}
              placeholder="Todas"
              value={accion}
              options={ACCION_OPTIONS}
              onChange={(value) => update({ accion: value, page: undefined })}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
              ID de la entidad
            </Typography.Text>
            <Select
              allowClear
              showSearch
              style={{ width: "100%" }}
              placeholder="Cualquiera"
              value={entidadId}
              options={(report?.data ?? [])
                .filter((r) => !entidad || r.entidad === entidad)
                .map((r) => ({
                  value: r.entidad_id,
                  label: `#${r.entidad_id} · ${ENTIDAD_META[r.entidad]?.label ?? r.entidad}`,
                }))
                .filter(
                  (option, index, all) =>
                    all.findIndex((o) => o.value === option.value) === index
                )}
              onChange={(value) => update({ entidad_id: value, page: undefined })}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
              Fechas
            </Typography.Text>
            <DatePicker.RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              value={range}
              onChange={changeRange}
            />
          </Col>
        </Row>
      </Card>

      {loading && !report ? (
        <TableSkeleton />
      ) : !report || report.data.length === 0 ? (
        <Empty description="Sin registros de auditoría para los filtros elegidos" />
      ) : (
        <Table<AuditEntry>
          rowKey="id"
          loading={loading}
          dataSource={report.data}
          scroll={{ x: "max-content" }}
          expandable={{
            expandedRowRender: (r) => (
              <Row gutter={[12, 0]}>
                <Col xs={24} md={12}>
                  <JsonBlock title="Antes" value={r.antes} />
                </Col>
                <Col xs={24} md={12}>
                  <JsonBlock title="Después" value={r.despues} />
                </Col>
              </Row>
            ),
          }}
          pagination={{
            current: report.page,
            pageSize: report.pageSize,
            total: report.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${total} registro(s)`,
            onChange: (nextPage, nextSize) =>
              update(
                {
                  page: nextPage,
                  pageSize: nextSize === report.pageSize ? undefined : nextSize,
                },
                { resetPage: true }
              ),
          }}
          columns={[
            {
              title: "Fecha",
              dataIndex: "created_at",
              render: (v: string) => fechaHora(v),
            },
            {
              title: "Usuario",
              dataIndex: "usuario",
              render: (v: string | null) =>
                v ?? <Typography.Text type="secondary">Sistema</Typography.Text>,
            },
            {
              title: "Entidad",
              dataIndex: "entidad",
              render: (v: AuditEntity) => (
                <Tag color={ENTIDAD_META[v]?.color ?? "default"}>
                  {ENTIDAD_META[v]?.label ?? v}
                </Tag>
              ),
            },
            {
              title: "ID",
              dataIndex: "entidad_id",
              align: "right",
              render: (v: number) => `#${v}`,
            },
            {
              title: "Acción",
              dataIndex: "accion",
              render: (v: string) => (
                <Tag color={ACCION_META[v]?.color ?? "default"}>{ACCION_META[v]?.label ?? v}</Tag>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
