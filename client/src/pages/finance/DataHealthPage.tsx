import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { CheckCircleOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getDataHealth } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import PageHeader from "@/components/PageHeader";
import TableSkeleton from "@/components/TableSkeleton";
import type { DataHealthCheck, DataHealthReport } from "@/types";

const COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  sku: "SKU",
  nombre: "Nombre",
  stock_actual: "Stock",
  costo: "Costo",
  fecha: "Fecha",
  monto: "Monto",
  tipo: "Tipo",
  invoice_id: "Factura ID",
  factura: "Factura",
  estado_factura: "Estado factura",
  transaction_id: "Asiento",
};

const cellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const DetailTable = ({ check }: { check: DataHealthCheck }) => {
  if (check.detalle.length === 0) return null;
  const first = check.detalle[0];
  const keys = Object.keys(first);
  return (
    <Table<Record<string, unknown>>
      rowKey="id"
      size="small"
      dataSource={check.detalle}
      pagination={{ pageSize: 5, showSizeChanger: false, hideOnSinglePage: true }}
      scroll={{ x: "max-content" }}
      columns={keys.map((key) => ({
        title: COLUMN_LABELS[key] ?? key,
        dataIndex: key,
        render: (value: unknown) => cellValue(value),
      }))}
    />
  );
};

export default function DataHealthPage() {
  const { message } = App.useApp();
  const [report, setReport] = useState<DataHealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle("Salud de datos");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    getDataHealth()
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar la salud de datos")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [message]);

  useEffect(() => load(), [load]);

  return (
    <>
      <PageHeader
        title="Salud de datos"
        description="Comprobaciones de solo lectura sobre invariantes contables y de inventario: asientos y pagos huérfanos, stock negativo y productos sin costo."
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Actualizar
          </Button>
        }
      />

      {loading && !report ? (
        <TableSkeleton />
      ) : (
        report && (
          <>
            <Alert
              type={report.estado === "ok" ? "success" : "warning"}
              showIcon
              icon={report.estado === "ok" ? <CheckCircleOutlined /> : <WarningOutlined />}
              style={{ marginBottom: 16 }}
              message={
                report.estado === "ok"
                  ? "Sin problemas detectados"
                  : `${report.resumen.total_hallazgos} hallazgo(s) en ${report.resumen.con_problemas} comprobación(es)`
              }
              description={`Generado ${dayjs(report.generado_at).format(
                "DD/MM/YYYY HH:mm"
              )}. Este panel informa, no corrige datos.`}
            />

            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic title="Comprobaciones" value={report.resumen.checks} />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Con problemas"
                    value={report.resumen.con_problemas}
                    valueStyle={{
                      color: report.resumen.con_problemas > 0 ? "#cf1322" : "#389e0d",
                    }}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Hallazgos"
                    value={report.resumen.total_hallazgos}
                    valueStyle={{
                      color: report.resumen.total_hallazgos > 0 ? "#d46b08" : "#389e0d",
                    }}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Estado"
                    value={report.estado === "ok" ? "Sano" : "Alerta"}
                    valueStyle={{ color: report.estado === "ok" ? "#389e0d" : "#cf1322" }}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              {report.checks.map((check) => (
                <Col xs={24} xl={12} key={check.codigo}>
                  <Card
                    size="small"
                    title={
                      <span>
                        {check.titulo}{" "}
                        <Tag color={check.hallazgos > 0 ? "red" : "green"}>
                          {check.hallazgos > 0 ? `${check.hallazgos} hallazgo(s)` : "OK"}
                        </Tag>
                        <Tag color={check.severidad === "alta" ? "volcano" : "gold"}>
                          {check.severidad === "alta" ? "Alta" : "Media"}
                        </Tag>
                      </span>
                    }
                  >
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                      {check.descripcion}
                    </Typography.Paragraph>
                    {check.hallazgos === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Sin hallazgos"
                        style={{ margin: "8px 0" }}
                      />
                    ) : (
                      <DetailTable check={check} />
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )
      )}
    </>
  );
}
