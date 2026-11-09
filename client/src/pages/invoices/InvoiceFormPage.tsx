import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { isAxiosError } from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createInvoice, getInvoice, updateInvoice } from "@/services/invoicesService";
import { getProducts } from "@/services/productsService";
import { listQuotes, getQuote } from "@/services/quotesService";
import type { InvoiceTipo, Quote } from "@/types";
import { TIPO_OPTIONS, money } from "./InvoiceUtils";

interface ProductOpt {
  id: number;
  sku: string;
  nombre: string;
  precio: number;
  costo: number | null;
  stock_actual: number;
  stock_minimo: number;
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
  orden_compra?: string;
  email?: string;
  notas?: string;
  quote_id?: number | null;
  retencion_fuente?: number;
  retencion_iva?: number;
  retencion_ica?: number;
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
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [saving, setSaving] = useState(false);
  const loadedQuoteRef = useRef<number | null>(null);
  const lineas = Form.useWatch("items", form) ?? [];
  const tipo = Form.useWatch("tipo", form);
  const quoteIdForm = Form.useWatch("quote_id", form);

  // M3: retenciones prellenadas automáticamente según el tipo de factura.
  // Los porcentajes son parámetros configurables (no tarifas legales hardcodeadas sin confirmar);
  // por defecto 0 y siempre editables. Reducen el total_neto, son informativas.
  const DEFAULT_RETENCIONES: Record<InvoiceTipo, { fuente: number; iva: number; ica: number }> = {
    venta: { fuente: 0, iva: 0, ica: 0 },
    compra: { fuente: 0, iva: 0, ica: 0 },
  };

  useEffect(() => {
    if (editId) return;
    const defaults = DEFAULT_RETENCIONES[tipo ?? "venta"];
    form.setFieldsValue({
      retencion_fuente: form.getFieldValue("retencion_fuente") ?? defaults.fuente,
      retencion_iva: form.getFieldValue("retencion_iva") ?? defaults.iva,
      retencion_ica: form.getFieldValue("retencion_ica") ?? defaults.ica,
    });
  }, [tipo, editId, form]);

  const retencionFuente = Form.useWatch("retencion_fuente", form) ?? 0;
  const retencionIva = Form.useWatch("retencion_iva", form) ?? 0;
  const retencionIca = Form.useWatch("retencion_ica", form) ?? 0;
  const { token } = theme.useToken();
  const t = totals(lineas);
  const retenciones = (retencionFuente ?? 0) + (retencionIva ?? 0) + (retencionIca ?? 0);
  const totalNeto = Math.max(0, t.total - retenciones);

  const search = async (q: string) => {
    try {
      const r = await getProducts({ q, page: 1, pageSize: 20 });
      setProducts((prev) => ({ ...prev, ...Object.fromEntries(r.data.map((p: any) => [p.id, p])) }));
    } catch {
      message.error("No se pudo buscar productos");
    }
  };

  // Cotizaciones aprobadas o entregadas que pueden facturarse.
  useEffect(() => {
    if (tipo === "compra") return;
    listQuotes({ page: 1, pageSize: 100 })
      .then((r) => setQuotes(r.data.filter((x) => x.estado === "aprobado" || x.estado === "entregado")))
      .catch(() => {});
  }, [tipo]);

  const [searchParams] = useSearchParams();
  const urlQuoteId = searchParams.get("quote");
  const urlProductId = searchParams.get("product");

  const loadedProductRef = useRef<number | null>(null);

  // Reabastecimiento: al llegar desde un producto con stock bajo (?tipo=compra&product=id),
  // precarga una línea de compra con ese producto y su costo como precio unitario.
  useEffect(() => {
    if (editId) return;
    if (tipo !== "compra") return;
    const pid = urlProductId ? Number(urlProductId) : null;
    if (!pid || pid === loadedProductRef.current) return;
    const p = products[pid];
    if (!p) return;
    loadedProductRef.current = pid;
    const arr = [...(form.getFieldValue("items") ?? [])];
    if (arr.length === 1 && !arr[0]?.product_id) {
      arr[0] = {
        product_id: pid,
        cantidad: 1,
        precio_unitario: p.costo ?? p.precio,
        descuento_pct: 0,
        impuesto_pct: 0,
      };
      form.setFieldsValue({ items: arr });
    }
  }, [tipo, editId, urlProductId, products, form]);

