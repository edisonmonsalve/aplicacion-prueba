import { useEffect, useState } from "react";
// import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Typography, message } from "antd";
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
import { createQuote, getQuote, updateQuote } from "@/services/quotesService";
import { getProducts } from "@/services/productsService";
import { fetchProductsByIds, productOptionLabel } from "@/utils/productLookup";
import StockTag from "@/components/StockTag";
import type { QuoteLineForm } from "@/types";
import { money } from "./QuoteUtils";

interface ProductOpt {
  id: number;
  sku: string;
  nombre: string;
  precio: number;
  stock_actual?: number;
  stock_minimo?: number;
}
interface FormValues {
  cliente_nombre: string;
  cliente_documento?: string;
  fecha_validez: Dayjs;
  lineas: Partial<QuoteLineForm>[];
  cliente_email?: string;
  notas?: string;
}

const lineTotal = (l: Partial<QuoteLineForm>) => {
  const base = (l.cantidad ?? 0) * (l.precio_unitario ?? 0);
  const net = base - (base * (l.descuento_pct ?? 0)) / 100;
  return net + (net * (l.impuesto_pct ?? 0)) / 100;
};

const totals = (ls: Partial<QuoteLineForm>[]) =>
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

export default function QuoteFormPage() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [products, setProducts] = useState<Record<number, ProductOpt>>({});
  const [saving, setSaving] = useState(false);
  const lineas = Form.useWatch("lineas", form) ?? [];
  const { token } = theme.useToken();
  const t = totals(lineas);

  const search = async (q: string) => {
    try {
      const r = await getProducts({ q, page: 1, pageSize: 20 });
      setProducts((prev) => ({ ...prev, ...Object.fromEntries(r.data.map((p: ProductOpt) => [p.id, p])) }));
    } catch {
      message.error("No se pudo buscar productos");
    }
  };

  useEffect(() => {
    search("");
    if (!editId) return;
    getQuote(editId)
      .then((d) => {
        if (d.estado !== "borrador") {
          message.error("Solo se pueden editar borradores");
          navigate(`/cotizaciones/${editId}`, { replace: true });
          return;
        }
        setProducts((prev) => ({
          ...prev,
          ...Object.fromEntries(
            d.items
              .filter((l) => l.product_id)
              .map((l) => [
                l.product_id!,
                { id: l.product_id!, sku: l.sku, nombre: l.nombre, precio: l.precio_unitario },
              ])
          ),
        }));
        // Completar el stock real de los productos de las líneas. Se consulta
        // por lote de ids: así las líneas autocompletadas muestran el stock y
        // las alertas funcionan igual que en las agregadas a mano.
        const ids = d.items
          .filter((l) => l.product_id)
          .map((l) => l.product_id!);
        if (ids.length > 0) {
          fetchProductsByIds(ids)
            .then((byId) =>
              setProducts((prev) => ({ ...prev, ...byId }))
            )
            .catch(() => {});
        }
        form.setFieldsValue({
          cliente_nombre: d.customer_nombre,
          cliente_documento: d.customer_documento ?? undefined,
          fecha_validez: dayjs(d.fecha_validez),
          lineas: d.items.map((l) => ({
            product_id: l.product_id ?? undefined,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            descuento_pct: l.descuento_pct,
            impuesto_pct: l.impuesto_pct,
          })),
        });
      })
      .catch(() => {
        message.error("No se pudo cargar la cotización");
        navigate("/cotizaciones", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const onProductChange = (name: number, pid: number) => {
    const p = products[pid];
    if (!p) return;
    const arr = form.getFieldValue("lineas");
    arr[name] = { ...arr[name], precio_unitario: p.precio };
    form.setFieldsValue({ lineas: arr });
  };

  const onFinish = async (v: FormValues) => {
    const payload = {
      cliente_nombre: v.cliente_nombre.trim(),
      cliente_documento: v.cliente_documento?.trim() || undefined,
      fecha_validez: v.fecha_validez.format("YYYY-MM-DD"),
      // El servidor toma el precio del catálogo; nunca se envía el del formulario
      lineas: v.lineas.map((l) => ({
        product_id: l.product_id!,
        cantidad: l.cantidad!,
        descuento_pct: l.descuento_pct ?? 0,
        impuesto_pct: l.impuesto_pct ?? 0,
      })),
      cliente_email: v.cliente_email?.trim() || undefined,
      notas: v.notas?.trim() || undefined,
    };
    setSaving(true);
    try {
      const r = editId ? await updateQuote(editId, payload) : await createQuote(payload);
      message.success(editId ? "Cotización actualizada" : "Borrador creado");
      navigate(`/cotizaciones/${r.id ?? editId}`);
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
    <Card title={editId ? "Editar cotización" : "Nueva cotización"}>
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ fecha_validez: dayjs().add(15, "day"), lineas: [{}] }}
      >
        <Space wrap align="start">
          <Form.Item
            name="cliente_nombre"
            label="Cliente"
            tooltip="Nombre del cliente para la cotización."
            rules={[
              { required: true, message: "Requerido" },
              { min: 2, message: "Mínimo 2 caracteres" },
            ]}
          >
            <Input style={{ width: 280 }} />
          </Form.Item>
          <Form.Item
            name="cliente_documento"
            label="Documento"
            tooltip="Documento de identidad o NIT del cliente (opcional)."
          >
            <Input style={{ width: 180 }} />
          </Form.Item>
          <Form.Item
            name="cliente_email"
            label="Email"
            tooltip="Correo de contacto del cliente (opcional)."
            rules={[{ type: "email", message: "Email inválido" }, { max: 150 }]}
          >
            <Input style={{ width: 280 }} />
          </Form.Item>

          <Form.Item
            name="fecha_validez"
            label="Válido hasta"
            tooltip="Fecha hasta la que la cotización es válida."
            rules={[{ required: true, message: "Requerido" }]}
          >
            <DatePicker format="YYYY-MM-DD" />
          </Form.Item>
        </Space>

        <Form.Item
          name="notas"
          label="Notas"
          tooltip="Observaciones o condiciones adicionales para el cliente."
          rules={[{ max: 2000 }]}
        >
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>

        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Agrega productos a la cotización. El precio se toma del catálogo y no es editable. Descuento e impuesto se
          aplican por línea.
        </Typography.Paragraph>
        <Form.List
          name="lineas"
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
                    tooltip="Producto cotizado."
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
                        label: productOptionLabel(p),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name={[name, "cantidad"]}
                    label="Cantidad"
                    rules={[{ required: true, message: "Cant." }]}
                    tooltip="Cantidad de unidades."
                  >
                    <InputNumber min={1} placeholder="Cant." />
                  </Form.Item>
                  <Form.Item
                    name={[name, "precio_unitario"]}
                    label="Precio unit."
                    rules={[{ required: true, message: "Precio" }]}
                    extra="Tomado del catálogo"
                    tooltip="Precio unitario del catálogo (solo lectura)."
                  >
                    <InputNumber min={0} placeholder="Precio" style={{ width: 130 }} disabled />
                  </Form.Item>
                  <Form.Item
                    name={[name, "descuento_pct"]}
                    label="Descuento"
                    initialValue={0}
                    tooltip="Descuento porcentual de la línea."
                  >
                    <InputNumber min={0} max={100} addonAfter="% desc." />
                  </Form.Item>
                  <Form.Item
                    name={[name, "impuesto_pct"]}
                    label="Impuesto"
                    initialValue={19}
                    tooltip="Impuesto porcentual de la línea (IVA 19 % por defecto, editable)."
                  >
                    <InputNumber min={0} max={100} addonAfter="% imp." />
                  </Form.Item>
                  <div style={{ minWidth: 110, textAlign: "right" }}>
                    <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                      Total línea
                    </Typography.Text>
                    <Typography.Text strong style={{ lineHeight: "32px" }}>
                      {money(lineTotal(lineas[name] ?? {}))}
                    </Typography.Text>
                  </div>
                  {(() => {
                    const l = lineas[name];
                    const p = l?.product_id ? products[l.product_id] : undefined;
                    if (!p || p.stock_actual === undefined) return null;
                    return (
                      <div style={{ marginTop: 30 }}>
                        <StockTag
                          stockActual={p.stock_actual}
                          stockMinimo={p.stock_minimo}
                          solicitado={l?.cantidad}
                        />
                      </div>
                    );
                  })()}
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
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ descuento_pct: 0, impuesto_pct: 19 })}
                >
                  Agregar línea
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Card size="small" style={{ maxWidth: 360, marginLeft: "auto", marginBottom: 16 }}>
          {[
            { label: "Subtotal", value: t.subtotal, hint: "Suma de cantidad × precio de cada línea" },
            { label: "Descuento", value: -t.descuento, hint: "Descuentos aplicados por línea" },
            { label: "Impuestos", value: t.impuesto, hint: "Impuestos aplicados por línea" },
          ].map(({ label, value, hint }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
              <Tooltip title={hint}>
                <span>{label}</span>
              </Tooltip>
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
            <Tooltip title="Total final de la cotización">
              <span>Total</span>
            </Tooltip>
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
            <Button onClick={() => navigate(editId ? `/cotizaciones/${editId}` : "/cotizaciones")}>
              Cancelar
            </Button>
          </Space>
        </div>
      </Form>
    </Card>
  );
}
