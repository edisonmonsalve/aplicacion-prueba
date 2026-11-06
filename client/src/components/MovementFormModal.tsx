import { useState } from "react";
import { Form, Input, InputNumber, Modal, Radio, Typography, message } from "antd";
import { isAxiosError } from "axios";
import { createMovement, type MovementInput } from "@/services/movementsService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { canEditCosts } from "@/utils/roles";
import type { Product } from "@/types";

interface Props {
  product: Product;
  onClose: () => void;
  onSaved: (newStock: number) => void;
}

type FormValues = Omit<MovementInput, "product_id">;

export default function MovementFormModal({ product, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const tipo = Form.useWatch("tipo", form);
  // Solo admin puede fijar el costo de una entrada; el operador ni siquiera lo ve
  const puedeFijarCosto = canEditCosts(user?.rol);

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setSaving(true);
    try {
      const result = await createMovement({
        product_id: product.id,
        tipo: values.tipo,
        cantidad: values.cantidad,
        ...(puedeFijarCosto && values.tipo === "entrada" && values.costo_unitario !== undefined
          ? { costo_unitario: values.costo_unitario }
          : {}),
        motivo: values.motivo || undefined,
      });
      onSaved(result.stock_actual);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // RN-02: el servidor es la autoridad, aunque el formulario ya avise antes
        form.setFields([{ name: "cantidad", errors: [getErrorMessage(err)] }]);
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
      title="Registrar movimiento"
      okText="Registrar"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
    >
      {contextHolder}
      <Typography.Paragraph>
        <b>{product.sku}</b> · {product.nombre}
        <br />
        Stock actual: <b>{product.stock_actual}</b>
      </Typography.Paragraph>

      <Form form={form} layout="vertical" initialValues={{ tipo: "entrada" }}>
        <Form.Item label="Tipo" name="tipo">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: "entrada", label: "Entrada" },
              { value: "salida", label: "Salida" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="Cantidad"
          name="cantidad"
          dependencies={["tipo"]} // revalida al cambiar entre entrada y salida
          rules={[
            { required: true, message: "Ingresa la cantidad" },
            { type: "number", min: 1, message: "Debe ser mayor que cero" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (getFieldValue("tipo") === "salida" && value > product.stock_actual) {
                  return Promise.reject(
                    new Error(`Stock insuficiente: disponible ${product.stock_actual}`)
                  );
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber min={1} precision={0} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Motivo (opcional)" name="motivo" rules={[{ max: 255 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>

        {puedeFijarCosto && tipo !== "salida" && (
          <Form.Item
            label="Costo unitario (opcional)"
            name="costo_unitario"
            rules={[{ type: "number", min: 0, message: "No puede ser negativo" }]}
            extra="Si lo dejas vacío se usa el costo del producto."
          >
            <InputNumber min={0} step={100} style={{ width: "100%" }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}