import { useEffect, useState } from "react";
import { Button, Input, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import type { TableProps } from "antd";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { getUsers, setUserActivo, type UsersQuery } from "@/services/usersService";
import { getErrorMessage } from "@/utils/errors";
import type { User } from "@/types";
import UserFormModal from "@/components/UserFormModal";



export default function UsersPage() {
  const { user: me } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  const [query, setQuery] = useState<UsersQuery>({ page: 1, pageSize: 10 });
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
      title: "Rol",
      dataIndex: "rol",
      render: (rol: User["rol"]) => (
        <Tag color={rol === "admin" ? "blue" : "default"}>{rol}</Tag>
      ),
    },
    {
      title: "Estado",
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
          <Button size="small" onClick={() => openEdit(u)}>
            Editar
          </Button>
          <Popconfirm
            title={u.activo ? "¿Desactivar usuario?" : "¿Activar usuario?"}
            okText="Sí"
            cancelText="No"
            onConfirm={() => toggleActivo(u)}
            disabled={u.id === me?.id}
          >
            {/* RN-06: no puedes desactivarte a ti mismo */}
            <Button size="small" danger={!!u.activo} disabled={u.id === me?.id}>
              {u.activo ? "Desactivar" : "Activar"}
            </Button>
          </Popconfirm>
        </Space>
      ),

    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Usuarios</h2>
        <Button type="primary" onClick={openCreate}>
          Nuevo usuario
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Buscar por nombre o correo"
          allowClear
          onSearch={(q) => updateFilters({ q: q || undefined })}
          style={{ width: 280 }}
        />
        <Select
          placeholder="Rol"
          allowClear
          style={{ width: 140 }}
          options={[
            { value: "admin", label: "Admin" },
            { value: "operador", label: "Operador" },
          ]}
          onChange={(rol) => updateFilters({ rol })}
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
      </Space>

      <Table<User>
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => setQuery((prev) => ({ ...prev, page, pageSize })),
        }}
      />
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