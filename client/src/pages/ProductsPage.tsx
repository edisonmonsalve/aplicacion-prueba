import { useEffect, useState } from "react";
import { Button, Checkbox, Input, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import type { TableProps } from "antd";
import ProductFormModal from "@/components/ProductFormModal";
import { useAuth } from "@/context/AuthContext";
import { getCategories } from "@/services/categoriesService";
import {
  getProducts,
  setProductActivo,
  type ProductsQuery,
} from "@/services/productsService";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency } from "@/utils/format";
import type { Category, Product } from "@/types";
import { useNavigate } from "react-router-dom";
import MovementFormModal from "@/components/MovementFormModal";

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "admin";
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const [query, setQuery] = useState<ProductsQuery>({ page: 1, pageSize: 10 });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Las categorías se cargan una vez: alimentan el filtro y el formulario
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudieron cargar las categorías")));
  }, [messageApi]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getProducts(query)
      .then((res) => {
        if (ignore) return;
        setProducts(res.data);
        setTotal(res.total);
      })
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudieron cargar los productos")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [query, reloadKey, messageApi]);

  const updateFilters = (changes: Partial<ProductsQuery>) =>
    setQuery((prev) => ({ ...prev, ...changes, page: 1 }));

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    messageApi.success(editing ? "Producto actualizado" : "Producto creado");
    if (!editing) setQuery((prev) => ({ ...prev, page: 1 }));
    setReloadKey((k) => k + 1);
  };

  const toggleActivo = async (p: Product) => {
    try {
      await setProductActivo(p.id, !p.activo);
      messageApi.success(p.activo ? "Producto desactivado" : "Producto activado");
      setReloadKey((k) => k + 1);
    } catch (err) {
      messageApi.error(getErrorMessage(err));
    }
  };
  const handleMovementSaved = (newStock: number) => {
    setMovementProduct(null);
    messageApi.success(`Movimiento registrado. Nuevo stock: ${newStock}`);
    setReloadKey((k) => k + 1);
  };

  const columns: TableProps<Product>["columns"] = [
    { title: "SKU", dataIndex: "sku" },
    { title: "Nombre", dataIndex: "nombre" },
    { title: "Categoría", dataIndex: "categoria" },
    {
      title: "Precio",
      dataIndex: "precio",
      align: "right",
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Stock",
      dataIndex: "stock_actual",
      align: "right",
      render: (stock: number, p) =>
        // RF-11: alerta visual de stock por debajo del mínimo
        stock < p.stock_minimo ? <Tag color="red">{stock} · Bajo</Tag> : stock,
    },
    { title: "Mínimo", dataIndex: "stock_minimo", align: "right" },
    {
      title: "Estado",
      dataIndex: "activo",
      render: (activo: number) =>
        activo ? <Tag color="green">Activo</Tag> : <Tag color="red">Inactivo</Tag>,
    },
    {
      title: "Acciones",
      render: (_, p) => (
        <Space>
          <Button size="small" type="primary" disabled={!p.activo} onClick={() => setMovementProduct(p)}>
            Movimiento
          </Button>
          <Button size="small" onClick={() => navigate(`/movements?product_id=${p.id}`)}>
            Historial
          </Button>
          <Button size="small" onClick={() => openEdit(p)}>
            Editar
          </Button>
          {isAdmin && (
            <Popconfirm
              title={p.activo ? "¿Desactivar producto?" : "¿Activar producto?"}
              okText="Sí"
              cancelText="No"
              onConfirm={() => toggleActivo(p)}
            >
              <Button size="small" danger={!!p.activo}>
                {p.activo ? "Desactivar" : "Activar"}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Productos</h2>
        <Button type="primary" onClick={openCreate}>
          Nuevo producto
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Buscar por nombre o SKU"
          allowClear
          onSearch={(q) => updateFilters({ q: q || undefined })}
          style={{ width: 280 }}
        />
        <Select
          placeholder="Categoría"
          allowClear
          style={{ width: 180 }}
          options={categories.map((c) => ({ value: c.id, label: c.nombre }))}
          onChange={(category_id) => updateFilters({ category_id })}
        />
        <Select
          placeholder="Estado"
          allowClear
          style={{ width: 140 }}
          options={[
            { value: "1", label: "Activos" },
            { value: "0", label: "Inactivos" },
          ]}
          onChange={(activo) => updateFilters({ activo })}
        />
        <Checkbox onChange={(e) => updateFilters({ bajoStock: e.target.checked ? "1" : undefined })}>
          Solo stock bajo
        </Checkbox>
      </Space>

      <Table<Product>
        rowKey="id"
        columns={columns}
        dataSource={products}
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

      {modalOpen && (
        <ProductFormModal
          product={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
      {movementProduct && (
        <MovementFormModal
          product={movementProduct}
          onClose={() => setMovementProduct(null)}
          onSaved={handleMovementSaved}
        />
      )}
    </div>
  );
}