import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Typography,
} from "antd";
import { getPnl } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDateRange } from "@/hooks/useDateRange";
import PageHeader from "@/components/PageHeader";
import PeriodRangePicker from "@/components/PeriodRangePicker";
import ReportExport from "@/components/ReportExport";
import TableSkeleton from "@/components/TableSkeleton";
import type { PnlReport } from "@/types";
import { exportReportCsv, printReport, type ReportDocument } from "@/utils/reportExport";
import { fmtDate, money } from "./FinanceUtils";

type RowTipo = "section" | "line" | "subtotal";

interface PnlRow {
  key: string;
  concepto: string;
  actual: number;
  /** Participación sobre los ingresos del periodo. */
  pct: number | null;
  anterior: number | null;
  variacion: number | null;
  tipo: RowTipo;
  /** Los aumentos de gasto/costo se pintan como negativos. */
  gasto?: boolean;
}

const pctOf = (value: number, base: number) =>
  base > 0 ? Math.round((value / base) * 1000) / 10 : 0;

function buildRows(r: PnlReport): PnlRow[] {
  const rows: PnlRow[] = [
    {
      key: "ingresos",
      concepto: "Ingresos",
      actual: r.ingresos.total,
      pct: r.ingresos.total > 0 ? 100 : 0,
      anterior: r.comparativo_totales.ingresos,
      variacion: r.variaciones.ingresos,
      tipo: "section",
    },
    ...r.ingresos.lineas.map((l) => ({
      key: `ingreso-${l.id}`,
      concepto: l.nombre,
      actual: l.total,
      pct: l.pct,
      anterior: l.anterior,
      variacion: l.variacion,
      tipo: "line" as const,
      gasto: false,
    })),
    {
      key: "costo-ventas",
      concepto: "Costo de ventas",
      actual: r.costo_ventas.total,
      pct: r.costo_ventas.pct,
      anterior: r.comparativo_totales.costo_ventas,
      variacion: r.variaciones.costo_ventas,
      tipo: "section",
      gasto: true,
    },
    // Normalmente hay una sola categoría de costo; si hay más, se detallan.
    ...(r.costo_ventas.lineas.length > 1
      ? r.costo_ventas.lineas.map((l) => ({
          key: `costo-${l.id}`,
          concepto: l.nombre,
          actual: l.total,
          pct: l.pct,
          anterior: l.anterior,
          variacion: l.variacion,
          tipo: "line" as const,
          gasto: true,
        }))
      : []),
    {
      key: "margen-bruto",
      concepto: "Margen bruto",
      actual: r.margen_bruto,
      pct: r.margen_bruto_pct,
      anterior: r.comparativo_totales.margen_bruto,
      variacion: r.variaciones.margen_bruto,
      tipo: "subtotal",
    },
    {
      key: "gastos",
      concepto: "Gastos operativos",
      actual: r.gastos.total,
      pct: pctOf(r.gastos.total, r.ingresos.total),
      anterior: r.comparativo_totales.gastos,
      variacion: r.variaciones.gastos,
      tipo: "section",
      gasto: true,
    },
    ...r.gastos.lineas.map((l) => ({
      key: `gasto-${l.id}`,
      concepto: l.nombre,
      actual: l.total,
      pct: l.pct,
      anterior: l.anterior,
      variacion: l.variacion,
      tipo: "line" as const,
      gasto: true,
    })),
    {
      key: "utilidad",
      concepto: "Utilidad",
      actual: r.utilidad,
      pct: r.utilidad_pct,
      anterior: r.comparativo_totales.utilidad,
      variacion: r.variaciones.utilidad,
      tipo: "subtotal",
    },
  ];
  return rows;
}

function buildReportDoc(r: PnlReport): ReportDocument {
  const rows = buildRows(r);
  return {
    title: "Estado de resultados",
    subtitle: `Periodo: ${fmtDate(r.rango.desde)} — ${fmtDate(
      r.rango.hasta
    )} (${r.rango.dias} días) · Comparado con ${fmtDate(r.comparativo.desde)} — ${fmtDate(
      r.comparativo.hasta
    )}`,
    meta: [
      { label: "Ingresos", value: money(r.ingresos.total) },
      { label: "Margen bruto", value: `${money(r.margen_bruto)} (${r.margen_bruto_pct.toFixed(1)} %)` },
      { label: "Gastos operativos", value: money(r.gastos.total) },
      { label: "Utilidad", value: `${money(r.utilidad)} (${r.utilidad_pct.toFixed(1)} %)` },
    ],
    sections: [
      {
        columns: [
          { header: "Concepto" },
          { header: "Periodo", format: "money" },
          { header: "% ingresos", format: "percent" },
          { header: "Periodo anterior", format: "money" },
          { header: "Variación", format: "percent" },
        ],
        rows: rows.map((row) => [
          row.tipo === "line" ? `  ${row.concepto}` : row.concepto,
          row.actual,
          row.pct,
          row.anterior,
          row.variacion,
        ]),
        note: "La variación se calcula contra el periodo anterior de igual duración.",
      },
    ],
  };
}

