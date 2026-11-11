import { useEffect } from "react";
import {
  App,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { createInvoicePayment } from "@/services/invoicesService";
import { getErrorMessage } from "@/utils/errors";
import type { FinanceAccount, InvoiceDetail, PaymentInput, PaymentMetodo } from "@/types";
import { money } from "./InvoiceUtils";

const METODO_OPTIONS: { value: PaymentMetodo; label: string }[] = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

interface FormValues {
  fecha: Dayjs;
  monto: number;
  account_id?: number;
  metodo: PaymentMetodo;
  referencia?: string;
  notas?: string;
}

interface Props {
  open: boolean;
  invoice: InvoiceDetail;
  accounts: FinanceAccount[];
  onCancel: () => void;
  onSaved: () => void;
}

/**
 * Registro de un cobro (venta) o pago (compra) sobre una factura a crédito.
 *
 * El monto se limita al saldo pendiente: el servidor rechaza sobrepagos, pero
 * el formulario evita el error antes de enviar. El asiento mueve caja y no
 * vuelve a reconocer resultado.
 */
export default function PaymentModal({ open, invoice, accounts, onCancel, onSaved }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const esVenta = invoice.tipo === "venta";
  const saldo = Number(invoice.saldo_pendiente ?? 0);
  const activas = accounts.filter((a) => a.activo);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      fecha: dayjs(),
      monto: saldo > 0 ? saldo : undefined,
      metodo: "transferencia",
      account_id: invoice.account_id ?? activas[0]?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.id]);

  const save = async () => {
    const values = await form.validateFields();
    const input: PaymentInput = {
      fecha: values.fecha.format("YYYY-MM-DD"),
      monto: Number(values.monto),
      account_id: values.account_id ?? null,
      metodo: values.metodo,
      referencia: values.referencia?.trim() || undefined,
      notas: values.notas?.trim() || undefined,
    };
    try {
      await createInvoicePayment(invoice.id, input);
      message.success(esVenta ? "Cobro registrado" : "Pago registrado");
      onSaved();
    } catch (err) {
      message.error(getErrorMessage(err, "No se pudo registrar el movimiento"));
    }
  };

  return (
    <Modal
      title={esVenta ? `Registrar cobro · ${invoice.numero}` : `Registrar pago · ${invoice.numero}`}
      open={open}
      onCancel={onCancel}
      onOk={save}
      okText={esVenta ? "Registrar cobro" : "Registrar pago"}
      cancelText="Cancelar"
      destroyOnHidden
    >
      <Space direction="vertical" size={2} style={{ marginBottom: 12 }}>
        <span>
          Saldo pendiente: <strong>{money(saldo)}</strong>
        </span>
        <span style={{ color: "#888" }}>
          {esVenta
            ? "El cobro entra a la cuenta elegida y no vuelve a sumar al resultado."
            : "El pago sale de la cuenta elegida y no vuelve a restar del resultado."}
        </span>
      </Space>

      <Form<FormValues> form={form} layout="vertical">
        <Space wrap align="start">
          <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="monto"
            label="Monto"
            rules={[
              { required: true, message: "Requerido" },
              {
                type: "number",
                min: 0.01,
                max: saldo,
                message: `Debe estar entre 0.01 y ${saldo.toFixed(2)}`,
              },
            ]}
          >
            <InputNumber
              min={0.01}
              max={saldo}
              step={0.01}
              precision={2}
              style={{ width: 160 }}
              formatter={(v) => (v === undefined || v === null ? "" : `${v}`)}
            />
          </Form.Item>
          <Form.Item name="metodo" label="Método" rules={[{ required: true }]}>
            <Select style={{ width: 160 }} options={METODO_OPTIONS} />
          </Form.Item>
        </Space>

        <Form.Item
          name="account_id"
          label={esVenta ? "Cuenta que recibe" : "Cuenta que paga"}
          rules={[{ required: true, message: "Selecciona una cuenta" }]}
        >
          <Select
            placeholder="Caja o banco"
            options={activas.map((a) => ({
              value: a.id,
              label: `${a.nombre} (${a.tipo}) · ${money(a.saldo_actual)}`,
            }))}
          />
        </Form.Item>

        <Space wrap align="start">
          <Form.Item name="referencia" label="Referencia">
            <Input style={{ width: 220 }} maxLength={100} placeholder="N.º transferencia, recibo…" />
          </Form.Item>
          <Form.Item name="notas" label="Notas">
            <Input style={{ width: 260 }} maxLength={500} />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}
