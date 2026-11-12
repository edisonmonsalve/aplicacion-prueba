import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { getInventoryAnalytics } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import PageHeader from "@/components/PageHeader";
import ReportExport from "@/components/ReportExport";
import TableSkeleton from "@/components/TableSkeleton";
import type {
  InventoryAbcClass,
  InventoryAbcGroup,
  InventoryAnalyticsReport,
  InventoryAnalyticsRow,
} from "@/types";
import { exportReportCsv, printReport, type ReportDocument } from "@/utils/reportExport";
import { fmtDate, money } from "./FinanceUtils";

const FMT = "YYYY-MM-DD";

const DIAS_MUERTO_OPTIONS = [30, 60, 90, 180, 365].map((dias) => ({
  value: dias,
  label: `${dias} días`,
}));

const ABC_META: Record<InventoryAbcClass, { color: string; label: string; hint: string }> = {
  A: { color: "green", label: "A", hint: "Hasta 80 % de los ingresos" },
  B: { color: "blue", label: "B", hint: "Entre 80 % y 95 %" },
  C: { color: "default", label: "C", hint: "Último 5 % o sin ventas" },
};

const Numero = ({ value, suffix }: { value: number | null; suffix?: string }) => {
  if (value === null) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <span>
      {value.toFixed(2)}
      {suffix ? ` ${suffix}` : ""}
    </span>
  );
};

function buildReportDoc(r: InventoryAnalyticsReport): ReportDocument {
  return {
    title: "Rotación de inventario",
    subtitle: `Periodo: ${fmtDate(r.rango.desde)} — ${fmtDate(r.rango.hasta)} (${
      r.rango.dias
    } días) · Stock muerto sin ventas en ${r.rango.dias_muerto} días`,
    meta: [
      { label: "Valor del inventario", value: money(r.resumen.valor_inventario) },
      {
        label: "Rotación del periodo",
        value: r.resumen.rotacion === null ? "—" : `${r.resumen.rotacion.toFixed(2)} veces`,
      },
      {
        label: "Días de inventario",
        value: r.resumen.dias_inventario === null ? "—" : `${r.resumen.dias_inventario.toFixed(2)} días`,
      },
      {
        label: "Productos vendidos",
        value: `${r.resumen.productos_vendidos} de ${r.resumen.productos}`,
      },
      {
        label: "Stock muerto",
        value: `${r.resumen.stock_muerto.productos} producto(s) · ${money(r.resumen.stock_muerto.valor)}`,
      },
    ],
    sections: [
      {
        title: "Clasificación ABC por ingresos",
        columns: [
          { header: "Clase", align: "center" },
          { header: "Criterio" },
          { header: "Productos", format: "number" },
          { header: "Ingresos", format: "money" },
          { header: "Participación", format: "percent" },
        ],
        rows: r.resumen.abc.map((g) => [
          g.clase,
          ABC_META[g.clase].hint,
          g.productos,
          g.ingresos,
          g.participacion,
        ]),
      },
      {
        title: "Detalle por producto",
        columns: [
          { header: "Producto" },
          { header: "SKU" },
          { header: "Categoría" },
          { header: "ABC", align: "center" },
          { header: "Stock", format: "number" },
          { header: "Valor inventario", format: "money" },
          { header: "Unidades", format: "number" },
          { header: "Ingresos", format: "money" },
          { header: "Costo", format: "money" },
          { header: "Margen %", format: "percent" },
          { header: "Rotación", format: "number" },
          { header: "Días inv.", format: "number" },
          { header: "Última venta", format: "date" },
          { header: "Días sin venta", format: "number" },
          { header: "Estado" },
        ],
        rows: r.data.map((row) => [
          row.nombre,
          row.sku,
          row.categoria ?? "",
          row.clase_abc,
          row.stock_actual,
          row.valor_inventario,
          row.unidades_vendidas,
          row.ingresos,
          row.costo_ventas,
          row.margen_pct,
          row.rotacion,
          row.dias_inventario,
          row.ultima_venta,
          row.dias_sin_venta,
          [row.stock_muerto ? "Muerto" : "Con venta", row.sin_costo ? "Sin costo" : ""]
            .filter(Boolean)
            .join(" · "),
        ]),
        note: "La rotación usa el costo de ventas del periodo y el inventario actual valorizado al costo.",
      },
    ],
  };
}

