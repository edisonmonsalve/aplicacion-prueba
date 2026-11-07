import { useEffect, useState } from "react";
import { Button, Empty, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import type { TableProps } from "antd";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { getUsers, setUserActivo, type UsersQuery } from "@/services/usersService";
import { getErrorMessage } from "@/utils/errors";
import type { User } from "@/types";
import UserFormModal from "@/components/UserFormModal";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import TableSkeleton from "@/components/TableSkeleton";
import { ROLES, roleColor, roleLabel } from "@/utils/roles";

export default function UsersPage() {
  const { user: me } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  const [query, setQuery] = useState<UsersQuery>({ page: 1, pageSize: 10 });
  const [searchText, setSearchText] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useDocumentTitle("Usuarios");

  useEffect(() => {
    let ignore = false; // evita aplicar una respuesta vieja si cambió la consulta
    setLoading(true);
    getUsers(query)
      .then((res) => {
        if (ignore) return;
        setUsers(res.data);
        setTotal(res.total);
      })
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudieron cargar los usuarios")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [query, reloadKey, messageApi]);

  // Al cambiar un filtro se vuelve a la página 1
  const updateFilters = (changes: Partial<UsersQuery>) =>
    setQuery((prev) => ({ ...prev, ...changes, page: 1 }));

  const hasFilters = Boolean(query.q || query.rol || query.activo);

  const clearFilters = () => {
    setSearchText("");
    setQuery((prev) => ({ ...prev, q: undefined, rol: undefined, activo: undefined, page: 1 }));
  };

  const toggleActivo = async (u: User) => {
    try {
      await setUserActivo(u.id, !u.activo);
      messageApi.success(u.activo ? "Usuario desactivado" : "Usuario activado");
      setReloadKey((k) => k + 1);
    } catch (err) {
      messageApi.error(getErrorMessage(err));
    }
  };
  const openCreate = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    messageApi.success(editingUser ? "Usuario actualizado" : "Usuario creado");
    if (!editingUser) setQuery((prev) => ({ ...prev, page: 1 })); // el nuevo aparece primero
    setReloadKey((k) => k + 1);
  };

  const columns: TableProps<User>["columns"] = [
    { title: "Nombre", dataIndex: "nombre" },
    { title: "Correo", dataIndex: "email" },
    {
      title: <Tooltip title="Rol de acceso del usuario">Rol</Tooltip>,
      dataIndex: "rol",
      render: (rol: User["rol"]) => <Tag color={roleColor(rol)}>{roleLabel(rol)}</Tag>,
    },
    {
      title: <Tooltip title="Activo o inactivo">Estado</Tooltip>,
      dataIndex: "activo",
      render: (activo: number) =>
        activo ? <Tag color="green">Activo</Tag> : <Tag color="red">Inactivo</Tag>,
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      render: (value: string) => dayjs(value).format("DD/MM/YYYY"),
    },
    {
      title: "Acciones",
      render: (_, u) => (
        <Space>
          <Tooltip title="Editar los datos del usuario">
            <Button size="small" onClick={() => openEdit(u)}>
              Editar
            </Button>
          </Tooltip>
          <Popconfirm
            title={u.activo ? "¿Desactivar usuario?" : "¿Activar usuario?"}
            okText="Sí"
            cancelText="No"
            onConfirm={() => toggleActivo(u)}
            disabled={u.id === me?.id}
          >
            {/* RN-06: no puedes desactivarte a ti mismo */}
            <Tooltip title={u.activo ? "Desactivar el acceso del usuario" : "Activar el acceso del usuario"}>
              <Button size="small" danger={!!u.activo} disabled={u.id === me?.id}>
                {u.activo ? "Desactivar" : "Activar"}
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const firstLoad = loading && users.length === 0;

  return (
    <div>
      {contextHolder}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Usuarios</Typography.Title>
          <Typography.Text type="secondary">Administra accesos, roles y estado de los usuarios.</Typography.Text>
        </div>
        <Button type="primary" onClick={openCreate}>
          Nuevo usuario
        </Button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Buscar
          </Typography.Text>
          <Input.Search
            placeholder="Nombre o correo"
            allowClear
            aria-label="Buscar usuarios"
value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(q) => updateFilters({ q: q || undefined })}
            style={{ width: 280 }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Rol
          </Typography.Text>
          <Select
            placeholder="Todos"
            allowClear
            style={{ width: 140 }}
            value={query.rol}
            options={ROLES.map(({ value, label }) => ({ value, label }))}
            onChange={(rol) => updateFilters({ rol })}
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
        {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
      </div>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<User>
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters ? "No hay usuarios que coincidan con los filtros" : "Aún no hay usuarios"
                }
              >
                {hasFilters ? (
                  <Button onClick={clearFilters}>Limpiar filtros</Button>
                ) : (
                  <Button type="primary" onClick={openCreate}>
                    Crear el primero
                  </Button>
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
        <UserFormModal
          user={editingUser}
          isSelf={editingUser?.id === me?.id}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
