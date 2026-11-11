import { useEffect, useState } from "react";
import { Form, Input, InputNumber, Modal, Select, Switch, message } from "antd";
import { createFinanceAccount, updateFinanceAccount } from "@/services/financeService";
import { getErrorMessage } from "@/utils/errors";
import type { FinanceAccount, FinanceAccountInput } from "@/types";

interface Props {
  open: boolean;
  account?: FinanceAccount;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  nombre: string;
  tipo: "caja" | "banco";
  saldo_inicial: number;
  activo: boolean;
}

export default function AccountFormModal({ open, account, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (account) {
      form.setFieldsValue({
        nombre: account.nombre,
        tipo: (account.tipo as "caja" | "banco") ?? "caja",
        saldo_inicial: account.saldo_inicial,
        activo: account.activo === 1,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ tipo: "caja", saldo_inicial: 0, activo: true });
    }
  }, [open, account, form]);

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const input: FinanceAccountInput = {
      nombre: values.nombre.trim(),
      tipo: values.tipo,
      saldo_inicial: values.saldo_inicial ?? 0,
      activo: values.activo,
    };
    setSaving(true);
    try {
      if (account) {
        await updateFinanceAccount(account.id, input);
        messageApi.success("Cuenta actualizada");
      } else {
        await createFinanceAccount(input);
        messageApi.success("Cuenta creada");
      }
      onSaved();
      onClose();
    } catch (err) {
      messageApi.error(getErrorMessage(err, "No se pudo guardar la cuenta"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={account ? "Editar cuenta" : "Nueva cuenta"}
      okText={account ? "Guardar" : "Crear"}
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
      destroyOnClose
    >
      {contextHolder}
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="Nombre"
          name="nombre"
          tooltip="Nombre único de la cuenta de caja o banco."
          rules={[{ required: true, min: 2, max: 100 }]}
        >
          <Input placeholder="Ej. Caja principal" />
        </Form.Item>
        <Form.Item label="Tipo" name="tipo" tooltip="Caja (efectivo) o banco." rules={[{ required: true }]}>
          <Select
            options={[
              { value: "caja", label: "Caja" },
              { value: "banco", label: "Banco" },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="Saldo inicial"
          name="saldo_inicial"
          tooltip="Saldo con el que abre la cuenta. Solo ingresos y gastos modifican el saldo actual; el IVA no."
          rules={[{ required: true }, { type: "number", min: 0 }]}
        >
          <InputNumber min={0} prefix="$" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          label="Activa"
          name="activo"
          valuePropName="checked"
          tooltip="Una cuenta inactiva no participa del capital disponible."
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
