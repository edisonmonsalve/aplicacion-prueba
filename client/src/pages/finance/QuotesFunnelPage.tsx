import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Card,
  Col,
  DatePicker,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { getQuoteFunnel } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import PageHeader from "@/components/PageHeader";
import ReportExport from "@/components/ReportExport";
import TableSkeleton from "@/components/TableSkeleton";
import type {
  QuoteFunnelDetail,
  QuoteFunnelReport,
  QuoteFunnelStage,
  QuoteFunnelState,
} from "@/types";
import { exportReportCsv, printReport, type ReportDocument } from "@/utils/reportExport";
import { fmtDate, money } from "./FinanceUtils";

const FMT = "YYYY-MM-DD";

const STAGE_LABELS: Record<string, string> = {
  creadas: "Creadas",
  enviadas: "Enviadas",
  aprobadas: "Aprobadas",
  entregadas: "Entregadas",
};

const STAGE_COLORS: Record<string, string> = {
  creadas: "#1677ff",
  enviadas: "#13c2c2",
  aprobadas: "#52c41a",
  entregadas: "#722ed1",
};

const ESTADO_META: Record<QuoteFunnelState, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "default" },
  enviado: { label: "Enviado", color: "blue" },
  vencido: { label: "Vencido", color: "orange" },
  aprobado: { label: "Aprobado", color: "green" },
  rechazado: { label: "Rechazado", color: "red" },
  entregado: { label: "Entregado", color: "purple" },
};

const Tiempo = ({
  titulo,
  tiempo,
}: {
  titulo: string;
  tiempo: { promedio: number | null; muestra: number; minimo: number | null; maximo: number | null };
}) => (
  <Card size="small">
    <Statistic
      title={titulo}
      value={tiempo.promedio ?? 0}
      precision={tiempo.promedio === null ? 0 : 1}
      suffix={tiempo.promedio === null ? "" : "días"}
      valueStyle={{ color: "#1677ff" }}
    />
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {tiempo.muestra === 0
        ? "Sin cotizaciones en la etapa"
        : `${tiempo.muestra} cotización(es) · mín. ${tiempo.minimo} · máx. ${tiempo.maximo}`}
    </Typography.Text>
  </Card>
);

function buildReportDoc(r: QuoteFunnelReport): ReportDocument {
  return {
    title: "Embudo de cotizaciones",
    subtitle: `Periodo de creación: ${fmtDate(r.rango.desde)} — ${fmtDate(r.rango.hasta)}`,
    meta: [
      { label: "Cotizaciones creadas", value: String(r.resumen.cotizaciones) },
      { label: "Monto cotizado", value: money(r.resumen.monto) },
      { label: "Tasa de aprobación", value: `${r.resumen.tasa_aprobacion.toFixed(1)} %` },
      { label: "Tasa de cierre", value: `${r.resumen.tasa_cierre.toFixed(1)} %` },
      { label: "Ticket promedio", value: money(r.resumen.ticket_promedio) },
    ],
    sections: [
      {
        title: "Embudo",
        columns: [
          { header: "Etapa" },
          { header: "Cotizaciones", format: "number" },
          { header: "Monto", format: "money" },
          { header: "Tasa conversión", format: "percent" },
          { header: "Tasa global", format: "percent" },
        ],
        rows: r.embudo.map((e) => [
          STAGE_LABELS[e.etapa] ?? e.etapa,
          e.cotizaciones,
          e.monto,
          e.tasa_conversion,
          e.tasa_global,
        ]),
      },
      {
        title: "Estados actuales",
        columns: [
          { header: "Estado" },
          { header: "Cotizaciones", format: "number" },
          { header: "Monto", format: "money" },
          { header: "Participación", format: "percent" },
        ],
        rows: r.estados.map((e) => [
          ESTADO_META[e.estado].label,
          e.cotizaciones,
          e.monto,
          e.participacion,
        ]),
      },
      {
        title: "Tiempos de cierre",
        columns: [
          { header: "Tramo" },
          { header: "Promedio (días)", format: "number" },
          { header: "Muestra", format: "number" },
          { header: "Mínimo (días)", format: "number" },
          { header: "Máximo (días)", format: "number" },
        ],
        rows: [
          [
            "Creación → aprobación",
            r.tiempos.aprobacion.promedio,
            r.tiempos.aprobacion.muestra,
            r.tiempos.aprobacion.minimo,
            r.tiempos.aprobacion.maximo,
          ],
          [
            "Aprobación → entrega",
            r.tiempos.entrega.promedio,
            r.tiempos.entrega.muestra,
            r.tiempos.entrega.minimo,
            r.tiempos.entrega.maximo,
          ],
          [
            "Ciclo completo",
            r.tiempos.ciclo.promedio,
            r.tiempos.ciclo.muestra,
            r.tiempos.ciclo.minimo,
            r.tiempos.ciclo.maximo,
          ],
        ],
      },
      {
        title: "Detalle",
        columns: [
          { header: "Cotización" },
          { header: "Cliente" },
          { header: "Estado" },
          { header: "Monto", format: "money" },
          { header: "Creada", format: "date" },
          { header: "Aprobada", format: "date" },
          { header: "Entregada", format: "date" },
          { header: "Días aprobación", format: "number" },
          { header: "Días entrega", format: "number" },
          { header: "Ciclo (días)", format: "number" },
        ],
        rows: r.detalle.map((d) => [
          `#${d.id}`,
          d.cliente,
          ESTADO_META[d.estado].label,
          d.total,
          d.creado_at,
          d.aprobado_at,
          d.entregado_at,
          d.dias_aprobacion,
          d.dias_entrega,
          d.dias_ciclo,
        ]),
      },
    ],
  };
}

