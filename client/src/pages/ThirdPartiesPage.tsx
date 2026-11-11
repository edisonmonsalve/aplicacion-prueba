import { useEffect, useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { TableProps } from "antd";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import {
  createThirdParty,
  deleteThirdParty,
  listThirdParties,
  updateThirdParty,
} from "@/services/thirdPartiesService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type {
  PaginatedThirdParties,
  ThirdParty,
  ThirdPartyInput,
  ThirdPartyTipo,
} from "@/types";

const PAGE_SIZE = 20;

const TIPO_OPTIONS = [
  { value: "cliente", label: "Cliente" },
  { value: "proveedor", label: "Proveedor" },
  { value: "ambos", label: "Cliente y proveedor" },
];

const DOCUMENTO_OPTIONS = [
  { value: "NIT", label: "NIT" },
  { value: "CC", label: "Cédula" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "OTRO", label: "Otro" },
];

const TIPO_LABEL: Record<ThirdPartyTipo, string> = {
  cliente: "Cliente",
  proveedor: "Proveedor",
  ambos: "Cliente y proveedor",
};

const TIPO_COLOR: Record<ThirdPartyTipo, string> = {
  cliente: "green",
  proveedor: "blue",
  ambos: "purple",
};

export default function ThirdPartiesPage() {
  const { user } = useAuth();
  const canWrite = user?.rol === "admin" || user?.rol === "contador";
  const { message } = App.useApp();
  const [form] = Form.useForm<ThirdPartyInput>();

  const [data, setData] = useState<PaginatedThirdParties>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<ThirdPartyTipo | undefined>();
  const [activo, setActivo] = useState<0 | 1 | undefined>(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ThirdParty | null>(null);
  const [saving, setSaving] = useState(false);
  const condicion = Form.useWatch("condicion_pago", form);

  useDocumentTitle("Terceros");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    listThirdParties({ page, pageSize: PAGE_SIZE, q: search || undefined, tipo, activo })
      .then((r) => {
        if (!ignore) setData(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudieron cargar los terceros")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [page, search, tipo, activo, reloadKey, message]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      tipo: "cliente",
      tipo_documento: "NIT",
      condicion_pago: "contado",
      dias_credito: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (party: ThirdParty) => {
    setEditing(party);
    form.setFieldsValue({
      tipo: party.tipo,
      tipo_documento: party.tipo_documento,
      documento: party.documento ?? undefined,
      nombre: party.nombre,
      email: party.email ?? undefined,
      telefono: party.telefono ?? undefined,
      ciudad: party.ciudad ?? undefined,
      direccion: party.direccion ?? undefined,
      condicion_pago: party.condicion_pago,
      dias_credito: party.dias_credito,
      notas: party.notas ?? undefined,
    });
    setModalOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const input: ThirdPartyInput = {
        ...values,
        dias_credito: values.condicion_pago === "credito" ? values.dias_credito ?? 0 : 0,
      };
      if (editing) await updateThirdParty(editing.id, input);
      else await createThirdParty(input);
      message.success(editing ? "Tercero actualizado" : "Tercero creado");
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo guardar el tercero"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (party: ThirdParty) => {
    try {
      await updateThirdParty(party.id, { activo: !party.activo });
      message.success(party.activo ? "Tercero desactivado" : "Tercero activado");
      setReloadKey((k) => k + 1);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo cambiar el estado"));
    }
  };

  const remove = async (party: ThirdParty) => {
    try {
      await deleteThirdParty(party.id);
      message.success("Tercero eliminado");
      setReloadKey((k) => k + 1);
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo eliminar el tercero"));
    }
  };

  const columns: TableProps<ThirdParty>["columns"] = [
    {
      title: "Nombre",
      dataIndex: "nombre",
      render: (_, p) => (
        <Space direction="vertical" size={0}>
          <span>{p.nombre}</span>
          <Tooltip title={p.tipo_documento}>
            <span style={{ fontSize: 12, color: "#888" }}>{p.documento ?? "Sin documento"}</span>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "Tipo",
      dataIndex: "tipo",
      width: 170,
      render: (t: ThirdPartyTipo) => <Tag color={TIPO_COLOR[t]}>{TIPO_LABEL[t]}</Tag>,
    },
    {
      title: "Contacto",
      width: 220,
      render: (_, p) => (
        <Space direction="vertical" size={0}>
          <span>{p.email ?? "—"}</span>
          <span style={{ fontSize: 12, color: "#888" }}>{p.telefono ?? "Sin teléfono"}</span>
        </Space>
      ),
    },
    {
      title: "Condición",
      width: 150,
      render: (_, p) =>
        p.condicion_pago === "credito" ? `Crédito ${p.dias_credito} días` : "Contado",
    },
    {
      title: "Facturas",
      dataIndex: "facturas",
      width: 100,
      align: "right",
      render: (n: number) => n ?? 0,
    },
    {
      title: "Estado",
      dataIndex: "activo",
      width: 110,
      render: (v: number) =>
        v ? <Tag color="green">Activo</Tag> : <Tag color="default">Inactivo</Tag>,
    },
    ...(canWrite
      ? [
          {
            title: "Acciones",
            width: 250,
            fixed: "right" as const,
            render: (_: unknown, p: ThirdParty) => (
              <Space size={4}>
                <Button size="small" onClick={() => openEdit(p)}>
                  Editar
                </Button>
                <Button size="small" onClick={() => toggleActive(p)}>
                  {p.activo ? "Desactivar" : "Activar"}
                </Button>
                <Popconfirm
                  title={`¿Eliminar «${p.nombre}»?`}
                  description={
                    p.facturas > 0
                      ? "Tiene facturas asociadas; desactívalo en lugar de eliminarlo."
                      : "El tercero se eliminará permanentemente."
                  }
                  okText="Eliminar"
                  cancelText="No"
                  okButtonProps={{ danger: true }}
                  disabled={p.facturas > 0}
                  onConfirm={() => remove(p)}
                >
                  <Button size="small" danger disabled={p.facturas > 0}>
                    Eliminar
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Terceros"
        description="Clientes y proveedores con sus datos de contacto y condiciones de pago."
        extra={
          canWrite && (
            <Button type="primary" onClick={openCreate}>
              Nuevo tercero
            </Button>
          )
        }
      />

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Buscar por nombre, documento o email"
          allowClear
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: 340, maxWidth: "100%" }}
        />
        <Select
          allowClear
          placeholder="Tipo"
          style={{ width: 190 }}
          value={tipo}
          onChange={(v) => {
            setTipo(v);
            setPage(1);
          }}
          options={TIPO_OPTIONS}
        />
        <Select
          style={{ width: 150 }}
          value={activo}
          onChange={(v) => {
            setActivo(v);
            setPage(1);
          }}
          options={[
            { value: 1, label: "Activos" },
            { value: 0, label: "Inactivos" },
          ]}
        />
        <Button
          onClick={() => {
            setSearch("");
            setTipo(undefined);
            setActivo(undefined);
            setPage(1);
          }}
        >
          Ver todos
        </Button>
      </Space>

      <Table<ThirdParty>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data.data}
        scroll={{ x: "max-content" }}
        pagination={
          data.total > PAGE_SIZE
            ? {
                current: page,
                pageSize: PAGE_SIZE,
                total: data.total,
                showSizeChanger: false,
                showTotal: (total) => `${total} terceros`,
                onChange: setPage,
              }
            : false
        }
      />

      <Modal
        title={editing ? "Editar tercero" : "Nuevo tercero"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText={editing ? "Guardar cambios" : "Crear tercero"}
        confirmLoading={saving}
        width={720}
        destroyOnHidden
      >
        <Form<ThirdPartyInput> form={form} layout="vertical">
          <Space wrap align="start">
            <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]} initialValue="cliente">
              <Select style={{ width: 190 }} options={TIPO_OPTIONS} />
            </Form.Item>
            <Form.Item name="tipo_documento" label="Tipo de documento" initialValue="NIT">
              <Select style={{ width: 170 }} options={DOCUMENTO_OPTIONS} />
            </Form.Item>
            <Form.Item name="documento" label="Documento">
              <Input style={{ width: 180 }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="nombre"
            label="Nombre o razón social"
            rules={[{ required: true, min: 2, message: "Mínimo 2 caracteres" }]}
          >
            <Input maxLength={200} />
          </Form.Item>

          <Space wrap align="start">
            <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Email inválido" }]}>
              <Input style={{ width: 260 }} maxLength={150} />
            </Form.Item>
            <Form.Item name="telefono" label="Teléfono">
              <Input style={{ width: 180 }} maxLength={50} />
            </Form.Item>
            <Form.Item name="ciudad" label="Ciudad">
              <Input style={{ width: 180 }} maxLength={100} />
            </Form.Item>
          </Space>

          <Form.Item name="direccion" label="Dirección">
            <Input maxLength={250} />
          </Form.Item>

          <Space wrap align="start">
            <Form.Item name="condicion_pago" label="Condición de pago" initialValue="contado">
              <Select
                style={{ width: 180 }}
                options={[
                  { value: "contado", label: "Contado" },
                  { value: "credito", label: "Crédito" },
                ]}
                onChange={(v) => {
                  if (v === "contado") form.setFieldsValue({ dias_credito: 0 });
                  else if (!form.getFieldValue("dias_credito")) form.setFieldsValue({ dias_credito: 30 });
                }}
              />
            </Form.Item>
            <Form.Item name="dias_credito" label="Días de crédito" initialValue={0}>
              <InputNumber min={0} max={3650} disabled={condicion !== "credito"} style={{ width: 150 }} />
            </Form.Item>
          </Space>

          <Form.Item name="notas" label="Notas">
            <Input.TextArea rows={2} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
