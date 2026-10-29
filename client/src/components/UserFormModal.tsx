import { useState } from "react";
import { Form, Input, Modal, Select, message } from "antd";
import { isAxiosError } from "axios";
import { createUser, updateUser } from "@/services/usersService";
import { getErrorMessage } from "@/utils/errors";
import type { Rol, User } from "@/types";

interface Props {
  user: User | null; // null = crear, User = editar
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  nombre: string;
  email: string;
  password?: string;
  rol: Rol;
}

export default function UserFormModal({ user, isSelf, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const isEdit = user !== null;

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return; // hay errores de validación visibles en el formulario

    setSaving(true);
    try {
      if (user) {
        // En edición, una contraseña vacía significa "no cambiarla"
        await updateUser(user.id, { ...values, password: values.password || undefined });
      } else {
        await createUser({ ...values, password: values.password! });
      }
      onSaved();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // Error del servidor mostrado en el campo que lo causó
        form.setFields([{ name: "email", errors: [getErrorMessage(err)] }]);
      } else {
        messageApi.error(getErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={isEdit ? "Editar usuario" : "Nuevo usuario"}
      okText={isEdit ? "Guardar cambios" : "Crear usuario"}
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
    >
      {contextHolder}
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={
          user
            ? { nombre: user.nombre, email: user.email, rol: user.rol }
            : { rol: "operador" }
        }
      >
        <Form.Item
          label="Nombre"
          name="nombre"
          rules={[
            { required: true, message: "Ingresa el nombre" },
            { min: 2, message: "Mínimo 2 caracteres" },
            { max: 100, message: "Máximo 100 caracteres" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Correo"
          name="email"
          rules={[
            { required: true, message: "Ingresa el correo" },
            { type: "email", message: "Correo no válido" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label={isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}
          name="password"
          rules={[
            { required: !isEdit, message: "Ingresa la contraseña" },
            { min: 8, message: "Mínimo 8 caracteres" },
            { max: 72, message: "Máximo 72 caracteres" },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item label="Rol" name="rol" rules={[{ required: true }]}>
          {/* RN-06: no puedes quitarte tu propio rol de admin */}
          <Select
            disabled={isSelf}
            options={[
              { value: "admin", label: "Admin" },
              { value: "operador", label: "Operador" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}