import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Card,
  Col,
  DatePicker,
  Progress,
  Row,
  Segmented,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { getProfitability } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import PageHeader from "@/components/PageHeader";
import TableSkeleton from "@/components/TableSkeleton";
import type { ProfitabilityReport, ProfitabilityRow, ProfitGroup } from "@/types";
import { fmtDate, money } from "./FinanceUtils";

const FMT = "YYYY-MM-DD";

const GROUP_OPTIONS: { label: string; value: ProfitGroup }[] = [
  { label: "Producto", value: "producto" },
  { label: "Categoría", value: "categoria" },
  { label: "Cliente", value: "cliente" },
];

const isGroup = (value: string | undefined): value is ProfitGroup =>
  value === "producto" || value === "categoria" || value === "cliente";

const Margen = ({ value }: { value: number }) => (
  <Typography.Text type={value < 0 ? "danger" : value > 0 ? "success" : undefined}>
    {money(value)}
  </Typography.Text>
);

const MargenPct = ({ value }: { value: number }) => (
  <Tag color={value < 0 ? "red" : value >= 30 ? "green" : value >= 10 ? "gold" : "default"}>
    {value.toFixed(1)} %
  </Tag>
);

export default function ProfitabilityPage() {
  const { message } = App.useApp();
  const { get, update } = useUrlFilters();
  const [report, setReport] = useState<ProfitabilityReport | null>(null);
  const [loading, setLoading] = useState(true);

  const rawGroup = get("grupo");
  const grupo: ProfitGroup = isGroup(rawGroup) ? rawGroup : "producto";
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const inicial = get("desde");
    const final = get("hasta");
    return [
      inicial && dayjs(inicial).isValid() ? dayjs(inicial) : dayjs().startOf("month"),
      final && dayjs(final).isValid() ? dayjs(final) : dayjs(),
    ];
  });

  useDocumentTitle("Rentabilidad");

  const changeRange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!value || !value[0] || !value[1]) return;
    const next: [dayjs.Dayjs, dayjs.Dayjs] = [value[0], value[1]];
    setRange(next);
    update({ desde: next[0].format(FMT), hasta: next[1].format(FMT) });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProfitability({
      desde: range[0].format(FMT),
      hasta: range[1].format(FMT),
      grupo,
    })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar la rentabilidad")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, grupo, message]);

  const sinDatos = report && report.data.length === 0;

  return (
    <>
      <PageHeader
        title="Rentabilidad"
        description="Ingresos y costo de ventas por producto, categoría o cliente. Usa el costo histórico del momento de la venta y solo cuenta facturas confirmadas."
        extra={
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            value={range}
            onChange={changeRange}
            allowClear={false}
          />
        }
      />

      <div style={{ marginBottom: 16, overflowX: "auto" }}>
        <Segmented
          options={GROUP_OPTIONS}
          value={grupo}
          onChange={(value) => update({ grupo: String(value) })}
        />
      </div>

      {sinDatos && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sin ventas confirmadas en el periodo"
          description="Confirma facturas de venta para ver su margen por producto, categoría o cliente."
        />
      )}

      {report && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Ingresos"
                  value={report.resumen.ingresos}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#1677ff" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Costo de ventas"
                  value={report.resumen.costo}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#d46b08" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Margen bruto"
                  value={report.resumen.margen}
                  precision={2}
                  prefix="$"
                  suffix={
                    <span style={{ fontSize: 13 }}>{report.resumen.margen_pct.toFixed(1)} %</span>
                  }
                  valueStyle={{ color: report.resumen.margen < 0 ? "#cf1322" : "#389e0d" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic title="Unidades vendidas" value={report.resumen.unidades} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {report.resumen.facturas} factura(s) en el periodo
                </Typography.Text>
              </Card>
            </Col>
          </Row>

          <Typography.Paragraph type="secondary">
            Periodo: {fmtDate(report.rango.desde)} — {fmtDate(report.rango.hasta)} · Agrupado por{" "}
            {GROUP_OPTIONS.find((g) => g.value === report.grupo)?.label.toLowerCase()}
          </Typography.Paragraph>
        </>
      )}

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        <Table<ProfitabilityRow>
          rowKey="key"
          loading={loading}
          dataSource={report?.data ?? []}
          pagination={false}
          scroll={{ x: "max-content" }}
          columns={[
            {
              title:
                grupo === "producto"
                  ? "Producto"
                  : grupo === "categoria"
                    ? "Categoría"
                    : "Cliente",
              dataIndex: "nombre",
              render: (nombre: string, r) => (
                <>
                  <strong>{nombre}</strong>
                  {grupo === "producto" && (r.sku || r.categoria) && (
                    <Typography.Text
                      type="secondary"
                      style={{ display: "block", fontSize: 12 }}
                    >
                      {[r.sku, r.categoria].filter(Boolean).join(" · ")}
                    </Typography.Text>
                  )}
                </>
              ),
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
              dataIndex: "costo",
              align: "right",
              sorter: (a, b) => a.costo - b.costo,
              render: (v: number) => money(v),
            },
            {
              title: "Margen",
              dataIndex: "margen",
              align: "right",
              sorter: (a, b) => a.margen - b.margen,
              defaultSortOrder: "descend",
              render: (v: number) => <strong><Margen value={v} /></strong>,
            },
            {
              title: "Margen %",
              dataIndex: "margen_pct",
              align: "right",
              sorter: (a, b) => a.margen_pct - b.margen_pct,
              render: (v: number) => <MargenPct value={v} />,
            },
            {
              title: "Participación",
              dataIndex: "participacion",
              align: "right",
              width: 160,
              sorter: (a, b) => a.participacion - b.participacion,
              render: (v: number) => (
                <Progress
                  percent={Math.min(Math.max(v, 0), 100)}
                  size="small"
                  format={() => `${v.toFixed(1)} %`}
                />
              ),
            },
            {
              title: "Unidades",
              dataIndex: "unidades",
              align: "right",
              sorter: (a, b) => a.unidades - b.unidades,
            },
            {
              title: "Facturas",
              dataIndex: "facturas",
              align: "right",
              sorter: (a, b) => a.facturas - b.facturas,
            },
          ]}
        />
      )}
    </>
  );
}
