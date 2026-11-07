import { useEffect, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { getFinanceCategories } from "@/services/financeService";
import { getProducts } from "@/services/productsService";
import { getErrorMessage } from "@/utils/errors";
import type { BudgetDetail, BudgetInput, FinanceCategory } from "@/types";
import { periodLabel } from "./FinanceUtils";

interface Props {
  open: boolean;
  budget?: BudgetDetail;
  onClose: () => void;
  onSaved: (id: number) => void;
}

interface LineValues {
  finance_category_id?: number;
  product_id?: number;
  monto_planeado?: number;
}

interface FormValues {
  nombre: string;
  tipo_periodo: "dia" | "semana" | "mes" | "anio";
  fechas: [Dayjs, Dayjs];
  ingreso_meta: number;
  alerta_pct: number;
  lineas: LineValues[];
}

export default function BudgetFormModal({ open, budget, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [productOptions, setProductOptions] = useState<{ value: number; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    getFinanceCategories()
      .then(setCategories)
      .catch(() => messageApi.error("No se pudieron cargar las categorías"));
    getProducts({ page: 1, pageSize: 100 })
      .then((r) => {
        setProductOptions(r.data.map((p) => ({ value: p.id, label: `${p.sku} · ${p.nombre}` })));
      })
      .catch(() => messageApi.error("No se pudieron cargar los productos"));
  }, [open, messageApi]);

  useEffect(() => {
    if (!open) return;
    if (!budget) {
      form.resetFields();
      form.setFieldsValue({
        tipo_periodo: "mes",
        alerta_pct: 80,
        ingreso_meta: 0,
        lineas: [{}],
      });
      return;
    }
    const opts = [...productOptions];
    for (const l of budget.lineas) {
      if (l.product_id && !opts.some((o) => o.value === l.product_id)) {
        opts.push({ value: l.product_id, label: `${l.sku ?? ""} · ${l.producto ?? ""}`.trim() });
      }
    }
    setProductOptions(opts);
    form.setFieldsValue({
      nombre: budget.nombre,
      tipo_periodo: budget.tipo_periodo,
      fechas: [dayjs(budget.fecha_inicio), dayjs(budget.fecha_fin)],
      ingreso_meta: budget.ingreso_meta,
      alerta_pct: budget.alerta_pct,
      lineas: budget.lineas.map((l) => ({
        finance_category_id: l.finance_category_id,
        product_id: l.product_id ?? undefined,
        monto_planeado: l.monto_planeado,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, budget]);

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const input: BudgetInput = {
      nombre: values.nombre,
      tipo_periodo: values.tipo_periodo,
      fecha_inicio: values.fechas[0].format("YYYY-MM-DD"),
      fecha_fin: values.fechas[1].format("YYYY-MM-DD"),
      ingreso_meta: values.ingreso_meta ?? 0,
      alerta_pct: values.alerta_pct ?? 80,
      lineas: (values.lineas ?? [])
        .filter((l) => l && l.finance_category_id && l.monto_planeado !== undefined)
        .map((l) => ({
          finance_category_id: l.finance_category_id!,
          product_id: l.product_id ?? null,
          monto_planeado: l.monto_planeado!,
        })),
    };

    setSaving(true);
    try {
      const finance = await import("@/services/financeService");
      const res = budget ? await finance.updateBudget(budget.id, input) : await finance.createBudget(input);
      messageApi.success(budget ? "Presupuesto actualizado" : "Presupuesto creado");
      onSaved(res.id);
      onClose();
    } catch (err) {
      messageApi.error(getErrorMessage(err, "No se pudo guardar el presupuesto"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={budget ? "Editar presupuesto" : "Nuevo presupuesto"}
      width={860}
      okText={budget ? "Guardar" : "Crear"}
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
      destroyOnClose
    >
      {contextHolder}
      <Form form={form} layout="vertical" initialValues={{ tipo_periodo: "mes", alerta_pct: 80, ingreso_meta: 0, lineas: [] }}>
        <Space style={{ width: "100%" }} size="middle" wrap>
          <Form.Item
            label="Nombre"
            name="nombre"
            tooltip="Nombre descriptivo del presupuesto para el periodo."
            rules={[{ required: true, min: 2, max: 150 }]}
            style={{ flex: 2, minWidth: 260, marginBottom: 12 }}
          >
            <Input placeholder="Ej. Presupuesto de noviembre" />
          </Form.Item>
          <Form.Item label="Periodo" name="tipo_periodo" tooltip="Granularidad del periodo que cubre el presupuesto." rules={[{ required: true }]} style={{ width: 140, marginBottom: 12 }}>
            <Select options={["dia", "semana", "mes", "anio"].map((p) => ({ value: p, label: periodLabel(p as "dia" | "semana" | "mes" | "anio") }))} />
          </Form.Item>
        </Space>

        <Form.Item label="Rango del periodo" name="fechas" tooltip="Fechas de inicio y fin del periodo presupuestado." rules={[{ required: true }]}>
          <DatePicker.RangePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
        </Form.Item>

        <Space style={{ width: "100%" }} size="middle" wrap>
          <Form.Item label="Meta de ingresos" name="ingreso_meta" tooltip="Ingreso total esperado en el periodo." style={{ flex: 1, minWidth: 180 }}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="Alerta (%)"
            name="alerta_pct"
            tooltip="Porcentaje de ejecución a partir del cual se marca la línea en alerta."
            rules={[{ required: true }, { type: "number", min: 1, max: 100 }]}
            style={{ width: 140 }}
          >
            <InputNumber min={1} max={100} style={{ width: "100%" }} />
          </Form.Item>
        </Space>

        <Typography.Title level={5} style={{ marginTop: 8 }}>
          Líneas del presupuesto
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Añade una línea por cada categoría o producto que quieras planificar. Si eliges un producto, el monto se
          asocia a ese producto; si no, cubre toda la categoría. No mezcles líneas generales y por producto en la
          misma categoría (evita doble conteo).
        </Typography.Paragraph>

        <Form.List name="lineas">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Space key={key} align="baseline" style={{ display: "flex", marginBottom: 8 }} wrap>
                  <Form.Item
                    {...rest}
                    name={[name, "finance_category_id"]}
                    label="Categoría"
                    tooltip="Categoría financiera que se planifica."
                    rules={[{ required: true, message: "Categoría" }]}
                    style={{ flex: 2, minWidth: 220 }}
                  >
                    <Select
                      placeholder="Categoría financiera"
                      options={categories.map((c) => ({
                        value: c.id,
                        label: `${c.tipo === "ingreso" ? "Ingreso" : "Gasto"} · ${c.nombre}`,
                      }))}
                      showSearch
                      optionFilterProp="label"
                    />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, "product_id"]} label="Producto" tooltip="Producto específico de la línea (opcional)." style={{ flex: 2, minWidth: 220 }}>
                    <Select
                      placeholder="Producto (opcional)"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={productOptions}
                    />
                  </Form.Item>
                  <Form.Item
                    {...rest}
                    name={[name, "monto_planeado"]}
                    label="Monto planeado"
                    tooltip="Monto planeado para la línea."
                    rules={[{ required: true, message: "Monto" }, { type: "number", min: 0 }]}
                    style={{ width: 160 }}
                  >
                    <InputNumber min={0} style={{ width: "100%" }} placeholder="Monto" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f" }} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                Añadir línea
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
