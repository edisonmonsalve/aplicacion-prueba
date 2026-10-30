import { useEffect, useState } from "react";
import { Alert, Card, Col, Row, Spin, Statistic, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { getDashboard } from "@/services/dashboardService";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency } from "@/utils/format";
import type { Dashboard } from "@/types";

export default function HomePage() {
  const { user } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    getDashboard()
      .then((res) => {
        if (!ignore) setData(res);
      })
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudo cargar el panel")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [messageApi]);

  return (
    <div>
      {contextHolder}
      <Typography.Title level={2}>Hola, {user?.nombre}</Typography.Title>

      {loading && <Spin />}

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
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="Productos activos" value={data.productosActivos} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="Con stock bajo" value={data.stockBajo} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="Movimientos hoy" value={data.movimientosHoy} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="Valor del inventario" value={formatCurrency(data.valorInventario)} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card title="Productos con stock bajo">
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={data.productosStockBajo}
                  locale={{ emptyText: "Todo el inventario está sobre su mínimo" }}
                  columns={[
                    { title: "SKU", dataIndex: "sku" },
                    { title: "Producto", dataIndex: "nombre" },
                    {
                      title: "Stock / mínimo",
                      render: (_, p) => <Tag color="red">{`${p.stock_actual} / ${p.stock_minimo}`}</Tag>,
                    },
                  ]}
                />
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Últimos movimientos">
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={data.ultimosMovimientos}
                  locale={{ emptyText: "Aún no hay movimientos" }}
                  columns={[
                    {
                      title: "Fecha",
                      dataIndex: "created_at",
                      render: (v: string) => dayjs(v).format("DD/MM HH:mm"),
                    },
                    { title: "Producto", dataIndex: "producto" },
                    {
                      title: "Movimiento",
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
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}