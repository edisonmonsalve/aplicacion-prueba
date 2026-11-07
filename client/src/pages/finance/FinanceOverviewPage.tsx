import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { App, Card, Col, Row, Space, Statistic, Table, Tooltip, Typography, DatePicker, Alert, List } from "antd";
const { RangePicker } = DatePicker;
import { getFinanceSummary, getFinanceAccounts, getSuggestions } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import { money } from "./FinanceUtils";
import type { FinanceAccount, FinanceSummary, Suggestion } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function FinanceOverviewPage() {
  const { message } = App.useApp();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("month"),
    dayjs(),
  ]);

  useDocumentTitle("Finanzas");

  const load = async () => {
    setLoading(true);
    try {
      const desde = range[0].format("YYYY-MM-DD");
      const hasta = range[1].format("YYYY-MM-DD");
      const [s, a, sg] = await Promise.all([getFinanceSummary({ desde, hasta }), getFinanceAccounts(), getSuggestions()]);
      setSummary(s);
      setAccounts(a);
      setSuggestions(sg);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo cargar el resumen financiero"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const s = summary;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Resumen financiero</Typography.Title>
        <Space>
          <RangePicker
            value={range}
            onChange={(v) => v && setRange([v[0]!, v[1]!])}
            format="YYYY-MM-DD"
          />
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Ingresos" value={s?.ingresos ?? 0} formatter={(v) => money(Number(v))} valueStyle={{ color: "#52c41a" }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Egresos" value={s?.egresos ?? 0} formatter={(v) => money(Number(v))} valueStyle={{ color: "#ff4d4f" }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Utilidad" value={s?.utilidad ?? 0} formatter={(v) => money(Number(v))} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Saldo de caja y bancos (saldo inicial + ingresos - egresos)">Capital disponible</Tooltip>} value={s?.capital_disponible ?? 0} formatter={(v) => money(Number(v))} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Costo de ventas" value={s?.costo_ventas ?? 0} formatter={(v) => money(Number(v))} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Margen bruto" value={s?.margen_bruto ?? 0} formatter={(v) => money(Number(v))} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Margen bruto %" value={s?.margen_bruto_pct ?? 0} suffix="%" precision={0} />
          </Card>
        </Col>
      </Row>

      {suggestions.length > 0 && (
        <Card title="Sugerencias" style={{ marginBottom: 16 }}>
          <List
            dataSource={suggestions}
            renderItem={(s) => (
              <List.Item>
                <Alert
                  type={s.severidad === "danger" ? "error" : s.severidad === "warning" ? "warning" : "info"}
                  message={s.mensaje}
                  showIcon
                  style={{ width: "100%" }}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
      <Card title="Cuentas" style={{ marginBottom: 16 }}>
        <Table<FinanceAccount>
          rowKey="id"
          dataSource={accounts}
          pagination={false}
          columns={[
            { title: "Cuenta", dataIndex: "nombre" },
            { title: "Tipo", dataIndex: "tipo" },
            { title: "Saldo inicial", dataIndex: "saldo_inicial", align: "right", render: (v: number) => money(v) },
            { title: "Ingresos", dataIndex: "ingresos", align: "right", render: (v: number) => money(v) },
            { title: "Egresos", dataIndex: "egresos", align: "right", render: (v: number) => money(v) },
            { title: "Saldo actual", dataIndex: "saldo_actual", align: "right", render: (v: number) => money(v) },
          ]}
        />
      </Card>

      <Card title="Por categoría">
        <Table
          rowKey="id"
          dataSource={s?.por_categoria ?? []}
          pagination={false}
          columns={[
            { title: "Categoría", dataIndex: "nombre" },
            { title: "Tipo", dataIndex: "tipo", render: (t: string) => (t === "ingreso" ? "Ingreso" : "Gasto") },
            { title: "Total", dataIndex: "total", align: "right", render: (v: number) => money(v) },
          ]}
        />
      </Card>
    </div>
  );
}