  // M5/M6: al seleccionar (o llegar con ?quote=) una cotización en una factura de venta nueva,
  // precarga cliente, email, notas y líneas con los mismos valores de la cotización. El cliente
  // puede cambiar precios, cantidades y agregar productos (no se bloquean precios).
  useEffect(() => {
    if (editId) return; // edición: los datos ya vienen de la factura cargada
    if (tipo === "compra") return;
    const qid = quoteIdForm ?? (urlQuoteId ? Number(urlQuoteId) : null);
    if (!qid || qid === loadedQuoteRef.current) return;
    loadedQuoteRef.current = qid;

    getQuote(qid)
      .then((d) => {
        if (d.estado !== "aprobado" && d.estado !== "entregado") {
          message.warning("La cotización debe estar aprobada o entregada para facturarse");
          form.setFieldsValue({ quote_id: null });
          return;
        }
        form.setFieldsValue({
          contraparte: d.customer_nombre,
          email: d.customer_email ?? undefined,
          quote_id: d.id,
          notas: d.notas ?? undefined,
        });
        const items = d.items.map((l) => ({
          product_id: l.product_id!,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          descuento_pct: l.descuento_pct,
          impuesto_pct: l.impuesto_pct,
        }));
        form.setFieldsValue({ items });
        setProducts((prev) => ({
          ...prev,
          ...Object.fromEntries(
            d.items
              .filter((l) => l.product_id)
              .map((l) => [
                l.product_id!,
                {
                  id: l.product_id!,
                  sku: l.sku,
                  nombre: l.nombre,
                  precio: l.precio_unitario,
                  stock_actual: 0,
                },
              ])
          ),
        }));
      })
      .catch(() => {
        message.error("No se pudo cargar la cotización");
        loadedQuoteRef.current = null;
      });
  }, [quoteIdForm, urlQuoteId, editId, tipo, form, message]);

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
                { id: l.product_id, sku: l.sku ?? "", nombre: l.producto ?? "", precio: l.precio_unitario, costo: l.precio_unitario, stock_actual: 0 },
              ])
          ),
        }));
        form.setFieldsValue({
          tipo: d.tipo,
          fecha: dayjs(d.fecha),
          contraparte: d.contraparte,
          documento: d.documento ?? undefined,
          orden_compra: d.orden_compra ?? undefined,
          email: d.email ?? undefined,
          notas: d.notas ?? undefined,
          quote_id: d.quote_id ?? undefined,
          retencion_fuente: d.retencion_fuente,
          retencion_iva: d.retencion_iva,
          retencion_ica: d.retencion_ica,
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
      orden_compra: v.orden_compra?.trim() || undefined,
      email: v.email?.trim() || undefined,
      notas: v.notas?.trim() || undefined,
      quote_id: v.tipo === "venta" ? v.quote_id ?? null : null,
      retencion_fuente: v.retencion_fuente ?? 0,
      retencion_iva: v.retencion_iva ?? 0,
      retencion_ica: v.retencion_ica ?? 0,
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
          <Form.Item
            name="orden_compra"
            label="Orden de compra"
            tooltip="Referencia de la orden de compra (opcional). No genera contabilidad por sí sola."
          >
            <Input style={{ width: 180 }} />
          </Form.Item>
          {tipo !== "compra" && (
            <Form.Item
              name="quote_id"
              label="Cotización"
              tooltip="Vincula la factura a una cotización aprobada o entregada para no reconocer dos veces el ingreso."
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Sin cotización"
                style={{ width: 320 }}
                options={quotes.map((q) => ({
                  value: q.id,
                  label: `${q.numero} — ${q.customer_nombre} (${q.estado})`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Email inválido" }]}>
            <Input style={{ width: 240 }} />
          </Form.Item>
        </Space>

        <Form.Item name="notas" label="Notas">
          <Input.TextArea rows={2} maxLength={2000} showCount />
        </Form.Item>

        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {tipo === "compra"
            ? "Registra los productos comprados. El precio unitario es el costo neto de compra (sin IVA); al confirmar actualiza el costo del producto."
            : "Registra los productos vendidos. Al confirmar se descuenta stock (si la cotización no lo entregó antes) y se reconoce el ingreso neto + IVA."}
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
                        label: `${p.sku} — ${p.nombre} (stock: ${p.stock_actual}${p.stock_actual <= p.stock_minimo ? ' · stock bajo' : ''})`,
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
                  <Form.Item name={[name, "impuesto_pct"]} label="Imp." initialValue={19}>
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
                  {(() => {
                    const l = lineas[name];
                    const p = l?.product_id ? products[l.product_id] : undefined;
                    if (!p) return null;
                    const excede = (l?.cantidad ?? 0) > p.stock_actual;
                    const bajo = p.stock_actual <= p.stock_minimo;
                    if (excede) {
                      return (
                        <Tag color="red" style={{ lineHeight: "30px", marginTop: 30 }}>
                          ¡Stock insuficiente! disponible {p.stock_actual}, solicitado {l.cantidad}
                        </Tag>
                      );
                    }
                    if (bajo) {
                      return (
                        <Tag color="orange" style={{ lineHeight: "30px", marginTop: 30 }}>
                          Stock bajo: {p.stock_actual}
                        </Tag>
                      );
                    }
                    return null;
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
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ descuento_pct: 0, impuesto_pct: 19 })}>
                  Agregar línea
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <Space wrap align="start">
          <Form.Item
            name="retencion_fuente"
            label="Retención en la fuente"
            initialValue={0}
            tooltip="Informativa: reduce el valor neto a pagar; no modifica el ingreso reconocido."
          >
            <InputNumber min={0} step={0.01} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item
            name="retencion_iva"
            label="Retención de IVA"
            initialValue={0}
            tooltip="Informativa: reduce el valor neto a pagar; no modifica el IVA por pagar."
          >
            <InputNumber min={0} step={0.01} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item
            name="retencion_ica"
            label="Retención ICA"
            initialValue={0}
            tooltip="Informativa: reduce el valor neto a pagar."
          >
            <InputNumber min={0} step={0.01} style={{ width: 160 }} />
          </Form.Item>
        </Space>

        <Card size="small" style={{ maxWidth: 360, marginLeft: "auto", marginBottom: 16 }}>
          {[
            { label: "Subtotal", value: t.subtotal },
            { label: "Descuento", value: -t.descuento },
            { label: "IVA", value: t.impuesto },
            { label: "Retenciones", value: -retenciones },
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
            <span>Total factura</span>
            <span>{money(t.total)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
            <span>Total neto a pagar</span>
            <span>{money(totalNeto)}</span>
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
