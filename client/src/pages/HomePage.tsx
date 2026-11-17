import { signal } from "@/styles/signal";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Empty, Row, Skeleton, Table, Tag, Tooltip as AntTooltip, Typography, theme } from "antd";
import { AppstoreOutlined, DollarOutlined, PercentageOutlined, RiseOutlined, SwapOutlined, WalletOutlined, WarningOutlined } from "@ant-design/icons";
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
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getDashboard } from "@/services/dashboardService";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency, formatNumber } from "@/utils/format";
import { STATUS_OPTIONS } from "@/pages/quotes/quoteUtils";
import type { Dashboard } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import PageHeader from "@/components/PageHeader";
import RelativeTime from "@/components/RelativeTime";
import StatCard from "@/components/StatCard";
import AnimatedNumber from "@/components/AnimatedNumber";

const HOME_TOOLTIPS: Record<string, string> = {
  "Productos activos": "Productos disponibles para vender u operar. Abre el catálogo filtrado por activos.",
  "Con stock bajo": "Productos activos cuyo stock actual es menor al mínimo definido. Abre el catálogo filtrado.",
  "Movimientos hoy": "Entradas y salidas de stock registradas desde la medianoche de hoy.",
  "Valor del inventario":
    "Suma del precio de venta × stock actual de los productos activos. No es la utilidad ni el capital disponible.",
  "Inventario al costo":
    "Suma del costo × stock actual. Es el valor contable del activo y la base para calcular rotación y margen.",
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
};

