import { useState } from "react";
import { Form, Input, InputNumber, Modal, Select, message } from "antd";
import { isAxiosError } from "axios";
import { createProduct, updateProduct, type ProductInput } from "@/services/productsService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { canEditCosts, canSeeCosts } from "@/utils/roles";
import type { Category, Product } from "@/types";

interface Props {
  product: Product | null; // null = crear, Product = editar
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductFormModal({ product, categories, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [form] = Form.useForm<ProductInput>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const isEdit = product !== null;
  const verCosto = canSeeCosts(user?.rol);
  const editarCosto = canEditCosts(user?.rol);

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setSaving(true);
    try {
      if (product) await updateProduct(product.id, values);
      else await createProduct(values);
      onSaved();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // RN-01: SKU repetido, se muestra bajo el campo SKU
        form.setFields([{ name: "sku", errors: [getErrorMessage(err)] }]);
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
      title={isEdit ? "Editar producto" : "Nuevo producto"}
      okText={isEdit ? "Guardar cambios" : "Crear producto"}
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
          product
            ? {
                sku: product.sku,
                nombre: product.nombre,
                category_id: product.category_id,
                precio: product.precio,
                costo: product.costo ?? 0,
                stock_minimo: product.stock_minimo,
              }
            : { stock_minimo: 0, costo: 0 }
        }
      >
        <Form.Item
          label="SKU"
          name="sku"
          tooltip="Código único del producto (no se puede repetir)."
          rules={[
            { required: true, message: "Ingresa el SKU" },
            { max: 50, message: "Máximo 50 caracteres" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Nombre"
          name="nombre"
          tooltip="Nombre descriptivo del producto."
          rules={[
            { required: true, message: "Ingresa el nombre" },
            { min: 2, message: "Mínimo 2 caracteres" },
            { max: 150, message: "Máximo 150 caracteres" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Categoría"
          name="category_id"
          tooltip="Categoría a la que pertenece el producto."
          rules={[{ required: true, message: "Selecciona una categoría" }]}
        >
          <Select
            placeholder="Selecciona"
            options={categories.map((c) => ({ value: c.id, label: c.nombre }))}
          />
        </Form.Item>

        <Form.Item
          label="Precio"
          name="precio"
          tooltip="Precio de venta al público."
          rules={[
            { required: true, message: "Ingresa el precio" },
            { type: "number", min: 0.01, message: "Debe ser mayor que cero" }, // RN-07
          ]}
        >
          <InputNumber min={0} step={100} style={{ width: "100%" }} />
        </Form.Item>

        {verCosto && (
          <Form.Item
            label="Costo"
            name="costo"
            tooltip="Costo del producto (solo admin puede modificarlo)."
            rules={[{ type: "number", min: 0, message: "No puede ser negativo" }]}
            extra={
              editarCosto
                ? "Solo visible para roles con acceso a costos."
                : "Solo lectura: tu rol no puede modificarlo."
            }
          >
            <InputNumber min={0} step={100} style={{ width: "100%" }} disabled={!editarCosto} />
          </Form.Item>
        )}

        <Form.Item
          label="Stock mínimo"
          name="stock_minimo"
          tooltip="Umbral para marcar el producto con stock bajo."
          rules={[{ required: true, message: "Ingresa el stock mínimo" }]}
          extra="El stock actual solo cambia registrando movimientos."
        >
          <InputNumber min={0} precision={0} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}