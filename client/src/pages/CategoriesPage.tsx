import { useEffect, useState } from "react";
import { Button, Empty, Space, Table, Tooltip, Typography, message } from "antd";
import type { TableProps } from "antd";
import CategoryFormModal from "@/components/CategoryFormModal";
import ConfirmAction from "@/components/ConfirmAction";
import { useAuth } from "@/context/AuthContext";
import { deleteCategory, getCategories } from "@/services/categoriesService";
import { getErrorMessage } from "@/utils/errors";
import type { Category } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import TableSkeleton from "@/components/TableSkeleton";

export default function CategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "admin";
  const [messageApi, contextHolder] = message.useMessage();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

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
    { title: <Tooltip title="Nombre de la categoría">Nombre</Tooltip>, dataIndex: "nombre" },
    { title: <Tooltip title="Cantidad de productos en la categoría">Productos</Tooltip>, dataIndex: "productos", width: 120 },
    ...(isAdmin
      ? [
          {
            title: "Acciones",
            width: 200,
            render: (_: unknown, c: Category) => (
              <Space>
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

  return (
    <div>
      {contextHolder}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Categorías</Typography.Title>
          <Typography.Text type="secondary">Organiza los productos del catálogo por categorías.</Typography.Text>
        </div>
        {isAdmin && (
          <Button type="primary" onClick={openCreate}>
            Nueva categoría
          </Button>
        )}
      </div>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<Category>
          rowKey="id"
          columns={columns}
          dataSource={categories}
          loading={loading}
          locale={{
            emptyText: (
              <Empty description="Aún no hay categorías">
                {isAdmin && (
                  <Button type="primary" onClick={openCreate}>
                    Crear la primera
                  </Button>
                )}
              </Empty>
            ),
          }}
          pagination={false}
        />
      )}

      {modalOpen && (
        <CategoryFormModal category={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
