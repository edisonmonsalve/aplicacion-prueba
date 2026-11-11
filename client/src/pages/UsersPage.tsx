import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import type { TableProps } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { getUsers, setUserActivo, type UsersQuery, type UserSortKey } from "@/services/usersService";
import { getErrorMessage } from "@/utils/errors";
import type { User } from "@/types";
import UserFormModal from "@/components/UserFormModal";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import TableSkeleton from "@/components/TableSkeleton";
import ConfirmAction from "@/components/ConfirmAction";
import PageHeader from "@/components/PageHeader";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { ROLES, roleColor, roleLabel } from "@/utils/roles";
import { downloadCsv, fetchAllPages } from "@/utils/csv";

const SORT_KEYS: UserSortKey[] = ["nombre", "email", "rol", "activo", "creado"];

const SORT_BY_FIELD: Record<string, UserSortKey> = {
  nombre: "nombre",
  email: "email",
  rol: "rol",
  activo: "activo",
  created_at: "creado",
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  const { get, getPositiveInt, update } = useUrlFilters();
  const q = get("q") ?? "";
  const rol = (get("rol") as UsersQuery["rol"]) ?? undefined;
  const activo = (get("activo") as UsersQuery["activo"]) ?? undefined;
  const rawSort = get("sort");
  const sort = SORT_KEYS.includes(rawSort as UserSortKey)
    ? (rawSort as UserSortKey)
    : undefined;
  const rawOrder = get("order");
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined;
  const page = getPositiveInt("page", 1);
  const pageSize = getPositiveInt("pageSize", 10);
  const query = useMemo<UsersQuery>(
    () => ({
      page,
      pageSize,
      q: q || undefined,
      rol,
      activo,
      sort,
      order: sort ? order : undefined,
    }),
    [page, pageSize, q, rol, activo, sort, order]
  );
  const [searchText, setSearchText] = useState(q);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useDocumentTitle("Usuarios");

  // Si la URL cambia (atrás/adelante), el buscador refleja el texto activo.
  useEffect(() => {
    setSearchText(q);
  }, [q]);

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

  // Al cambiar un filtro se vuelve a la primera página
  const updateFilters = (changes: Partial<UsersQuery>) =>
    update({ ...changes, page: undefined });

  const hasFilters = Boolean(query.q || query.rol || query.activo);

  const sortOrderFor = (key: UserSortKey): "ascend" | "descend" | null =>
    sort === key ? (order === "desc" ? "descend" : "ascend") : null;

  const clearFilters = () => {
    setSearchText("");
    update({ q: undefined, rol: undefined, activo: undefined, page: undefined });
  };

  // U1: exporta todas las páginas del filtro actual, no solo la visible.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages<User>((p) =>
        getUsers({ ...query, page: p, pageSize: 100 })
      );
      downloadCsv(
        `usuarios-${dayjs().format("YYYY-MM-DD")}.csv`,
        [
          { header: "Nombre", value: (u) => u.nombre },
          { header: "Correo", value: (u) => u.email },
          { header: "Rol", value: (u) => roleLabel(u.rol) },
          { header: "Estado", value: (u) => (u.activo ? "Activo" : "Inactivo") },
          { header: "Creado", value: (u) => dayjs(u.created_at).format("DD/MM/YYYY") },
        ],
        all
      );
      messageApi.success(`${all.length} usuario(s) exportados`);
    } catch {
      messageApi.error("No se pudieron exportar los usuarios");
    } finally {
      setExporting(false);
    }
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
    if (!editingUser) update({ page: undefined }); // el nuevo aparece primero
    setReloadKey((k) => k + 1);
  };

  const columns: TableProps<User>["columns"] = [
    { title: "Nombre", dataIndex: "nombre", sorter: true, sortOrder: sortOrderFor("nombre") },
    { title: "Correo", dataIndex: "email", sorter: true, sortOrder: sortOrderFor("email") },
    {
      title: <Tooltip title="Rol de acceso del usuario">Rol</Tooltip>,
      dataIndex: "rol",
      sorter: true,
      sortOrder: sortOrderFor("rol"),
      render: (rol: User["rol"]) => <Tag color={roleColor(rol)}>{roleLabel(rol)}</Tag>,
    },
    {
      title: <Tooltip title="Activo o inactivo">Estado</Tooltip>,
      dataIndex: "activo",
      sorter: true,
      sortOrder: sortOrderFor("activo"),
      render: (activo: number) =>
        activo ? <Tag color="green">Activo</Tag> : <Tag color="red">Inactivo</Tag>,
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      sorter: true,
      sortOrder: sortOrderFor("creado"),
      render: (value: string) => dayjs(value).format("DD/MM/YYYY"),
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 170,
      fixed: "right" as const,
      render: (_, u) => (
        <Space>
          <Tooltip title="Editar los datos del usuario">
            <Button size="small" onClick={() => openEdit(u)}>
              Editar
            </Button>
          </Tooltip>
          <ConfirmAction
            title={u.activo ? `¿Desactivar a «${u.nombre}»?` : `¿Activar a «${u.nombre}»?`}
            description={
              u.activo
                ? "El usuario perderá el acceso inmediatamente. Su historial de movimientos y facturas se conserva."
                : "El usuario podrá volver a iniciar sesión con su rol actual."
            }
            okText={u.activo ? "Desactivar" : "Activar"}
            danger={!!u.activo}
            onConfirm={() => toggleActivo(u)}
            disabled={u.id === me?.id}
          >
            {/* RN-06: no puedes desactivarte a ti mismo */}
            <Tooltip title={u.activo ? "Desactivar el acceso del usuario" : "Activar el acceso del usuario"}>
              <Button size="small" danger={!!u.activo} disabled={u.id === me?.id}>
                {u.activo ? "Desactivar" : "Activar"}
              </Button>
            </Tooltip>
          </ConfirmAction>
        </Space>
      ),
    },
  ];

  const firstLoad = loading && users.length === 0;

  return (
    <div>
      {contextHolder}
      <PageHeader
        title="Usuarios"
        description="Administra accesos, roles y estado de los usuarios."
        extra={
          <Space>
            <Tooltip title="Exporta todos los usuarios que cumplen los filtros, no solo la página visible.">
              <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportCsv}>
                Exportar CSV
              </Button>
            </Tooltip>
            <Button type="primary" onClick={openCreate}>
              Nuevo usuario
            </Button>
          </Space>
        }
      />

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
          scroll={{ x: "max-content" }}
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
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra.action === "sort") {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const nextSort = s?.order ? SORT_BY_FIELD[String(s.field)] : undefined;
              // Al cambiar el orden se vuelve a la primera página.
              update({
                page: 1,
                pageSize: pagination.pageSize ?? query.pageSize,
                sort: nextSort,
                order: nextSort
                  ? s?.order === "descend"
                    ? "desc"
                    : "asc"
                  : undefined,
              });
              return;
            }
            // Paginar conserva el orden vigente.
            update({
              page: pagination.current ?? 1,
              pageSize: pagination.pageSize ?? query.pageSize,
            });
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
