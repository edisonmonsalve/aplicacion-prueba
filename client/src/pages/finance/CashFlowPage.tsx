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
import { getCashFlow, getFinanceAccounts } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import PageHeader from "@/components/PageHeader";
import ReportExport from "@/components/ReportExport";
import TableSkeleton from "@/components/TableSkeleton";
import type { CashFlowAccountRow, CashFlowMonth, CashFlowReport, FinanceAccount } from "@/types";
import { exportReportCsv, printReport, type ReportDocument } from "@/utils/reportExport";
import { fmtDate, money } from "./FinanceUtils";

const FMT = "YYYY-MM-DD";

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const mesLabel = (mes: string) => {
  const [anio, numero] = mes.split("-");
  return `${MESES[Number(numero) - 1] ?? numero} ${anio}`;
};

const Neto = ({ value }: { value: number }) => (
  <Typography.Text type={value < 0 ? "danger" : value > 0 ? "success" : undefined}>
    {money(value)}
  </Typography.Text>
);

const TipoCuenta = ({ tipo }: { tipo: string }) => (
  <Tag color={tipo === "banco" ? "blue" : "default"}>
    {tipo === "banco" ? "Banco" : tipo === "caja" ? "Caja" : tipo}
  </Tag>
);

const tipoLabel = (tipo: string) =>
  tipo === "banco" ? "Banco" : tipo === "caja" ? "Caja" : tipo;

function buildReportDoc(r: CashFlowReport, cuentas: FinanceAccount[]): ReportDocument {
  const filtro = r.filtro_cuenta
    ? cuentas.find((c) => c.id === r.filtro_cuenta)?.nombre ?? `Cuenta #${r.filtro_cuenta}`
    : null;

  return {
    title: "Flujo de caja",
    subtitle: `Periodo: ${fmtDate(r.rango.desde)} — ${fmtDate(r.rango.hasta)}${
      filtro ? ` · Cuenta: ${filtro}` : " · Todas las cuentas"
    }`,
    meta: [
      { label: "Saldo inicial", value: money(r.totales.saldo_inicial) },
      { label: "Entradas", value: money(r.totales.entradas) },
      { label: "Salidas", value: money(r.totales.salidas) },
      { label: "Neto", value: money(r.totales.neto) },
      { label: "Saldo final", value: money(r.totales.saldo_final) },
    ],
    sections: [
      {
        title: "Por cuenta",
        columns: [
          { header: "Cuenta" },
          { header: "Tipo" },
          { header: "Saldo inicial", format: "money" },
          { header: "Entradas", format: "money" },
          { header: "Salidas", format: "money" },
          { header: "Neto", format: "money" },
          { header: "Saldo final", format: "money" },
        ],
        rows: r.por_cuenta.map((c) => [
          c.activo ? c.nombre : `${c.nombre} (inactiva)`,
          tipoLabel(c.tipo),
          c.saldo_inicial,
          c.entradas,
          c.salidas,
          c.neto,
          c.saldo_final,
        ]),
      },
      {
        title: "Por mes",
        columns: [
          { header: "Mes" },
          { header: "Entradas", format: "money" },
          { header: "Salidas", format: "money" },
          { header: "Neto", format: "money" },
        ],
        rows: r.por_mes.map((m) => [mesLabel(m.mes), m.entradas, m.salidas, m.neto]),
      },
    ],
  };
}

