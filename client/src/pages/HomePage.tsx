import { useEffect, useMemo, useState } from "react";
import { Alert, App, Card, Col, Empty, Row, Skeleton, Statistic, Table, Tag, Tooltip as AntTooltip, Typography, theme } from "antd";
import { AppstoreOutlined, DollarOutlined, SwapOutlined, WarningOutlined } from "@ant-design/icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { getDashboard } from "@/services/dashboardService";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency } from "@/utils/format";
import { STATUS_OPTIONS } from "@/pages/quotes/QuoteUtils";
import type { Dashboard } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const HOME_TOOLTIPS: Record<string, string> = {
  "Productos activos": "Productos activos en el catálogo",
  "Con stock bajo": "Productos cuyo stock está por debajo del mínimo",
  "Movimientos hoy": "Movimientos de stock registrados hoy",
  "Valor del inventario": "Suma del precio × stock actual de los productos activos",
};

const ESTADO_COLOR: Record<string, string> = {
  borrador: "#8c8c8c",
  enviado: "#1677ff",
  aprobado: "#52c41a",
  rechazado: "#ff4d4f",
  entregado: "#722ed1",
  vencido: "#fa8c16",
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

export default function HomePage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle("Inicio");

  useEffect(() => {
    let ignore = false;
    getDashboard()
      .then((res) => !ignore && setData(res))
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar el panel")))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [message]);

  const dias = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = dayjs().subtract(6 - i, "day");
      const key = d.format("YYYY-MM-DD");
      const get = (tipo: string) =>
        data.movimientosPorDia.find((r) => r.dia === key && r.tipo === tipo)?.total ?? 0;
      return { dia: d.format("DD/MM"), Entradas: get("entrada"), Salidas: get("salida") };
    });
  }, [data]);

  const estados = useMemo(
    () =>
      (data?.presupuestosPorEstado ?? []).map((e) => ({
        name: STATUS_OPTIONS.find((o) => o.value === e.estado)?.label ?? e.estado,
        value: e.total,
        color: ESTADO_COLOR[e.estado] ?? token.colorPrimary,
      })),
    [data, token.colorPrimary]
  );

  const tooltipStyle = {
    background: token.colorBgElevated,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 8,
    color: token.colorText,
  };

  const stats = data
    ? [
        {
          title: "Productos activos",
          value: data.productosActivos,
          icon: <AppstoreOutlined />,
          color: token.colorPrimary,
        },
        {
          title: "Con stock bajo",
          value: data.stockBajo,
          icon: <WarningOutlined />,
          color: token.colorWarning,
        },
        {
          title: "Movimientos hoy",
          value: data.movimientosHoy,
          icon: <SwapOutlined />,
          color: token.colorInfo,
        },
        {
          title: "Valor del inventario",
          value: formatCurrency(data.valorInventario),
          icon: <DollarOutlined />,
          color: token.colorSuccess,
        },
      ]
    : [];

  return (
    <div>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        {greeting()}, {user?.nombre}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{dayjs().format("dddd, D [de] MMMM")}</Typography.Paragraph>

      {loading && (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 4 }, (_, i) => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <Card>
                <Skeleton avatar active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
          <Col xs={24} lg={14}>
            <Card>
              <Skeleton active paragraph={{ rows: 6 }} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card>
              <Skeleton active paragraph={{ rows: 6 }} />
            </Card>
          </Col>
        </Row>
      )}

      {data && (
        <>
          {data.stockBajo > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Hay ${data.stockBajo} producto(s) con stock por debajo del mínimo`}
            />
          )}

          <Row gutter={[16, 16]}>
            {stats.map((s) => (
              <Col key={s.title} xs={24} sm={12} lg={6}>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 22,
                        color: s.color,
                        background: `color-mix(in srgb, ${s.color} 15%, transparent)`,
                      }}
                    >
                      {s.icon}
                    </div>
                    <Statistic title={<AntTooltip title={HOME_TOOLTIPS[s.title] ?? s.title}>{s.title}</AntTooltip>} value={s.value} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card title="Movimientos de los últimos 7 días">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dias}>
                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} vertical={false} />
                    <XAxis dataKey="dia" stroke={token.colorTextSecondary} />
                    <YAxis allowDecimals={false} stroke={token.colorTextSecondary} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: token.colorFillTertiary }} />
                    <Legend />
                    <Bar dataKey="Entradas" fill={token.colorSuccess} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Salidas" fill={token.colorWarning} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="Cotizaciones por estado">
                {estados.length === 0 ? (
                  <Empty description="Aún no hay cotizaciones" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={estados}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {estados.map((e) => (
                          <Cell key={e.name} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card title="Top productos cotizados">
                {data.topProductos.length === 0 ? (
                  <Empty description="Se llenará con cotizaciones aprobadas o entregadas" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.topProductos} layout="vertical" margin={{ left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} stroke={token.colorTextSecondary} />
                      <YAxis type="category" dataKey="nombre" width={120} stroke={token.colorTextSecondary} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: token.colorFillTertiary }} />
                      <Bar
                        dataKey="unidades"
                        name="Unidades"
                        fill={token.colorPrimary}
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Productos con stock bajo">
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={data.productosStockBajo}
                  locale={{ emptyText: "Todo el inventario está sobre su mínimo" }}
                  columns={[
                    { title: <AntTooltip title="Código del producto">SKU</AntTooltip>, dataIndex: "sku" },
                    { title: <AntTooltip title="Nombre del producto">Producto</AntTooltip>, dataIndex: "nombre" },
                    {
                      title: <AntTooltip title="Stock actual y stock mínimo del producto">Stock / mínimo</AntTooltip>,
                      render: (_, p) => <Tag color="red">{`${p.stock_actual} / ${p.stock_minimo}`}</Tag>,
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Últimos movimientos" style={{ marginTop: 16 }}>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data.ultimosMovimientos}
              locale={{ emptyText: "Aún no hay movimientos" }}
              columns={[
                {
                  title: <AntTooltip title="Fecha del movimiento">Fecha</AntTooltip>,
                  dataIndex: "created_at",
                  render: (v: string) => dayjs(v).format("DD/MM HH:mm"),
                },
                { title: <AntTooltip title="Producto">Producto</AntTooltip>, dataIndex: "producto" },
                {
                  title: <AntTooltip title="Cantidad del movimiento">Movimiento</AntTooltip>,
                  render: (_, m) =>
                    m.tipo === "entrada" ? (
                      <Tag color="green">{`+${m.cantidad}`}</Tag>
                    ) : (
                      <Tag color="orange">{`-${m.cantidad}`}</Tag>
                    ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