export default function HomePage() {
  const { user, canOperate } = useAuth();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useDocumentTitle("Inicio");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    getDashboard()
      .then((res) => !ignore && setData(res))
      .catch((err) => !ignore && setError(getErrorMessage(err, "No se pudo cargar el panel")))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

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

  // Colores de gráficos desde tokens del tema: mismo resultado en claro y oscuro.
  const estadoColor = (estado: string) =>
    ({
      borrador: token.colorTextSecondary,
      enviado: token.colorInfo,
      aprobado: token.colorSuccess,
      rechazado: token.colorError,
      entregado: signal.violetAccent,
      vencido: token.colorWarning,
    })[estado] ?? token.colorPrimary;

  const estados = useMemo(
    () =>
      (data?.presupuestosPorEstado ?? []).map((e) => ({
        name: STATUS_OPTIONS.find((o) => o.value === e.estado)?.label ?? e.estado,
        value: e.total,
        color: estadoColor(e.estado),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, token]
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
          value: <AnimatedNumber value={data.productosActivos} format={formatNumber} />,
          icon: <AppstoreOutlined />,
          tone: "primary" as const,
          to: "/products?activo=1",
          hint: "Abre el catálogo filtrado por productos activos",
        },
        {
          title: "Con stock bajo",
          value: <AnimatedNumber value={data.stockBajo} format={formatNumber} />,
          icon: <WarningOutlined />,
          tone: "warning" as const,
          to: "/products?bajoStock=1",
          hint: "Abre el catálogo filtrado por productos bajo el stock mínimo",
        },
        {
          title: "Movimientos hoy",
          value: <AnimatedNumber value={data.movimientosHoy} format={formatNumber} />,
          icon: <SwapOutlined />,
          tone: "info" as const,
          to: "/movements",
          hint: "Abre el historial de movimientos de stock",
        },
        {
          title: "Valor del inventario",
          value: <AnimatedNumber value={data.valorInventario} format={formatCurrency} />,
          icon: <DollarOutlined />,
          tone: "violet" as const,
          to: "/products?activo=1",
          hint: "Abre el catálogo activo que compone este valor",
          sub: `Al costo: ${formatCurrency(data.valorInventarioCosto)}`,
        },
        {
          title: "Inventario al costo",
          value: <AnimatedNumber value={data.valorInventarioCosto} format={formatCurrency} />,
          icon: <WalletOutlined />,
          tone: "primary" as const,
          to: "/products?activo=1",
          hint: "Valor contable del inventario: costo × stock",
          sub:
            data.productosSinCosto > 0
              ? `${data.productosSinCosto} producto(s) sin costo`
              : "Todos los productos tienen costo",
        },
      ]
    : [];

  const fin = data?.finanzas;
  const variacion = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return (
      <span className={`ui-delta ${value >= 0 ? "ui-delta--up" : "ui-delta--down"}`}>
        <RiseOutlined rotate={value >= 0 ? 0 : 180} /> {value >= 0 ? "+" : ""}
        {value.toFixed(1)}%
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="01 / Panel de control"
        title={`${greeting()}, ${user?.nombre}`}
        description={`${dayjs().format("dddd, D [de] MMMM")} · Resumen de tu inventario, cotizaciones y presupuestos.`}
      />

      {loading && (
        <div aria-live="polite" aria-busy="true">
          <Row gutter={[16, 16]}>
            {Array.from({ length: 4 }, (_, i) => (
              <Col key={i} xs={24} sm={12} lg={6}>
                <Card className="ui-scan">
                  <Skeleton avatar active paragraph={{ rows: 1 }} />
                </Card>
              </Col>
            ))}
            <Col xs={24} lg={14}>
              <Card className="ui-scan">
                <Skeleton active paragraph={{ rows: 6 }} />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card className="ui-scan">
                <Skeleton active paragraph={{ rows: 6 }} />
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {error && !loading && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          message="No se pudo cargar el panel"
          description={error}
          action={
            <Button size="small" onClick={() => setReloadKey((k) => k + 1)}>
              Reintentar
            </Button>
          }
        />
      )}

      {data && (
        <>
          {data.stockBajo > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Hay ${data.stockBajo} producto(s) con stock por debajo del mínimo`}
              action={<Link to="/products?bajoStock=1">Ver productos</Link>}
            />
          )}

          <Row gutter={[16, 16]} aria-live="polite">
            {stats.map((s) => (
              <Col key={s.title} xs={24} sm={12} lg={6}>
                <StatCard
                  label={
                    <AntTooltip title={`${HOME_TOOLTIPS[s.title] ?? s.title} ${s.hint}.`}>
                      <span>{s.title}</span>
                    </AntTooltip>
                  }
                  value={s.value}
                  icon={s.icon}
                  tone={s.tone}
                  hint={"sub" in s ? s.sub : undefined}
                  onClick={() => navigate(s.to)}
                />
              </Col>
            ))}
          </Row>

          {fin && (
            <>
              <div style={{ marginTop: 24, marginBottom: 12 }}>
                <span className="ui-eyebrow">02 / Resultados</span>
                <Typography.Title level={5} style={{ margin: "2px 0 0" }}>
                  Finanzas del mes{" "}
                  <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                    ({dayjs(fin.desde).format("MMMM YYYY")})
                  </Typography.Text>
                </Typography.Title>
              </div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    label={<AntTooltip title="Ingresos de resultado del mes (incluye ventas a crédito)">Ingresos del mes</AntTooltip>}
                    value={<AnimatedNumber value={fin.ingresos} format={formatCurrency} />}
                    icon={<DollarOutlined />}
                    tone="income"
                    delta={variacion(fin.variacion_ingresos_pct)}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    label={<AntTooltip title="Salidas reales de caja y bancos del mes">Egresos de caja</AntTooltip>}
                    value={<AnimatedNumber value={fin.egresos} format={formatCurrency} />}
                    icon={<SwapOutlined />}
                    tone="expense"
                    delta={variacion(fin.variacion_egresos_pct)}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    label={<AntTooltip title="Ingresos menos todos los gastos, incluido el costo de ventas">Utilidad del mes</AntTooltip>}
                    value={<AnimatedNumber value={fin.utilidad} format={formatCurrency} />}
                    icon={<RiseOutlined />}
                    tone={fin.utilidad >= 0 ? "income" : "expense"}
                    delta={variacion(fin.variacion_utilidad_pct)}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <StatCard
                    label={<AntTooltip title="IVA por pagar menos IVA descontable. Negativo = saldo a favor.">IVA neto</AntTooltip>}
                    value={<AnimatedNumber value={fin.iva_neto} format={formatCurrency} />}
                    icon={<PercentageOutlined />}
                    tone={fin.iva_neto > 0 ? "outflow" : "income"}
                    hint={`Margen bruto ${fin.margen_bruto_pct.toFixed(0)}% · Capital ${formatCurrency(fin.capital_disponible)}`}
                  />
                </Col>
              </Row>
            </>
          )}

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card
                className="ui-chart-card"
                title={
                  <AntTooltip title="Entradas y salidas de stock registradas en los últimos 7 días">
                    <span>Movimientos de los últimos 7 días</span>
                  </AntTooltip>
                }
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dias}>
                    <defs>
                      <linearGradient id="signalIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={token.colorSuccess} />
                        <stop offset="100%" stopColor={token.colorSuccess} stopOpacity={0.35} />
                      </linearGradient>
                      <linearGradient id="signalOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={token.colorWarning} />
                        <stop offset="100%" stopColor={token.colorWarning} stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} vertical={false} />
                    <XAxis dataKey="dia" stroke={token.colorTextSecondary} />
                    <YAxis allowDecimals={false} stroke={token.colorTextSecondary} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: token.colorFillTertiary }} />
                    <Legend />
                    <Bar dataKey="Entradas" fill="url(#signalIn)" radius={[6, 6, 0, 0]} animationDuration={850} />
                    <Bar dataKey="Salidas" fill="url(#signalOut)" radius={[6, 6, 0, 0]} animationDuration={850} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card
                className="ui-chart-card"
                title={
                  <AntTooltip title="Cantidad de cotizaciones agrupadas por estado actual">
                    <span>Cotizaciones por estado</span>
                  </AntTooltip>
                }
              >
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
                        animationDuration={850}
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
              <Card
                className="ui-chart-card"
                title={
                  <AntTooltip title="Productos con más unidades en cotizaciones aprobadas o entregadas">
                    <span>Top productos cotizados</span>
                  </AntTooltip>
                }
              >
                {data.topProductos.length === 0 ? (
                  <Empty description="Se llenará con cotizaciones aprobadas o entregadas" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.topProductos} layout="vertical" margin={{ left: 16 }}>
                      <defs>
                        <linearGradient id="signalTop" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={token.colorPrimary} stopOpacity={0.55} />
                          <stop offset="100%" stopColor={token.colorPrimary} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={token.colorSplit} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} stroke={token.colorTextSecondary} />
                      <YAxis type="category" dataKey="nombre" width={120} stroke={token.colorTextSecondary} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: token.colorFillTertiary }} />
                      <Bar
                        dataKey="unidades"
                        name="Unidades"
                        fill="url(#signalTop)"
                        radius={[0, 6, 6, 0]}
                        animationDuration={850}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title={
                  <AntTooltip title="Productos cuyo stock está por debajo del mínimo">
                    <span>Productos con stock bajo</span>
                  </AntTooltip>
                }
                extra={<Link to="/products?bajoStock=1">Ver todos</Link>}
              >
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
                      render: (_, p) => (
                        <div className="ui-stock-cell">
                          <Tag color="red">{`${p.stock_actual} / ${p.stock_minimo}`}</Tag>
                          <span className="ui-mini-bar" aria-hidden="true">
                            <span
                              style={{
                                width: `${Math.min(100, Math.max(4, (p.stock_actual / Math.max(p.stock_minimo, 1)) * 100))}%`,
                              }}
                            />
                          </span>
                        </div>
                      ),
                    },
                    ...(canOperate
                      ? [
                          {
                            title: (
                              <AntTooltip title="Crear una factura de compra para reabastecer este producto">
                                Acción
                              </AntTooltip>
                            ),
                            dataIndex: "id",
                            align: "center" as const,
                            render: (id: number) => (
                              <Button
                                type="primary"
                                size="small"
                                onClick={() => navigate(`/facturas/nuevo?tipo=compra&product=${id}`)}
                              >
                                Comprar
                              </Button>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title={
              <AntTooltip title="Últimos movimientos de stock registrados">
                <span>Últimos movimientos</span>
              </AntTooltip>
            }
            extra={<Link to="/movements">Ver todos</Link>}
            style={{ marginTop: 16 }}
          >
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
                  render: (v: string) => <RelativeTime value={v} />,
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