export default function QuotesFunnelPage() {
  const { message } = App.useApp();
  const { get, update } = useUrlFilters();
  const [report, setReport] = useState<QuoteFunnelReport | null>(null);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const inicial = get("desde");
    const final = get("hasta");
    return [
      inicial && dayjs(inicial).isValid() ? dayjs(inicial) : dayjs().startOf("month"),
      final && dayjs(final).isValid() ? dayjs(final) : dayjs(),
    ];
  });

  useDocumentTitle("Embudo de cotizaciones");

  const changeRange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!value || !value[0] || !value[1]) return;
    const next: [dayjs.Dayjs, dayjs.Dayjs] = [value[0], value[1]];
    setRange(next);
    update({ desde: next[0].format(FMT), hasta: next[1].format(FMT) });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getQuoteFunnel({
      desde: range[0].format(FMT),
      hasta: range[1].format(FMT),
    })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) =>
        message.error(getErrorMessage(err, "No se pudo cargar el embudo de cotizaciones"))
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, message]);

  const creadas = report?.embudo.find((e) => e.etapa === "creadas")?.cotizaciones ?? 0;

  const exportCsv = () => {
    if (!report) return;
    exportReportCsv(
      `embudo-cotizaciones-${report.rango.desde}-a-${report.rango.hasta}.csv`,
      buildReportDoc(report)
    );
  };

  const exportPdf = (target?: Window | null) => {
    if (!report) return;
    printReport(buildReportDoc(report), target);
  };

  return (
    <>
      <PageHeader
        title="Embudo de cotizaciones"
        description="Conversión de cotizaciones creadas en el periodo: enviadas, aprobadas y entregadas. Incluye tiempos de aprobación, entrega y ciclo completo."
        extra={
          <Space wrap>
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              value={range}
              onChange={changeRange}
              allowClear={false}
            />
            <ReportExport disabled={!report} onCsv={exportCsv} onPdf={exportPdf} />
          </Space>
        }
      />

      {report && report.resumen.cotizaciones === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sin cotizaciones creadas en el periodo"
          description="Cambia el rango de fechas o crea cotizaciones para ver el embudo."
        />
      )}

      {report && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic title="Cotizaciones creadas" value={report.resumen.cotizaciones} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Monto cotizado: {money(report.resumen.monto)}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Tasa de aprobación"
                  value={report.resumen.tasa_aprobacion}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: "#389e0d" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {report.resumen.aprobadas} de {report.resumen.enviadas} enviadas
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Tasa de cierre"
                  value={report.resumen.tasa_cierre}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: "#722ed1" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {report.resumen.entregadas} entregadas de {report.resumen.cotizaciones}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Ticket promedio"
                  value={report.resumen.ticket_promedio}
                  precision={2}
                  prefix="$"
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {report.resumen.rechazadas} rechazada(s) en el periodo
                </Typography.Text>
              </Card>
            </Col>
          </Row>

          <Typography.Paragraph type="secondary">
            Periodo de creación: {fmtDate(report.rango.desde)} — {fmtDate(report.rango.hasta)}
          </Typography.Paragraph>
        </>
      )}

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        report && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} lg={14}>
                <Card size="small" title="Embudo">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    {report.embudo.map((etapa: QuoteFunnelStage) => (
                      <div key={etapa.etapa}>
                        <Row justify="space-between" align="middle">
                          <Typography.Text strong>{STAGE_LABELS[etapa.etapa]}</Typography.Text>
                          <Space size={8}>
                            <Typography.Text>{etapa.cotizaciones}</Typography.Text>
                            <Typography.Text type="secondary">{money(etapa.monto)}</Typography.Text>
                            <Tag color="default">{etapa.tasa_conversion.toFixed(1)} %</Tag>
                          </Space>
                        </Row>
                        <Progress
                          percent={creadas > 0 ? (etapa.cotizaciones / creadas) * 100 : 0}
                          showInfo={false}
                          strokeColor={STAGE_COLORS[etapa.etapa]}
                        />
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {etapa.tasa_global.toFixed(1)} % del total creado
                        </Typography.Text>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card size="small" title="Estados actuales">
                  {report.estados.length === 0 ? (
                    <Typography.Text type="secondary">Sin cotizaciones en el periodo.</Typography.Text>
                  ) : (
                    <Space direction="vertical" size="small" style={{ width: "100%" }}>
                      {report.estados.map((e) => (
                        <Row key={e.estado} justify="space-between" align="middle">
                          <Tag color={ESTADO_META[e.estado].color}>{ESTADO_META[e.estado].label}</Tag>
                          <Space size={8}>
                            <Typography.Text>{e.cotizaciones}</Typography.Text>
                            <Typography.Text type="secondary">{money(e.monto)}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {e.participacion.toFixed(1)} %
                            </Typography.Text>
                          </Space>
                        </Row>
                      ))}
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>

            <Typography.Title level={5}>Tiempos de cierre</Typography.Title>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} md={8}>
                <Tiempo titulo="Creación → aprobación" tiempo={report.tiempos.aprobacion} />
              </Col>
              <Col xs={24} md={8}>
                <Tiempo titulo="Aprobación → entrega" tiempo={report.tiempos.entrega} />
              </Col>
              <Col xs={24} md={8}>
                <Tiempo titulo="Ciclo completo" tiempo={report.tiempos.ciclo} />
              </Col>
            </Row>

            <Table<QuoteFunnelDetail>
              rowKey="id"
              loading={loading}
              dataSource={report.detalle}
              scroll={{ x: "max-content" }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              columns={[
                {
                  title: "Cotización",
                  dataIndex: "id",
                  render: (id: number) => <Link to={`/cotizaciones/${id}`}>#{id}</Link>,
                },
                { title: "Cliente", dataIndex: "cliente" },
                {
                  title: "Estado",
                  dataIndex: "estado",
                  render: (estado: QuoteFunnelState) => (
                    <Tag color={ESTADO_META[estado].color}>{ESTADO_META[estado].label}</Tag>
                  ),
                },
                {
                  title: "Monto",
                  dataIndex: "total",
                  align: "right",
                  sorter: (a, b) => a.total - b.total,
                  render: (v: number) => money(v),
                },
                {
                  title: "Creada",
                  dataIndex: "creado_at",
                  render: (v: string) => fmtDate(v),
                },
                {
                  title: "Aprobada",
                  dataIndex: "aprobado_at",
                  render: (v: string | null) => (v ? fmtDate(v) : "—"),
                },
                {
                  title: "Entregada",
                  dataIndex: "entregado_at",
                  render: (v: string | null) => (v ? fmtDate(v) : "—"),
                },
                {
                  title: "Días aprobación",
                  dataIndex: "dias_aprobacion",
                  align: "right",
                  sorter: (a, b) => (a.dias_aprobacion ?? -1) - (b.dias_aprobacion ?? -1),
                  render: (v: number | null) => (v === null ? "—" : v),
                },
                {
                  title: "Días entrega",
                  dataIndex: "dias_entrega",
                  align: "right",
                  sorter: (a, b) => (a.dias_entrega ?? -1) - (b.dias_entrega ?? -1),
                  render: (v: number | null) => (v === null ? "—" : v),
                },
                {
                  title: "Ciclo (días)",
                  dataIndex: "dias_ciclo",
                  align: "right",
                  sorter: (a, b) => (a.dias_ciclo ?? -1) - (b.dias_ciclo ?? -1),
                  render: (v: number | null) => (v === null ? "—" : v),
                },
              ]}
            />
          </>
        )
      )}
    </>
  );
}
