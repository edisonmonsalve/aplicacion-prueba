import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Card,
  Col,
  DatePicker,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { RiseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTrends } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import PageHeader from "@/components/PageHeader";
import ReportExport from "@/components/ReportExport";
import TableSkeleton from "@/components/TableSkeleton";
import type { TrendMonth, TrendsReport } from "@/types";
import { exportReportCsv, printReport, type ReportDocument } from "@/utils/reportExport";
import { fmtDate, money } from "./FinanceUtils";

const FMT = "YYYY-MM-DD";

const MES_LABEL = (mes: string) => {
  const [anio, m] = mes.split("-");
  const fecha = dayjs(`${anio}-${m}-01`);
  return fecha.isValid() ? fecha.format("MMM YY") : mes;
};

const Variacion = ({ value }: { value: number | null }) => {
  if (value === null) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <Tag color={value > 0 ? "green" : value < 0 ? "red" : "default"}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)} %
    </Tag>
  );
};

const Comparativo = ({
  titulo,
  desde,
  hasta,
  ingresos,
  utilidad,
  variacionIngresos,
  variacionUtilidad,
}: {
  titulo: string;
  desde: string;
  hasta: string;
  ingresos: number;
  utilidad: number;
  variacionIngresos: number | null;
  variacionUtilidad: number | null;
}) => (
  <Card size="small" title={titulo}>
    <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
      {fmtDate(desde)} — {fmtDate(hasta)}
    </Typography.Text>
    <Row gutter={12}>
      <Col span={12}>
        <Statistic title="Ingresos" value={ingresos} precision={2} prefix="$" />
        <div style={{ marginTop: 4 }}>
          Variación: <Variacion value={variacionIngresos} />
        </div>
      </Col>
      <Col span={12}>
        <Statistic
          title="Utilidad"
          value={utilidad}
          precision={2}
          prefix="$"
          valueStyle={{ color: utilidad < 0 ? "#cf1322" : "#389e0d" }}
        />
        <div style={{ marginTop: 4 }}>
          Variación: <Variacion value={variacionUtilidad} />
        </div>
      </Col>
    </Row>
  </Card>
);

function buildReportDoc(r: TrendsReport): ReportDocument {
  const ultimoSaldo = r.serie.at(-1)?.saldo_caja ?? 0;

  return {
    title: "Tendencias",
    subtitle: `Periodo: ${fmtDate(r.rango.desde)} — ${fmtDate(r.rango.hasta)} · ${
      r.rango.meses
    } mes(es) · ${r.rango.dias} días`,
    meta: [
      { label: "Ingresos", value: money(r.totales.ingresos) },
      { label: "Utilidad", value: money(r.totales.utilidad) },
      { label: "Neto de caja", value: money(r.totales.neto_caja) },
      { label: "Saldo de caja al cierre", value: money(ultimoSaldo) },
    ],
    sections: [
      {
        title: "Resultado y caja por mes",
        columns: [
          { header: "Mes" },
          { header: "Ingresos", format: "money" },
          { header: "Costo ventas", format: "money" },
          { header: "Margen", format: "money" },
          { header: "Margen %", format: "percent" },
          { header: "Gastos", format: "money" },
          { header: "Utilidad", format: "money" },
          { header: "Entradas", format: "money" },
          { header: "Salidas", format: "money" },
          { header: "Neto caja", format: "money" },
          { header: "Saldo caja", format: "money" },
          { header: "Var. ingresos", format: "percent" },
          { header: "Var. utilidad", format: "percent" },
        ],
        rows: r.serie.map((m) => [
          MES_LABEL(m.mes),
          m.ingresos,
          m.costo_ventas,
          m.margen,
          m.margen_pct,
          m.gastos,
          m.utilidad,
          m.entradas,
          m.salidas,
          m.neto_caja,
          m.saldo_caja,
          m.variacion_ingresos,
          m.variacion_utilidad,
        ]),
      },
      {
        title: "Comparativos",
        columns: [
          { header: "Comparativo" },
          { header: "Desde", format: "date" },
          { header: "Hasta", format: "date" },
          { header: "Ingresos", format: "money" },
          { header: "Utilidad", format: "money" },
          { header: "Var. ingresos", format: "percent" },
          { header: "Var. utilidad", format: "percent" },
        ],
        rows: [
          [
            "Periodo anterior de igual duración",
            r.comparacion.anterior.desde,
            r.comparacion.anterior.hasta,
            r.comparacion.anterior.totales.ingresos,
            r.comparacion.anterior.totales.utilidad,
            r.comparacion.variaciones.ingresos_vs_anterior,
            r.comparacion.variaciones.utilidad_vs_anterior,
          ],
          [
            "Mismo rango del año anterior",
            r.comparacion.anio_anterior.desde,
            r.comparacion.anio_anterior.hasta,
            r.comparacion.anio_anterior.totales.ingresos,
            r.comparacion.anio_anterior.totales.utilidad,
            r.comparacion.variaciones.ingresos_vs_anio_anterior,
            r.comparacion.variaciones.utilidad_vs_anio_anterior,
          ],
        ],
        note: "Las variaciones mensuales se calculan contra el mes anterior; las de esta tabla, contra cada periodo de referencia.",
      },
    ],
  };
}

