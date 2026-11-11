import { useEffect, useState } from "react";
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
import dayjs from "dayjs";
import { getBalance } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import PageHeader from "@/components/PageHeader";
import TableSkeleton from "@/components/TableSkeleton";
import type { BalanceCuenta, BalanceReport } from "@/types";
import { fmtDate, money } from "./FinanceUtils";

const FMT = "YYYY-MM-DD";

interface BalanceRow {
  key: string;
  concepto: string;
  valor: number;
  /** Detalle opcional bajo el concepto. */
  detalle?: string;
  total?: boolean;
}

export default function BalancePage() {
  const { message } = App.useApp();
  const { get, update } = useUrlFilters();
  const [report, setReport] = useState<BalanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  const [asOf, setAsOf] = useState<dayjs.Dayjs>(() => {
    const raw = get("hasta");
    return raw && dayjs(raw).isValid() ? dayjs(raw) : dayjs();
  });

  useDocumentTitle("Balance");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBalance({ hasta: asOf.format(FMT) })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar el balance")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, message]);

  const activoRows: BalanceRow[] = report
    ? [
        {
          key: "caja",
          concepto: "Caja y bancos",
          valor: report.activo.caja_bancos,
          detalle: `${report.activo.cuentas.length} cuenta(s)`,
        },
        {
          key: "inventario",
          concepto: "Inventario",
          valor: report.activo.inventario,
          detalle: `${report.activo.inventario_detalle.productos} producto(s) con stock${
            report.activo.inventario_detalle.sin_costo > 0
              ? ` · ${report.activo.inventario_detalle.sin_costo} sin costo`
              : ""
          }`,
        },
        {
          key: "cartera-cobrar",
          concepto: "Cartera por cobrar",
          valor: report.activo.cartera_por_cobrar,
          detalle: `${report.activo.cartera_detalle.facturas} factura(s)`,
        },
        {
          key: "iva-favor",
          concepto: "IVA a favor",
          valor: report.activo.iva_a_favor,
        },
        {
          key: "ret-favor",
          concepto: "Retenciones a favor",
          valor: report.activo.retenciones_a_favor,
        },
        {
          key: "total-activo",
          concepto: "Total activo",
          valor: report.activo.total,
          total: true,
        },
      ]
    : [];

  const pasivoRows: BalanceRow[] = report
    ? [
        {
          key: "cartera-pagar",
          concepto: "Cartera por pagar",
          valor: report.pasivo.cartera_por_pagar,
          detalle: `${report.pasivo.cartera_detalle.facturas} factura(s)`,
        },
        {
          key: "iva-pagar",
          concepto: "IVA por pagar",
          valor: report.pasivo.iva_por_pagar,
        },
        {
          key: "ret-pagar",
          concepto: "Retenciones por pagar",
          valor: report.pasivo.retenciones_por_pagar,
        },
        {
          key: "total-pasivo",
          concepto: "Total pasivo",
          valor: report.pasivo.total,
          total: true,
        },
        {
          key: "patrimonio",
          concepto: "Patrimonio",
          valor: report.patrimonio,
          detalle: "Capital + resultados acumulados",
          total: true,
        },
        {
          key: "total-pasivo-patrimonio",
          concepto: "Pasivo + patrimonio",
          valor: report.ecuacion.pasivo_mas_patrimonio,
          total: true,
        },
      ]
    : [];

  const rowRender = (r: BalanceRow) => (
    <>
      <Typography.Text strong={r.total}>{r.concepto}</Typography.Text>
      {r.detalle && (
        <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
          {r.detalle}
        </Typography.Text>
      )}
    </>
  );

  const columns = [
    {
      title: "Concepto",
      dataIndex: "concepto",
      render: (_: string, r: BalanceRow) => rowRender(r),
    },
    {
      title: "Valor",
      dataIndex: "valor",
      align: "right" as const,
      render: (v: number) => <span style={{ fontWeight: 500 }}>{money(v)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Balance simplificado"
        description="Foto del activo, pasivo y patrimonio a una fecha. La caja, la cartera y los impuestos se cortan a la fecha; el inventario se valora con las existencias y el costo actual."
        extra={
          <Space>
            <Typography.Text type="secondary">Al</Typography.Text>
            <DatePicker
              format="DD/MM/YYYY"
              allowClear={false}
              value={asOf}
              onChange={(d) => {
                if (!d) return;
                setAsOf(d);
                update({ hasta: d.format(FMT) });
              }}
            />
          </Space>
        }
      />

      {report && (
        <Alert
          type={report.ecuacion.cuadra ? "success" : "error"}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            report.ecuacion.cuadra
              ? "El balance cuadra: activo = pasivo + patrimonio"
              : "El balance no cuadra"
          }
          description={`Al ${fmtDate(report.as_of)} · Activo ${money(
            report.ecuacion.activo
          )} = Pasivo + patrimonio ${money(report.ecuacion.pasivo_mas_patrimonio)}`}
        />
      )}

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        report && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Activo"
                    value={report.activo.total}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: "#1677ff" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Pasivo"
                    value={report.pasivo.total}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: "#d46b08" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Patrimonio"
                    value={report.patrimonio}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: report.patrimonio < 0 ? "#cf1322" : "#389e0d" }}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}>
                <Card size="small" title="Activo">
                  <Table<BalanceRow>
                    rowKey="key"
                    pagination={false}
                    dataSource={activoRows}
                    columns={columns}
                    showHeader={false}
                  />
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card size="small" title="Pasivo y patrimonio">
                  <Table<BalanceRow>
                    rowKey="key"
                    pagination={false}
                    dataSource={pasivoRows}
                    columns={columns}
                    showHeader={false}
                  />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Cuentas de caja y bancos" style={{ marginTop: 16 }}>
              <Table<BalanceCuenta>
                rowKey="id"
                pagination={false}
                dataSource={report.activo.cuentas}
                scroll={{ x: "max-content" }}
                columns={[
                  {
                    title: "Cuenta",
                    dataIndex: "nombre",
                    render: (nombre: string, c) => (
                      <span>
                        {nombre} {c.activo ? null : <Tag>Inactiva</Tag>}
                      </span>
                    ),
                  },
                  {
                    title: "Tipo",
                    dataIndex: "tipo",
                    render: (tipo: string) => (
                      <Tag color={tipo === "banco" ? "blue" : "default"}>
                        {tipo === "banco" ? "Banco" : tipo === "caja" ? "Caja" : tipo}
                      </Tag>
                    ),
                  },
                  {
                    title: "Saldo",
                    dataIndex: "saldo",
                    align: "right",
                    render: (v: number) => money(v),
                  },
                ]}
              />
            </Card>
          </>
        )
      )}
    </>
  );
}
