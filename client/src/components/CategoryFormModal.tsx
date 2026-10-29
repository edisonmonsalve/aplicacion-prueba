import { useState } from "react";
import { Form, Input, Modal, message } from "antd";
import { isAxiosError } from "axios";
import { createCategory, updateCategory } from "@/services/categoriesService";
import { getErrorMessage } from "@/utils/errors";
import type { Category } from "@/types";

interface Props {
  category: Category | null; // null = crear, Category = editar
  onClose: () => void;
  onSaved: () => void;
}

export default function CategoryFormModal({ category, onClose, onSaved }: Props) {
  const [form] = Form.useForm<{ nombre: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const isEdit = category !== null;

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setSaving(true);
    try {
      if (category) await updateCategory(category.id, values.nombre);
      else await createCategory(values.nombre);
      onSaved();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        form.setFields([{ name: "nombre", errors: [getErrorMessage(err)] }]);
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
      title={isEdit ? "Editar categoría" : "Nueva categoría"}
      okText={isEdit ? "Guardar cambios" : "Crear categoría"}
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
        initialValues={{ nombre: category?.nombre }}
        onFinish={handleOk}
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
          <Input autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}