function Variation({ value, gasto }: { value: number | null; gasto?: boolean }) {
  if (value === null) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }
  const positive = value >= 0;
  // En ingresos/utilidad una subida es buena; en costos y gastos, mala.
  const good = gasto ? !positive : positive;
  const color = value === 0 ? undefined : good ? "#389e0d" : "#cf1322";
  return (
    <Typography.Text style={{ color }}>
      {positive ? "+" : ""}
      {value.toFixed(1)} %
    </Typography.Text>
  );
}

export default function ProfitLossPage() {
  const { message } = App.useApp();
  const [report, setReport] = useState<PnlReport | null>(null);
  const [loading, setLoading] = useState(true);
  const {
    range,
    periodo,
    desde,
    hasta,
    changeRange,
    selectPeriodo,
    shiftPeriodo,
    enPeriodoActual,
  } = useDateRange();

  useDocumentTitle("Estado de resultados");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPnl({ desde, hasta })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar el estado de resultados")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [desde, hasta, message]);

  const rows = report ? buildRows(report) : [];
  const sinMovimiento =
    report &&
    report.ingresos.total === 0 &&
    report.costo_ventas.total === 0 &&
    report.gastos.total === 0;

  const exportCsv = () => {
    if (!report) return;
    exportReportCsv(
      `estado-resultados-${report.rango.desde}-a-${report.rango.hasta}.csv`,
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
        title="Estado de resultados"
        description="Resultado por devengo: incluye ventas a crédito y excluye cobros de cartera, que solo mueven caja. Comparado con el periodo anterior de igual duración."
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <PeriodRangePicker
          range={range}
          periodo={periodo}
          onChange={changeRange}
          onSelectPeriodo={selectPeriodo}
          onShift={shiftPeriodo}
          enPeriodoActual={enPeriodoActual}
          extra={<ReportExport disabled={!report} onCsv={exportCsv} onPdf={exportPdf} />}
        />
      </Card>

      {report && (
        <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
          Periodo: {fmtDate(report.rango.desde)} — {fmtDate(report.rango.hasta)} (
          {report.rango.dias} días) · Comparado con {fmtDate(report.comparativo.desde)} —{" "}
          {fmtDate(report.comparativo.hasta)}
        </Typography.Paragraph>
      )}

      {sinMovimiento && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sin movimientos de resultado en el periodo"
          description="Registra transacciones o confirma facturas para ver el estado de resultados."
        />
      )}

      {report && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="Ingresos"
                value={report.ingresos.total}
                precision={2}
                prefix="$"
                valueStyle={{ color: "#1677ff" }}
              />
              <Variation value={report.variaciones.ingresos} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="Margen bruto"
                value={report.margen_bruto}
                precision={2}
                prefix="$"
                suffix={<span style={{ fontSize: 13 }}>{report.margen_bruto_pct.toFixed(1)} %</span>}
                valueStyle={{ color: "#389e0d" }}
              />
              <Variation value={report.variaciones.margen_bruto} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="Gastos operativos"
                value={report.gastos.total}
                precision={2}
                prefix="$"
                valueStyle={{ color: "#d46b08" }}
              />
              <Variation value={report.variaciones.gastos} gasto />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card size="small">
              <Statistic
                title="Utilidad"
                value={report.utilidad}
                precision={2}
                prefix="$"
                suffix={<span style={{ fontSize: 13 }}>{report.utilidad_pct.toFixed(1)} %</span>}
                valueStyle={{ color: report.utilidad < 0 ? "#cf1322" : "#389e0d" }}
              />
              <Variation value={report.variaciones.utilidad} />
            </Card>
          </Col>
        </Row>
      )}

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        <Table<PnlRow>
          rowKey="key"
          loading={loading}
          dataSource={rows}
          pagination={false}
          scroll={{ x: "max-content" }}
          rowClassName={(r) =>
            r.tipo === "subtotal"
              ? "pnl-subtotal"
              : r.tipo === "section"
                ? "pnl-section"
                : "pnl-line"
          }
          columns={[
            {
              title: "Concepto",
              dataIndex: "concepto",
              render: (texto: string, r) => {
                if (r.tipo === "line") {
                  return (
                    <span style={{ paddingLeft: 20, color: "#666" }}>{texto}</span>
                  );
                }
                return <strong>{texto}</strong>;
              },
            },
            {
              title: "Periodo",
              dataIndex: "actual",
              align: "right",
              render: (v: number) => money(v),
            },
            {
              title: "% ingresos",
              dataIndex: "pct",
              align: "right",
              render: (v: number | null) =>
                v === null ? "—" : `${v.toFixed(1)} %`,
            },
            {
              title: "Periodo anterior",
              dataIndex: "anterior",
              align: "right",
              render: (v: number | null) => (v === null ? "—" : money(v)),
            },
            {
              title: "Variación",
              dataIndex: "variacion",
              align: "right",
              render: (v: number | null, r) => <Variation value={v} gasto={r.gasto} />,
            },
          ]}
        />
      )}

      <style>{`
        .pnl-section td { border-top: 1px solid #f0f0f0; }
        .pnl-subtotal td { background: #fafafa; }
      `}</style>
    </>
  );
}
