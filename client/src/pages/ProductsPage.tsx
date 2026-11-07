import { useEffect, useState } from "react";
import { Button, Checkbox, Empty, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import type { TableProps } from "antd";
import ProductFormModal from "@/components/ProductFormModal";
import { useAuth } from "@/context/AuthContext";
import { getCategories } from "@/services/categoriesService";
import { getProducts, setProductActivo, type ProductsQuery } from "@/services/productsService";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency } from "@/utils/format";
import { canSeeCosts } from "@/utils/roles";
import type { Category, Product } from "@/types";
import { useNavigate } from "react-router-dom";
import TableSkeleton from "@/components/TableSkeleton";
import MovementFormModal from "@/components/MovementFormModal";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function ProductsPage() {
  const { user, canOperate } = useAuth();
  const isAdmin = user?.rol === "admin";
  const verCosto = canSeeCosts(user?.rol);
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const [query, setQuery] = useState<ProductsQuery>({ page: 1, pageSize: 10 });
  const [searchText, setSearchText] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useDocumentTitle("Productos");

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

  const hasFilters = Boolean(query.q || query.category_id || query.activo || query.bajoStock);

  const clearFilters = () => {
    setSearchText("");
    setQuery((prev) => ({ ...prev, q: undefined, category_id: undefined, activo: undefined, bajoStock: undefined, page: 1 }));
  };

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
    ...(verCosto
      ? ([
          {
            title: <Tooltip title="Costo del producto (solo roles con permiso)">Costo</Tooltip>,
            dataIndex: "costo",
            align: "right",
            render: (value: number | null) => (value === null ? "—" : formatCurrency(value)),
          },
          {
            title: <Tooltip title="Margen bruto porcentual (precio - costo) / precio">Margen</Tooltip>,
            align: "right",
            render: (_: unknown, p: Product) => {
              if (p.costo === null || p.precio <= 0) return "—";
              const pct = ((p.precio - p.costo) / p.precio) * 100;
              return <Tag color={pct < 0 ? "red" : pct < 20 ? "orange" : "green"}>{pct.toFixed(1)}%</Tag>;
            },
          },
        ] as NonNullable<TableProps<Product>["columns"]>)
      : []),
    {
      title: <Tooltip title="Stock actual del producto">Stock</Tooltip>,
      dataIndex: "stock_actual",
      align: "right",
      render: (stock: number, p) =>
        // RF-11: alerta visual de stock por debajo del mínimo
        stock < p.stock_minimo ? <Tag color="red">{stock} · Bajo</Tag> : stock,
    },
    { title: <Tooltip title="Stock mínimo para generar alerta">Mínimo</Tooltip>, dataIndex: "stock_minimo", align: "right" },
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
          {canOperate && (
            <Tooltip title="Registrar una entrada o salida de stock">
              <Button size="small" type="primary" disabled={!p.activo} onClick={() => setMovementProduct(p)}>
                Movimiento
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Ver el historial de movimientos del producto">
            <Button size="small" onClick={() => navigate(`/movements?product_id=${p.id}`)}>
              Historial
            </Button>
          </Tooltip>
          {canOperate && (
            <Tooltip title="Editar los datos del producto">
              <Button size="small" onClick={() => openEdit(p)}>
                Editar
              </Button>
            </Tooltip>
          )}
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

  const firstLoad = loading && products.length === 0;

  return (
    <div>
      {contextHolder}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Productos</Typography.Title>
          <Typography.Text type="secondary">Gestiona el catálogo, precios, costos y stock.</Typography.Text>
        </div>
        {canOperate && (
          <Button type="primary" onClick={openCreate}>
            Nuevo producto
          </Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Buscar
          </Typography.Text>
          <Input.Search
            placeholder="Nombre o SKU"
            allowClear
            aria-label="Buscar productos"
value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(q) => updateFilters({ q: q || undefined })}
            style={{ width: 280 }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Categoría
          </Typography.Text>
          <Select
            placeholder="Todas"
            allowClear
            style={{ width: 180 }}
            value={query.category_id}
            options={categories.map((c) => ({ value: c.id, label: c.nombre }))}
            onChange={(category_id) => updateFilters({ category_id })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Estado
          </Typography.Text>
          <Select
            placeholder="Todos"
            allowClear
            style={{ width: 140 }}
            value={query.activo}
            options={[
              { value: "1", label: "Activos" },
              { value: "0", label: "Inactivos" },
            ]}
            onChange={(activo) => updateFilters({ activo })}
          />
        </div>
        <Checkbox
          checked={query.bajoStock === "1"}
          onChange={(e) => updateFilters({ bajoStock: e.target.checked ? "1" : undefined })}
        >
          Solo stock bajo
        </Checkbox>
        {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
      </div>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<Product>
          rowKey="id"
          columns={columns}
          dataSource={products}
          loading={loading}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters ? "No hay productos que coincidan con los filtros" : "Aún no hay productos"
                }
              >
                {hasFilters ? (
                  <Button onClick={clearFilters}>Limpiar filtros</Button>
                ) : (
                  canOperate && (
                    <Button type="primary" onClick={openCreate}>
                      Crear el primero
                    </Button>
                  )
                )}
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
      )}

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