export default function InventoryAnalyticsPage() {
  const { message } = App.useApp();
  const { get, getPositiveInt, update } = useUrlFilters();
  const [report, setReport] = useState<InventoryAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const diasMuerto = getPositiveInt("dias_muerto", 90);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const inicial = get("desde");
    const final = get("hasta");
    return [
      inicial && dayjs(inicial).isValid() ? dayjs(inicial) : dayjs().startOf("month"),
      final && dayjs(final).isValid() ? dayjs(final) : dayjs(),
    ];
  });

  useDocumentTitle("Rotación de inventario");

  const changeRange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!value || !value[0] || !value[1]) return;
    const next: [dayjs.Dayjs, dayjs.Dayjs] = [value[0], value[1]];
    setRange(next);
    update({ desde: next[0].format(FMT), hasta: next[1].format(FMT) });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInventoryAnalytics({
      desde: range[0].format(FMT),
      hasta: range[1].format(FMT),
      dias_muerto: diasMuerto,
    })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) =>
        message.error(getErrorMessage(err, "No se pudo cargar la rotación de inventario"))
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, diasMuerto, message]);

  const exportCsv = () => {
    if (!report) return;
    exportReportCsv(
      `rotacion-inventario-${report.rango.desde}-a-${report.rango.hasta}.csv`,
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
        title="Rotación de inventario"
        description="Rotación, días de inventario, stock muerto y clasificación ABC. La rotación usa el costo de ventas del periodo y el inventario actual valorizado al costo."
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

      <div style={{ marginBottom: 16, maxWidth: 260 }}>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
          Umbral de stock muerto
        </Typography.Text>
        <Select
          style={{ width: "100%" }}
          value={diasMuerto}
          options={DIAS_MUERTO_OPTIONS}
          onChange={(value) => update({ dias_muerto: value })}
        />
      </div>

      {report && report.resumen.stock_muerto.productos > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${report.resumen.stock_muerto.productos} producto(s) con stock muerto`}
          description={`${money(
            report.resumen.stock_muerto.valor
          )} inmovilizados sin ventas en ${report.rango.dias_muerto} días o más.`}
        />
      )}

      {report && report.resumen.sin_costo > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${report.resumen.sin_costo} producto(s) con stock y costo cero`}
          description="Su valor de inventario y su margen pueden estar subestimados. Define el costo del producto."
        />
      )}

      {report && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Valor del inventario"
                  value={report.resumen.valor_inventario}
                  precision={2}
                  prefix="$"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Rotación del periodo"
                  value={report.resumen.rotacion ?? 0}
                  precision={2}
                  suffix={report.resumen.rotacion === null ? "" : "veces"}
                  valueStyle={{ color: "#1677ff" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Costo de ventas {money(report.resumen.costo_ventas)}
                </Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Días de inventario"
                  value={report.resumen.dias_inventario ?? 0}
                  precision={report.resumen.dias_inventario === null ? 0 : 2}
                  suffix={report.resumen.dias_inventario === null ? "" : "días"}
                  valueStyle={{ color: "#d46b08" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Productos vendidos"
                  value={report.resumen.productos_vendidos}
                  suffix={`/ ${report.resumen.productos}`}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {report.resumen.productos - report.resumen.productos_vendidos} sin venta en el periodo
                </Typography.Text>
              </Card>
            </Col>
          </Row>

          <Typography.Paragraph type="secondary">
            Periodo: {fmtDate(report.rango.desde)} — {fmtDate(report.rango.hasta)} (
            {report.rango.dias} días) · Stock muerto si no hay ventas en {report.rango.dias_muerto}{" "}
            días.
          </Typography.Paragraph>
        </>
      )}

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        report && (
          <>
            <Card size="small" title="Clasificación ABC por ingresos" style={{ marginBottom: 16 }}>
              <Table<InventoryAbcGroup>
                rowKey="clase"
                pagination={false}
                dataSource={report.resumen.abc}
                columns={[
                  {
                    title: "Clase",
                    dataIndex: "clase",
                    render: (clase: InventoryAbcClass) => (
                      <Tag color={ABC_META[clase].color}>{ABC_META[clase].label}</Tag>
                    ),
                  },
                  {
                    title: "Criterio",
                    key: "criterio",
                    render: (_, r) => (
                      <Typography.Text type="secondary">{ABC_META[r.clase].hint}</Typography.Text>
                    ),
                  },
                  { title: "Productos", dataIndex: "productos", align: "right" },
                  {
                    title: "Ingresos",
                    dataIndex: "ingresos",
                    align: "right",
                    render: (v: number) => money(v),
                  },
                  {
                    title: "Participación",
                    dataIndex: "participacion",
                    align: "right",
                    render: (v: number) => `${v.toFixed(1)} %`,
                  },
                ]}
              />
            </Card>

            <Table<InventoryAnalyticsRow>
              rowKey="id"
              loading={loading}
              dataSource={report.data}
              scroll={{ x: "max-content" }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              columns={[
                {
                  title: "Producto",
                  dataIndex: "nombre",
                  render: (nombre: string, r) => (
                    <>
                      <strong>{nombre}</strong>
                      <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                        {[r.sku, r.categoria].filter(Boolean).join(" · ")}
                      </Typography.Text>
                    </>
                  ),
                },
                {
                  title: "ABC",
                  dataIndex: "clase_abc",
                  align: "center",
                  filters: (["A", "B", "C"] as InventoryAbcClass[]).map((clase) => ({
                    text: clase,
                    value: clase,
                  })),
                  onFilter: (value, r) => r.clase_abc === value,
                  render: (clase: InventoryAbcClass) => (
                    <Tag color={ABC_META[clase].color}>{ABC_META[clase].label}</Tag>
                  ),
                },
                {
                  title: "Stock",
                  dataIndex: "stock_actual",
                  align: "right",
                  sorter: (a, b) => a.stock_actual - b.stock_actual,
                },
                {
                  title: "Valor inventario",
                  dataIndex: "valor_inventario",
                  align: "right",
                  sorter: (a, b) => a.valor_inventario - b.valor_inventario,
                  render: (v: number) => money(v),
                },
                {
                  title: "Unidades",
                  dataIndex: "unidades_vendidas",
                  align: "right",
                  sorter: (a, b) => a.unidades_vendidas - b.unidades_vendidas,
                },
                {
                  title: "Ingresos",
                  dataIndex: "ingresos",
                  align: "right",
                  sorter: (a, b) => a.ingresos - b.ingresos,
                  render: (v: number) => money(v),
                },
                {
                  title: "Costo",
                  dataIndex: "costo_ventas",
                  align: "right",
                  sorter: (a, b) => a.costo_ventas - b.costo_ventas,
                  render: (v: number) => money(v),
                },
                {
                  title: "Margen %",
                  dataIndex: "margen_pct",
                  align: "right",
                  sorter: (a, b) => a.margen_pct - b.margen_pct,
                  render: (v: number) => (
                    <Tag color={v < 0 ? "red" : v >= 30 ? "green" : v >= 10 ? "gold" : "default"}>
                      {v.toFixed(1)} %
                    </Tag>
                  ),
                },
                {
                  title: "Rotación",
                  dataIndex: "rotacion",
                  align: "right",
                  sorter: (a, b) => (a.rotacion ?? -1) - (b.rotacion ?? -1),
                  render: (v: number | null) => <Numero value={v} suffix="x" />,
                },
                {
                  title: "Días inv.",
                  dataIndex: "dias_inventario",
                  align: "right",
                  sorter: (a, b) => (a.dias_inventario ?? -1) - (b.dias_inventario ?? -1),
                  render: (v: number | null) => <Numero value={v} />,
                },
                {
                  title: "Última venta",
                  dataIndex: "ultima_venta",
                  render: (v: string | null, r) =>
                    v ? (
                      <span>
                        {fmtDate(v)}
                        <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                          hace {r.dias_sin_venta} días
                        </Typography.Text>
                      </span>
                    ) : (
                      <Typography.Text type="secondary">Nunca</Typography.Text>
                    ),
                },
                {
                  title: "Estado",
                  key: "estado",
                  render: (_, r) => (
                    <>
                      {r.stock_muerto ? <Tag color="red">Muerto</Tag> : <Tag color="green">Con venta</Tag>}
                      {r.sin_costo && <Tag color="orange">Sin costo</Tag>}
                    </>
                  ),
                },
              ]}
            />
          </>
        )
      )}
    </>
  );
}
