import { useState } from "react";
import { Form, Input, Modal, message } from "antd";
import { isAxiosError } from "axios";
import { changePassword } from "@/services/authService";
import { getErrorMessage } from "@/utils/errors";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ChangePasswordModal({ onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setSaving(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      onSaved();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        form.setFields([{ name: "currentPassword", errors: [getErrorMessage(err)] }]);
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
      title="Cambiar contraseña"
      okText="Guardar"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
    >
      {contextHolder}
      <Form form={form} layout="vertical" autoComplete="off" onFinish={handleOk}>
        <Form.Item
          label="Contraseña actual"
          name="currentPassword"
          rules={[{ required: true, message: "Ingresa tu contraseña actual" }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>

        <Form.Item
          label="Nueva contraseña"
          name="newPassword"
          dependencies={["currentPassword"]}
          rules={[
            { required: true, message: "Ingresa la nueva contraseña" },
            { min: 8, message: "Mínimo 8 caracteres" },
            { max: 72, message: "Máximo 72 caracteres" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (value && value === getFieldValue("currentPassword")) {
                  return Promise.reject(new Error("Debe ser distinta a la actual"));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          label="Confirmar nueva contraseña"
          name="confirmPassword"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: "Confirma la nueva contraseña" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value === getFieldValue("newPassword")) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Las contraseñas no coinciden"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}