import { useEffect, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tooltip,
  Typography,
  message,
  theme,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { createInvoice, getInvoice, updateInvoice } from "@/services/invoicesService";
import { getProducts } from "@/services/productsService";
import type { InvoiceTipo } from "@/types";
import { TIPO_OPTIONS, money } from "./InvoiceUtils";

interface ProductOpt {
  id: number;
  sku: string;
  nombre: string;
  precio: number;
  costo: number | null;
}

interface LineForm {
  product_id?: number;
  cantidad?: number;
  precio_unitario?: number;
  descuento_pct?: number;
  impuesto_pct?: number;
}

interface FormValues {
  tipo: InvoiceTipo;
  fecha: Dayjs;
  contraparte: string;
  documento?: string;
  email?: string;
  notas?: string;
  items: LineForm[];
}

const lineTotal = (l: LineForm) => {
  const base = (l.cantidad ?? 0) * (l.precio_unitario ?? 0);
  const net = base - (base * (l.descuento_pct ?? 0)) / 100;
  return net + (net * (l.impuesto_pct ?? 0)) / 100;
};

const totals = (ls: LineForm[]) =>
  ls.reduce(
    (t, l) => {
      const x = l ?? {};
      const base = (x.cantidad ?? 0) * (x.precio_unitario ?? 0);
      const desc = (base * (x.descuento_pct ?? 0)) / 100;
      const imp = ((base - desc) * (x.impuesto_pct ?? 0)) / 100;
      return {
        subtotal: t.subtotal + base,
        descuento: t.descuento + desc,
        impuesto: t.impuesto + imp,
        total: t.total + base - desc + imp,
      };
    },
    { subtotal: 0, descuento: 0, impuesto: 0, total: 0 }
  );

export default function InvoiceFormPage() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [products, setProducts] = useState<Record<number, ProductOpt>>({});
  const [saving, setSaving] = useState(false);
  const lineas = Form.useWatch("items", form) ?? [];
  const tipo = Form.useWatch("tipo", form);
  const { token } = theme.useToken();
  const t = totals(lineas);

  const search = async (q: string) => {
    try {
      const r = await getProducts({ q, page: 1, pageSize: 20 });
      setProducts((prev) => ({ ...prev, ...Object.fromEntries(r.data.map((p: any) => [p.id, p])) }));
    } catch {
      message.error("No se pudo buscar productos");
    }
  };

  useEffect(() => {
    search("");
    if (!editId) return;
    getInvoice(editId)
      .then((d) => {
        if (d.estado !== "borrador") {
          message.error("Solo se pueden editar facturas en borrador");
          navigate(`/facturas/${editId}`, { replace: true });
          return;
        }
        setProducts((prev) => ({
          ...prev,
          ...Object.fromEntries(
            d.items
              .filter((l) => l.product_id)
              .map((l) => [
                l.product_id,
                { id: l.product_id, sku: l.sku ?? "", nombre: l.producto ?? "", precio: l.precio_unitario, costo: l.precio_unitario },
              ])
          ),
        }));
        form.setFieldsValue({
          tipo: d.tipo,
          fecha: dayjs(d.fecha),
          contraparte: d.contraparte,
          documento: d.documento ?? undefined,
          email: d.email ?? undefined,
          notas: d.notas ?? undefined,
          items: d.items.map((l) => ({
            product_id: l.product_id,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            descuento_pct: l.descuento_pct,
            impuesto_pct: l.impuesto_pct,
          })),
        });
      })
      .catch(() => {
        message.error("No se pudo cargar la factura");
        navigate("/facturas", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const onProductChange = (name: number, pid: number) => {
    const p = products[pid];
    if (!p) return;
    const arr = [...(form.getFieldValue("items") ?? [])];
    const suggested = tipo === "compra" ? (p.costo ?? p.precio) : p.precio;
    arr[name] = { ...arr[name], precio_unitario: suggested };
    form.setFieldsValue({ items: arr });
  };

  const onFinish = async (v: FormValues) => {
    const payload = {
      tipo: v.tipo,
      fecha: v.fecha.format("YYYY-MM-DD"),
      contraparte: v.contraparte.trim(),
      documento: v.documento?.trim() || undefined,
      email: v.email?.trim() || undefined,
      notas: v.notas?.trim() || undefined,
      items: v.items.map((l) => ({
        product_id: l.product_id!,
        cantidad: l.cantidad!,
        precio_unitario: l.precio_unitario!,
        descuento_pct: l.descuento_pct ?? 0,
        impuesto_pct: l.impuesto_pct ?? 0,
      })),
    };
    setSaving(true);
    try {
      const r = editId ? await updateInvoice(editId, payload) : await createInvoice(payload);
      message.success(editId ? "Factura actualizada" : "Borrador creado");
      navigate(`/facturas/${r.id ?? editId}`);
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(msg ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={editId ? "Editar factura" : "Nueva factura"}>
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ tipo: "venta", fecha: dayjs(), items: [{}] }}
      >
        <Space wrap align="start">
          <Form.Item
            name="tipo"
            label="Tipo"
            rules={[{ required: true }]}
            tooltip="Venta genera ingreso y descuenta stock al confirmar. Compra genera gasto, suma stock y actualiza costo."
          >
            <Select style={{ width: 160 }} options={TIPO_OPTIONS} disabled={!!editId} />
          </Form.Item>
          <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]}>
            <DatePicker format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="contraparte"
            label={tipo === "compra" ? "Proveedor" : "Cliente"}
            rules={[{ required: true, message: "Requerido" }, { min: 2, message: "Mínimo 2 caracteres" }]}
          >
            <Input style={{ width: 280 }} />
          </Form.Item>
          <Form.Item name="documento" label="Documento">
            <Input style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Email inválido" }]}>
            <Input style={{ width: 240 }} />
          </Form.Item>
        </Space>

        <Form.Item name="notas" label="Notas">
          <Input.TextArea rows={2} maxLength={2000} showCount />
        </Form.Item>

        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {tipo === "compra"
            ? "Registra los productos comprados. El precio unitario es el costo de compra (actualiza el costo del producto al confirmar)."
            : "Registra los productos vendidos. Al confirmar se descuenta stock y se genera el ingreso."}
        </Typography.Paragraph>

        <Form.List
          name="items"
          rules={[
            {
              validator: async (_, v) => {
                if (!v?.length) throw new Error("Agrega al menos una línea");
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map(({ key, name }) => (
                <Space key={key} align="start" wrap>
                  <Form.Item
                    name={[name, "product_id"]}
                    label="Producto"
                    rules={[{ required: true, message: "Producto" }]}
                  >
                    <Select
                      showSearch
                      filterOption={false}
                      onSearch={search}
                      onChange={(pid: number) => onProductChange(name, pid)}
                      placeholder="Producto"
                      style={{ width: 280 }}
                      options={Object.values(products).map((p) => ({
                        value: p.id,
                        label: `${p.sku} — ${p.nombre}`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name={[name, "cantidad"]} label="Cantidad" rules={[{ required: true, message: "Cant." }]}>
                    <InputNumber min={1} />
                  </Form.Item>
                  <Form.Item
                    name={[name, "precio_unitario"]}
                    label={tipo === "compra" ? "Costo unit." : "Precio unit."}
                    rules={[{ required: true, message: "Precio" }]}
                    tooltip={tipo === "compra" ? "Costo de compra; al confirmar actualiza el costo del producto." : "Precio de venta por unidad."}
                  >
                    <InputNumber min={0.01} step={0.01} style={{ width: 140 }} />
                  </Form.Item>
                  <Form.Item name={[name, "descuento_pct"]} label="Desc." initialValue={0}>
                    <InputNumber min={0} max={100} addonAfter="%" />
                  </Form.Item>
                  <Form.Item name={[name, "impuesto_pct"]} label="Imp." initialValue={0}>
                    <InputNumber min={0} max={100} addonAfter="%" />
                  </Form.Item>
                  <div style={{ minWidth: 110, textAlign: "right" }}>
                    <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                      Total línea
                    </Typography.Text>
                    <Typography.Text strong style={{ lineHeight: "32px" }}>
                      {money(lineTotal(lineas[name] ?? {}))}
                    </Typography.Text>
                  </div>
                  <Tooltip title="Quitar esta línea">
                    <Button
                      type="text"
                      danger
                      aria-label="Quitar línea"
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(name)}
                      style={{ marginTop: 30 }}
                    />
                  </Tooltip>
                </Space>
              ))}
              <Form.ErrorList errors={errors} />
              <Form.Item>
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ descuento_pct: 0, impuesto_pct: 0 })}>
                  Agregar línea
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Card size="small" style={{ maxWidth: 360, marginLeft: "auto", marginBottom: 16 }}>
          {[
            { label: "Subtotal", value: t.subtotal },
            { label: "Descuento", value: -t.descuento },
            { label: "Impuestos", value: t.impuesto },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{label}</span>
              <span>{money(value)}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              fontWeight: 600,
              fontSize: 18,
            }}
          >
            <span>Total</span>
            <span>{money(t.total)}</span>
          </div>
        </Card>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            padding: "12px 0",
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Guardar
            </Button>
            <Button onClick={() => navigate(editId ? `/facturas/${editId}` : "/facturas")}>Cancelar</Button>
          </Space>
        </div>
      </Form>
    </Card>
  );
}