export default function CashFlowPage() {
  const { message } = App.useApp();
  const { get, getPositiveInt, update } = useUrlFilters();
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = getPositiveInt("account_id", 0) || undefined;
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const inicial = get("desde");
    const final = get("hasta");
    return [
      inicial && dayjs(inicial).isValid() ? dayjs(inicial) : dayjs().startOf("month"),
      final && dayjs(final).isValid() ? dayjs(final) : dayjs(),
    ];
  });

  useDocumentTitle("Flujo de caja");

  useEffect(() => {
    getFinanceAccounts()
      .then(setAccounts)
      .catch(() => message.error("No se pudieron cargar las cuentas"));
  }, [message]);

  const changeRange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!value || !value[0] || !value[1]) return;
    const next: [dayjs.Dayjs, dayjs.Dayjs] = [value[0], value[1]];
    setRange(next);
    update({ desde: next[0].format(FMT), hasta: next[1].format(FMT) });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCashFlow({
      desde: range[0].format(FMT),
      hasta: range[1].format(FMT),
      account_id: accountId,
    })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar el flujo de caja")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, accountId, message]);

  const sinMovimiento =
    report && report.totales.entradas === 0 && report.totales.salidas === 0;

  const exportCsv = () => {
    if (!report) return;
    exportReportCsv(
      `flujo-caja-${report.rango.desde}-a-${report.rango.hasta}.csv`,
      buildReportDoc(report, accounts)
    );
  };

  const exportPdf = (target?: Window | null) => {
    if (!report) return;
    printReport(buildReportDoc(report, accounts), target);
  };

  return (
    <>
      <PageHeader
        title="Flujo de caja"
        description="Entradas y salidas reales de dinero por cuenta y por mes. Solo incluye asientos que mueven caja; el costo de ventas y el IVA informativos no aparecen."
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

      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
          Cuenta
        </Typography.Text>
        <Select
          allowClear
          placeholder="Todas las cuentas"
          style={{ width: "100%" }}
          value={accountId}
          onChange={(v) => update({ account_id: v })}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.nombre}${a.activo ? "" : " (inactiva)"}`,
          }))}
        />
      </div>

      {sinMovimiento && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sin movimientos de caja en el periodo"
          description="Registra transacciones, cobros o pagos para ver el flujo."
        />
      )}

      {report && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Saldo inicial"
                  value={report.totales.saldo_inicial}
                  precision={2}
                  prefix="$"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Entradas"
                  value={report.totales.entradas}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#389e0d" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Salidas"
                  value={report.totales.salidas}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#cf1322" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card size="small">
                <Statistic
                  title="Saldo final"
                  value={report.totales.saldo_final}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: report.totales.saldo_final < 0 ? "#cf1322" : "#1677ff" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Neto del periodo: <Neto value={report.totales.neto} />
                </Typography.Text>
              </Card>
            </Col>
          </Row>

          <Typography.Paragraph type="secondary">
            Periodo: {fmtDate(report.rango.desde)} — {fmtDate(report.rango.hasta)}
            {report.filtro_cuenta ? " · Filtrado por cuenta" : ""}
          </Typography.Paragraph>
        </>
      )}

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        <>
          <Card size="small" title="Por cuenta" style={{ marginBottom: 16 }}>
            <Table<CashFlowAccountRow>
              rowKey="id"
              loading={loading}
              dataSource={report?.por_cuenta ?? []}
              pagination={false}
              scroll={{ x: "max-content" }}
              columns={[
                {
                  title: "Cuenta",
                  dataIndex: "nombre",
                  render: (nombre: string, r) => (
                    <span>
                      {nombre} {r.activo ? null : <Tag>Inactiva</Tag>}
                    </span>
                  ),
                },
                {
                  title: "Tipo",
                  dataIndex: "tipo",
                  render: (tipo: string) => <TipoCuenta tipo={tipo} />,
                },
                {
                  title: "Saldo inicial",
                  dataIndex: "saldo_inicial",
                  align: "right",
                  render: (v: number) => money(v),
                },
                {
                  title: "Entradas",
                  dataIndex: "entradas",
                  align: "right",
                  render: (v: number) => <Typography.Text type="success">{money(v)}</Typography.Text>,
                },
                {
                  title: "Salidas",
                  dataIndex: "salidas",
                  align: "right",
                  render: (v: number) => <Typography.Text type="danger">{money(v)}</Typography.Text>,
                },
                {
                  title: "Neto",
                  dataIndex: "neto",
                  align: "right",
                  render: (v: number) => <Neto value={v} />,
                },
                {
                  title: "Saldo final",
                  dataIndex: "saldo_final",
                  align: "right",
                  render: (v: number) => <strong>{money(v)}</strong>,
                },
              ]}
            />
          </Card>

          <Card size="small" title="Por mes">
            <Table<CashFlowMonth>
              rowKey="mes"
              loading={loading}
              dataSource={report?.por_mes ?? []}
              pagination={false}
              scroll={{ x: "max-content" }}
              columns={[
                { title: "Mes", dataIndex: "mes", render: (mes: string) => mesLabel(mes) },
                {
                  title: "Entradas",
                  dataIndex: "entradas",
                  align: "right",
                  render: (v: number) => <Typography.Text type="success">{money(v)}</Typography.Text>,
                },
                {
                  title: "Salidas",
                  dataIndex: "salidas",
                  align: "right",
                  render: (v: number) => <Typography.Text type="danger">{money(v)}</Typography.Text>,
                },
                {
                  title: "Neto",
                  dataIndex: "neto",
                  align: "right",
                  render: (v: number) => <Neto value={v} />,
                },
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
}
