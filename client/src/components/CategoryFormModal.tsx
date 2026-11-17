import { useRef, useState } from "react";
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

interface FormValues {
  nombre: string;
  codigo: string;
}

/** Quita acentos y caracteres especiales para proponer un prefijo legible. */
function codeFromName(nombre: string) {
  const normalized = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "");
  return normalized.slice(0, 3).toUpperCase();
}

export default function CategoryFormModal({ category, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const codeEdited = useRef(false);
  const isEdit = category !== null;

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setSaving(true);
    try {
      if (category) await updateCategory(category.id, values.nombre, values.codigo);
      else await createCategory(values.nombre, values.codigo);
      onSaved();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        const field = getErrorMessage(err).toLowerCase().includes("código") ? "codigo" : "nombre";
        form.setFields([{ name: field, errors: [getErrorMessage(err)] }]);
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
        initialValues={{ nombre: category?.nombre, codigo: category?.codigo }}
        onFinish={handleOk}
      >
        <Form.Item
          label="Nombre"
          name="nombre"
          tooltip="Nombre de la categoría (único)."
          rules={[
            { required: true, message: "Ingresa el nombre" },
            { min: 2, message: "Mínimo 2 caracteres" },
            { max: 100, message: "Máximo 100 caracteres" },
          ]}
        >
          <Input
            autoFocus
            onChange={(e) => {
              // Al crear, el prefijo sigue al nombre hasta que se edite a mano.
              if (!isEdit && !codeEdited.current) {
                form.setFieldValue("codigo", codeFromName(e.target.value));
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="Código (prefijo de SKU)"
          name="codigo"
          tooltip="Entre 2 y 10 letras o números. Se usa como prefijo: BEB-0001, BEB-0002..."
          rules={[
            { required: true, message: "Ingresa el código" },
            { min: 2, message: "Mínimo 2 caracteres" },
            { max: 10, message: "Máximo 10 caracteres" },
            { pattern: /^[A-Za-z0-9]+$/, message: "Solo letras y números" },
          ]}
          extra="Único por categoría. Cambiarlo no renombra los SKU ya creados."
        >
          <Input
            placeholder="Ej. BEB"
            maxLength={10}
            style={{ textTransform: "uppercase" }}
            onChange={(e) => {
              codeEdited.current = true;
              form.setFieldValue("codigo", e.target.value.toUpperCase());
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
