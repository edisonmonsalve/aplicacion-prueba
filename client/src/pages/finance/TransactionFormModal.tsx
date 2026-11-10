import { useEffect, useMemo, useState } from "react";
import { Alert, Form, Input, InputNumber, Modal, Select, message, DatePicker } from "antd";
import dayjs from "dayjs";
import { getFinanceAccounts, getFinanceCategories, listBudgets } from "@/services/financeService";
import { getProducts } from "@/services/productsService";
import { getErrorMessage } from "@/utils/errors";
import { money } from "./FinanceUtils";
import type { BudgetListItem, FinanceAccount, FinanceCategory, TransactionInput } from "@/types";
import type { Product } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  tipo: FinanceCategory["tipo"];
  monto: number;
  fecha: dayjs.Dayjs;
  finance_category_id?: number;
  account_id?: number;
  product_id?: number;
  descripcion?: string;
}

export default function TransactionFormModal({ open, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [productOptions, setProductOptions] = useState<{ value: number; label: string }[]>([]);
  const [closedBudgets, setClosedBudgets] = useState<BudgetListItem[]>([]);
  const tipo = Form.useWatch("tipo", form) ?? "ingreso";
  const fecha = Form.useWatch("fecha", form);

  const closedPeriod = useMemo(() => {
    if (!fecha) return undefined;
    const day = fecha.format("YYYY-MM-DD");
    return closedBudgets.find((b) => b.fecha_inicio <= day && b.fecha_fin >= day);
  }, [fecha, closedBudgets]);

  useEffect(() => {
    if (!open) return;
    getFinanceAccounts()
      .then((a) => setAccounts(a.filter((x) => x.activo)))
      .catch(() => messageApi.error("No se pudieron cargar las cuentas"));
    getFinanceCategories()
      .then(setCategories)
      .catch(() => messageApi.error("No se pudieron cargar las categorías"));
    getProducts({ page: 1, pageSize: 100 })
      .then((r) => setProductOptions(r.data.map((p: Product) => ({ value: p.id, label: `${p.sku} · ${p.nombre}` }))))
      .catch(() => messageApi.error("No se pudieron cargar los productos"));
    listBudgets({ page: 1, pageSize: 100, estado: "cerrado" })
      .then((r) => setClosedBudgets(r.data))
      .catch(() => {});
  }, [open, messageApi]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ tipo: "ingreso", fecha: dayjs(), monto: undefined });
  }, [open, form]);

  // Limpia la categoría si cambia el tipo
  useEffect(() => {
    if (!open) return;
    const cat = form.getFieldValue("finance_category_id");
    const valid = categories.find((c) => c.id === cat && c.tipo === tipo);
    if (!valid) form.setFieldValue("finance_category_id", undefined);
  }, [tipo, categories, form, open]);

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (closedPeriod) {
      messageApi.error(`El periodo "${closedPeriod.nombre}" está cerrado y no admite transacciones`);
      return;
    }
    const input: TransactionInput = {
      tipo: values.tipo,
      monto: values.monto,
      fecha: values.fecha.format("YYYY-MM-DD"),
      finance_category_id: values.finance_category_id!,
      account_id: values.account_id!,
      product_id: values.product_id ?? null,
      descripcion: values.descripcion || undefined,
    };
    setSaving(true);
    try {
      const finance = await import("@/services/financeService");
      await finance.createTransaction(input);
      messageApi.success("Transacción registrada");
      onSaved();
      onClose();
    } catch (err) {
      messageApi.error(getErrorMessage(err, "No se pudo registrar la transacción"));
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = categories.filter((c) => c.activo && c.tipo === tipo);

  return (
    <Modal
      open={open}
      title="Nueva transacción"
      okText="Registrar"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
      destroyOnClose
    >
      {contextHolder}
      {closedPeriod && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`El periodo "${closedPeriod.nombre}" está cerrado`}
          description="No admite nuevas transacciones. Elige una fecha fuera de ese periodo."
        />
      )}
      <Form form={form} layout="vertical" initialValues={{ tipo: "ingreso", fecha: dayjs() }}>
        <Form.Item label="Tipo" name="tipo" tooltip="Ingreso suma capital, gasto lo reduce. Activo y pasivo son asientos de balance (por ejemplo IVA) y no afectan la caja." rules={[{ required: true }]}>
          <Select
            options={[
              { value: "ingreso", label: "Ingreso" },
              { value: "gasto", label: "Gasto" },
              { value: "activo", label: "Activo" },
              { value: "pasivo", label: "Pasivo" },
            ]}
          />
        </Form.Item>
        <Form.Item label="Monto" name="monto" tooltip="Importe de la transacción en COP." rules={[{ required: true }, { type: "number", min: 0.01 }]}>
          <InputNumber min={0.01} prefix="$" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Fecha" name="fecha" tooltip="Fecha de la transacción." rules={[{ required: true }]}>
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: "100%" }}
            disabledDate={(current) => {
              const day = current.format("YYYY-MM-DD");
              return closedBudgets.some((b) => b.fecha_inicio <= day && b.fecha_fin >= day);
            }}
          />
        </Form.Item>
        <Form.Item label="Categoría" name="finance_category_id" tooltip="Categoría financiera de la transacción." rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={filteredCategories.map((c) => ({ value: c.id, label: c.nombre }))}
          />
        </Form.Item>
        <Form.Item
          label="Cuenta"
          name="account_id"
          tooltip="Cuenta financiera afectada."
          extra="El saldo de caja se actualiza solo con ingresos y gastos; activo y pasivo no lo modifican."
          rules={[{ required: true }]}
        >
          <Select
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.nombre} · ${money(a.saldo_actual)}`,
            }))}
          />
        </Form.Item>
        <Form.Item label="Producto (opcional)" name="product_id" tooltip="Producto asociado a la transacción (opcional).">
          <Select allowClear showSearch optionFilterProp="label" options={productOptions} />
        </Form.Item>
        <Form.Item label="Descripción (opcional)" name="descripcion" tooltip="Descripción libre de la transacción." rules={[{ max: 255 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
