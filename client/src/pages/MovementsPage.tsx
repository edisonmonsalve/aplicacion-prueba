import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Select, Space, Table, Tag, message } from "antd";
import type { TableProps } from "antd";
import dayjs from "dayjs";
import { getMovements, type MovementsQuery } from "@/services/movementsService";
import { getProducts } from "@/services/productsService";
import { getErrorMessage } from "@/utils/errors";
import type { Product, StockMovement } from "@/types";

export default function MovementsPage() {
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

  const columns: TableProps<StockMovement>["columns"] = [
    {
      title: "Fecha",
      dataIndex: "created_at",
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Producto",
      render: (_, m) => `${m.sku} · ${m.producto}`,
    },
    {
      title: "Tipo",
      dataIndex: "tipo",
      render: (tipo: StockMovement["tipo"]) =>
        tipo === "entrada" ? <Tag color="green">Entrada</Tag> : <Tag color="orange">Salida</Tag>,
    },
    {
      title: "Cantidad",
      align: "right",
      render: (_, m) => (m.tipo === "entrada" ? `+${m.cantidad}` : `-${m.cantidad}`),
    },
    { title: "Motivo", dataIndex: "motivo", render: (v: string | null) => v ?? "—" },
    { title: "Usuario", dataIndex: "usuario" },
  ];

  return (
    <div>
      {contextHolder}
      <h2>Movimientos de stock</h2>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Producto"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 280 }}
          value={query.product_id}
          options={products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.nombre}` }))}
          onChange={(product_id) => updateFilters({ product_id })}
        />
        <Select
          placeholder="Tipo"
          allowClear
          style={{ width: 140 }}
          options={[
            { value: "entrada", label: "Entradas" },
            { value: "salida", label: "Salidas" },
          ]}
          onChange={(tipo) => updateFilters({ tipo })}
        />
      </Space>

      <Table<StockMovement>
        rowKey="id"
        columns={columns}
        dataSource={movements}
        loading={loading}
        scroll={{ x: "max-content" }}
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