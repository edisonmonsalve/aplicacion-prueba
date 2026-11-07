import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Empty, Select, Table, Tag, Tooltip, Typography, message } from "antd";
import type { TableProps } from "antd";
import dayjs from "dayjs";
import { getMovements, type MovementsQuery } from "@/services/movementsService";
import { getProducts } from "@/services/productsService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency } from "@/utils/format";
import { canSeeCosts } from "@/utils/roles";
import type { Product, StockMovement } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function MovementsPage() {
  const { user } = useAuth();
  const verCosto = canSeeCosts(user?.rol);
  const [messageApi, contextHolder] = message.useMessage();
  const [searchParams] = useSearchParams();

  // Si se llega desde "Historial" en productos, viene ?product_id=...
  const initialProduct = Number(searchParams.get("product_id")) || undefined;

  const [query, setQuery] = useState<MovementsQuery>({
    page: 1,
    pageSize: 10,
    product_id: initialProduct,
  });
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useDocumentTitle("Movimientos");

  // Productos para el filtro (suficiente para esta práctica: los primeros 100)
  useEffect(() => {
    getProducts({ page: 1, pageSize: 100 })
      .then((res) => setProducts(res.data))
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudieron cargar los productos")));
  }, [messageApi]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getMovements(query)
      .then((res) => {
        if (ignore) return;
        setMovements(res.data);
        setTotal(res.total);
      })
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudo cargar el historial")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [query, messageApi]);

  const updateFilters = (changes: Partial<MovementsQuery>) =>
    setQuery((prev) => ({ ...prev, ...changes, page: 1 }));

  const hasFilters = query.product_id !== undefined || query.tipo !== undefined;

  const clearFilters = () => updateFilters({ product_id: undefined, tipo: undefined });

  const columns: TableProps<StockMovement>["columns"] = [
    {
      title: <Tooltip title="Fecha y hora en que se registró el movimiento">Fecha</Tooltip>,
      dataIndex: "created_at",
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: <Tooltip title="Producto afectado por el movimiento">Producto</Tooltip>,
      render: (_, m) => `${m.sku} · ${m.producto}`,
    },
    {
      title: <Tooltip title="Entrada (suma stock) o salida (resta stock)">Tipo</Tooltip>,
      dataIndex: "tipo",
      render: (tipo: StockMovement["tipo"]) =>
        tipo === "entrada" ? <Tag color="green">Entrada</Tag> : <Tag color="orange">Salida</Tag>,
    },
    {
      title: <Tooltip title="Unidades del movimiento">Cantidad</Tooltip>,
      align: "right",
      render: (_, m) => (m.tipo === "entrada" ? `+${m.cantidad}` : `-${m.cantidad}`),
    },
    ...(verCosto
      ? ([
          {
            title: <Tooltip title="Costo por unidad (entrada); en salidas se estima con el costo actual del producto">Costo unitario</Tooltip>,
            dataIndex: "costo_unitario",
            align: "right",
            render: (value: number | null) => (value === null ? "—" : formatCurrency(value)),
          },
          {
            title: <Tooltip title="Costo unitario multiplicado por la cantidad">Costo total</Tooltip>,
            align: "right",
            render: (_: unknown, m: StockMovement) =>
              m.costo_unitario === null ? "—" : formatCurrency(m.costo_unitario * m.cantidad),
          },
        ] as NonNullable<TableProps<StockMovement>["columns"]>)
      : []),
    { title: <Tooltip title="Motivo o referencia del movimiento">Motivo</Tooltip>, dataIndex: "motivo", render: (v: string | null) => v ?? "—" },
    { title: <Tooltip title="Usuario que registró el movimiento">Usuario</Tooltip>, dataIndex: "usuario" },
  ];

  return (
    <div>
      {contextHolder}
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Movimientos de stock</Typography.Title>
        <Typography.Text type="secondary">
          Consulta el historial de entradas y salidas. El stock solo cambia registrando movimientos.
        </Typography.Text>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Producto
          </Typography.Text>
          <Select
            placeholder="Todos"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 280 }}
            value={query.product_id}
            options={products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.nombre}` }))}
            onChange={(product_id) => updateFilters({ product_id })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Tipo de movimiento
          </Typography.Text>
          <Select
            placeholder="Todos"
            allowClear
            style={{ width: 160 }}
            value={query.tipo}
            options={[
              { value: "entrada", label: "Entradas" },
              { value: "salida", label: "Salidas" },
            ]}
            onChange={(tipo) => updateFilters({ tipo })}
          />
        </div>
        {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
      </div>

      <Table<StockMovement>
        rowKey="id"
        columns={columns}
        dataSource={movements}
        loading={loading}
        scroll={{ x: "max-content" }}
        locale={{
          emptyText: (
            <Empty
              description={
                hasFilters
                  ? "No hay movimientos que coincidan con los filtros"
                  : "Aún no hay movimientos"
              }
            >
              {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
            </Empty>
          ),
        }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => setQuery((prev) => ({ ...prev, page, pageSize })),
        }}
      />
    </div>
  );
}
