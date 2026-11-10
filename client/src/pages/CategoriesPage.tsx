import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, Space, Table, Tooltip, Typography, message } from "antd";
import type { TableProps } from "antd";
import { Link } from "react-router-dom";
import CategoryFormModal from "@/components/CategoryFormModal";
import ConfirmAction from "@/components/ConfirmAction";
import { useAuth } from "@/context/AuthContext";
import { deleteCategory, getCategories } from "@/services/categoriesService";
import { getErrorMessage } from "@/utils/errors";
import type { Category } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import TableSkeleton from "@/components/TableSkeleton";

const PAGE_SIZE = 20;

// Búsqueda local sin distinguir tildes ni mayúsculas.
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function CategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "admin";
  const [messageApi, contextHolder] = message.useMessage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useDocumentTitle("Categorías");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getCategories()
      .then((data) => {
        if (!ignore) setCategories(data);
      })
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudieron cargar las categorías")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey, messageApi]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return categories;
    return categories.filter((c) => normalize(c.nombre).includes(term));
  }, [categories, search]);

  const totalProductos = useMemo(
    () => categories.reduce((sum, c) => sum + c.productos, 0),
    [categories]
  );

  // Si se elimina la última categoría de la página, vuelve a la anterior.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    messageApi.success(editing ? "Categoría actualizada" : "Categoría creada");
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async (c: Category) => {
    try {
      await deleteCategory(c.id);
      messageApi.success("Categoría eliminada");
      setReloadKey((k) => k + 1);
    } catch (err) {
      // Si el servidor aplica RN-05, muestra su mensaje tal cual
      messageApi.error(getErrorMessage(err));
    }
  };

  const columns: TableProps<Category>["columns"] = [
    {
      title: <Tooltip title="Nombre de la categoría">Nombre</Tooltip>,
      dataIndex: "nombre",
      sorter: (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
    },
    {
      title: <Tooltip title="Cantidad de productos en la categoría">Productos</Tooltip>,
      dataIndex: "productos",
      width: 140,
      align: "right",
      sorter: (a, b) => a.productos - b.productos,
      render: (_: unknown, c: Category) =>
        c.productos > 0 ? (
          <Tooltip title={`Ver los productos de «${c.nombre}»`}>
            <Link to={`/products?category_id=${c.id}`}>{c.productos}</Link>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">0</Typography.Text>
        ),
    },
    ...(isAdmin
      ? [
          {
            title: "Acciones",
            width: 190,
            render: (_: unknown, c: Category) => (
              <Space size={4}>
                <Tooltip title="Editar el nombre de la categoría">
                  <Button size="small" onClick={() => openEdit(c)}>
                    Editar
                  </Button>
                </Tooltip>
                <Tooltip title={c.productos > 0 ? "Tiene productos asociados" : ""}>
                  {/* El span permite que el Tooltip funcione sobre un botón deshabilitado */}
                  <span>
                    <ConfirmAction
                      title={`¿Eliminar «${c.nombre}»?`}
                      description={
                        c.productos > 0
                          ? "No se puede eliminar mientras tenga productos asociados."
                          : "La categoría se eliminará permanentemente. Esta acción no se puede deshacer."
                      }
                      okText="Eliminar"
                      onConfirm={() => handleDelete(c)}
                      disabled={c.productos > 0}
                    >
                      <Button size="small" danger disabled={c.productos > 0}>
                        Eliminar
                      </Button>
                    </ConfirmAction>
                  </span>
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  const firstLoad = loading && categories.length === 0;
  const hasSearch = search.trim().length > 0;

  return (
    <div>
      {contextHolder}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Categorías
          </Typography.Title>
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            Organiza los productos del catálogo por categorías.
          </Typography.Text>
        </div>
        {isAdmin && (
          <Button type="primary" onClick={openCreate}>
            Nueva categoría
          </Button>
        )}
      </div>

      {categories.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <Input.Search
            placeholder="Buscar por nombre"
            allowClear
            aria-label="Buscar categorías"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: 320, maxWidth: "100%" }}
          />
          <Typography.Text type="secondary">
            {hasSearch ? `${filtered.length} de ${categories.length} categorías` : `${categories.length} categorías`}
            {" · "}
            {totalProductos} productos
          </Typography.Text>
        </div>
      )}

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<Category>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={
            filtered.length > PAGE_SIZE
              ? {
                  current: page,
                  pageSize: PAGE_SIZE,
                  showSizeChanger: false,
                  showTotal: (total) => `${total} categorías`,
                  onChange: setPage,
                }
              : false
          }
          onChange={(pagination, _filters, _sorter, extra) => {
            if (extra.action === "sort") setPage(1);
            else setPage(pagination.current ?? 1);
          }}
          locale={{
            emptyText: hasSearch ? (
              <Empty description={`No hay categorías que coincidan con «${search.trim()}»`}>
                <Button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                >
                  Limpiar búsqueda
                </Button>
              </Empty>
            ) : (
              <Empty description="Aún no hay categorías">
                {isAdmin && (
                  <Button type="primary" onClick={openCreate}>
                    Crear la primera
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      )}

      {modalOpen && (
        <CategoryFormModal category={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