export default function TrendsPage() {
  const { message } = App.useApp();
  const { get, update } = useUrlFilters();
  const [report, setReport] = useState<TrendsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const inicial = get("desde");
    const final = get("hasta");
    return [
      inicial && dayjs(inicial).isValid() ? dayjs(inicial) : dayjs().subtract(5, "month").startOf("month"),
      final && dayjs(final).isValid() ? dayjs(final) : dayjs(),
    ];
  });

  useDocumentTitle("Tendencias");

  const changeRange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!value || !value[0] || !value[1]) return;
    const next: [dayjs.Dayjs, dayjs.Dayjs] = [value[0], value[1]];
    setRange(next);
    update({ desde: next[0].format(FMT), hasta: next[1].format(FMT) });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTrends({
      desde: range[0].format(FMT),
      hasta: range[1].format(FMT),
    })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudieron cargar las tendencias")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, message]);

  const chartData = useMemo(
    () =>
      (report?.serie ?? []).map((m) => ({
        ...m,
        label: MES_LABEL(m.mes),
        Ingresos: m.ingresos,
        Utilidad: m.utilidad,
        "Neto de caja": m.neto_caja,
      })),
    [report]
  );

  const exportCsv = () => {
    if (!report) return;
    exportReportCsv(
      `tendencias-${report.rango.desde}-a-${report.rango.hasta}.csv`,
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
        title="Tendencias"
        description="Evolución mensual del resultado (devengo) y de la caja real, con comparación contra el periodo anterior de igual duración y el mismo rango del año anterior."
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

      {report && report.serie.every((m) => m.ingresos === 0 && m.gastos === 0) && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sin movimientos de resultado en el periodo"
          description="La serie muestra los meses en cero. Registra facturas o transacciones para ver la tendencia."
        />
      )}

      {report && (
        <>
          <Typography.Paragraph type="secondary">
            Periodo: {fmtDate(report.rango.desde)} — {fmtDate(report.rango.hasta)} ·{" "}
            {report.rango.meses} mes(es) · {report.rango.dias} días
          </Typography.Paragraph>

          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Ingresos del periodo"
                  value={report.totales.ingresos}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#1677ff" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Margen bruto {money(report.totales.margen)} ({report.totales.margen_pct.toFixed(1)} %)
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Utilidad del periodo"
                  value={report.totales.utilidad}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: report.totales.utilidad < 0 ? "#cf1322" : "#389e0d" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Gastos operativos {money(report.totales.gastos)}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Neto de caja"
                  value={report.totales.neto_caja}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: report.totales.neto_caja < 0 ? "#cf1322" : "#389e0d" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Entradas {money(report.totales.entradas)} · Salidas {money(report.totales.salidas)}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Saldo de caja al cierre"
                  value={report.serie.at(-1)?.saldo_caja ?? 0}
                  precision={2}
                  prefix="$"
                  suffix={<RiseOutlined style={{ fontSize: 14, color: "#1677ff" }} />}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Incluye saldos iniciales de las cuentas
                </Typography.Text>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        report && (
          <>
            <Card size="small" title="Resultado y caja por mes" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(v: number) => money(v)} width={90} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#1677ff" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Utilidad" fill="#52c41a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Neto de caja" fill="#722ed1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card size="small" title="Saldo de caja acumulado" style={{ marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(v: number) => money(v)} width={90} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Line
                    type="monotone"
                    dataKey="saldo_caja"
                    name="Saldo de caja"
                    stroke="#13c2c2"
                    strokeWidth={2}
                    dot
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} lg={12}>
                <Comparativo
                  titulo="Periodo anterior de igual duración"
                  desde={report.comparacion.anterior.desde}
                  hasta={report.comparacion.anterior.hasta}
                  ingresos={report.comparacion.anterior.totales.ingresos}
                  utilidad={report.comparacion.anterior.totales.utilidad}
                  variacionIngresos={report.comparacion.variaciones.ingresos_vs_anterior}
                  variacionUtilidad={report.comparacion.variaciones.utilidad_vs_anterior}
                />
              </Col>
              <Col xs={24} lg={12}>
                <Comparativo
                  titulo="Mismo rango del año anterior"
                  desde={report.comparacion.anio_anterior.desde}
                  hasta={report.comparacion.anio_anterior.hasta}
                  ingresos={report.comparacion.anio_anterior.totales.ingresos}
                  utilidad={report.comparacion.anio_anterior.totales.utilidad}
                  variacionIngresos={report.comparacion.variaciones.ingresos_vs_anio_anterior}
                  variacionUtilidad={report.comparacion.variaciones.utilidad_vs_anio_anterior}
                />
              </Col>
            </Row>

            <Table<TrendMonth>
              rowKey="mes"
              loading={loading}
              dataSource={report.serie}
              scroll={{ x: "max-content" }}
              pagination={false}
              columns={[
                {
                  title: "Mes",
                  dataIndex: "mes",
                  render: (mes: string) => <strong>{MES_LABEL(mes)}</strong>,
                },
                {
                  title: "Ingresos",
                  dataIndex: "ingresos",
                  align: "right",
                  render: (v: number) => money(v),
                },
                {
                  title: "Costo ventas",
                  dataIndex: "costo_ventas",
                  align: "right",
                  render: (v: number) => money(v),
                },
                {
                  title: "Margen",
                  dataIndex: "margen",
                  align: "right",
                  render: (v: number) => <strong>{money(v)}</strong>,
                },
                {
                  title: "Gastos",
                  dataIndex: "gastos",
                  align: "right",
                  render: (v: number) => money(v),
                },
                {
                  title: "Utilidad",
                  dataIndex: "utilidad",
                  align: "right",
                  render: (v: number) => (
                    <Typography.Text type={v < 0 ? "danger" : "success"}>{money(v)}</Typography.Text>
                  ),
                },
                {
                  title: "Entradas",
                  dataIndex: "entradas",
                  align: "right",
                  render: (v: number) => money(v),
                },
                {
                  title: "Salidas",
                  dataIndex: "salidas",
                  align: "right",
                  render: (v: number) => money(v),
                },
                {
                  title: "Neto caja",
                  dataIndex: "neto_caja",
                  align: "right",
                  render: (v: number) => (
                    <Typography.Text type={v < 0 ? "danger" : "success"}>{money(v)}</Typography.Text>
                  ),
                },
                {
                  title: "Saldo caja",
                  dataIndex: "saldo_caja",
                  align: "right",
                  render: (v: number) => money(v),
                },
                {
                  title: "Var. ingresos",
                  dataIndex: "variacion_ingresos",
                  align: "right",
                  render: (v: number | null) => <Variacion value={v} />,
                },
                {
                  title: "Var. utilidad",
                  dataIndex: "variacion_utilidad",
                  align: "right",
                  render: (v: number | null) => <Variacion value={v} />,
                },
              ]}
            />
          </>
        )
      )}
    </>
  );
}
