import { useEffect, useState } from "react";
import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Select, Tooltip } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import { createQuote, getQuote, updateQuote } from "@/services/quotesService";
import { listThirdParties } from "@/services/thirdPartiesService";
import { fetchProductsByIds, type ProductOption } from "@/utils/productLookup";
import { currencyInputProps } from "@/utils/format";
import { useProductSearch } from "@/hooks/useProductSearch";
import ProductSelect from "@/components/ProductSelect";
import StockTag from "@/components/StockTag";
import PageHeader from "@/components/PageHeader";
import FormSection from "@/components/form/FormSection";
import DocumentTotals from "@/components/form/DocumentTotals";
import DocumentFormFooter from "@/components/form/DocumentFormFooter";
import { applyApiErrors, clearFormErrors } from "@/utils/formErrors";
import type { QuoteLineForm, ThirdParty } from "@/types";
import { money } from "./quoteUtils";

interface FormValues {
  party_id?: number;
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
  const { message, modal } = App.useApp();
  const { products, addProducts, resultIds, loading, search } = useProductSearch();
  const [parties, setParties] = useState<ThirdParty[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lineas = Form.useWatch("lineas", form) ?? [];
  const t = totals(lineas);

  // Clientes activos del maestro de terceros, para autollenar la cotización.
  useEffect(() => {
    listThirdParties({ page: 1, pageSize: 100, tipo: "cliente", activo: 1 })
      .then((r) => setParties(r.data))
      .catch(() => {
        // Sin terceros la cotización sigue funcionando con datos manuales.
      });
  }, []);

  // Al elegir un cliente registrado se copian sus datos como snapshot
  // editable: la cotización conserva el texto aunque el tercero cambie luego.
  const onPartyChange = (partyId?: number) => {
    if (!partyId) return;
    const p = parties.find((x) => x.id === partyId);
    if (!p) return;
    form.setFieldsValue({
      cliente_nombre: p.nombre,
      cliente_documento: p.documento ?? undefined,
      cliente_email: p.email ?? undefined,
    });
  };

  useEffect(() => {
    if (!editId) return;
    getQuote(editId)
      .then((d) => {
        if (d.estado !== "borrador") {
          message.error("Solo se pueden editar borradores");
          navigate(`/cotizaciones/${editId}`, { replace: true });
          return;
        }
        addProducts(
          d.items
            .filter((l) => l.product_id)
            .map(
              (l): ProductOption => ({
                id: l.product_id!,
                sku: l.sku,
                nombre: l.nombre,
                precio: l.precio_unitario,
              })
            )
        );
        // Completar el stock real de los productos de las líneas. Se consulta
        // por lote de ids: así las líneas autocompletadas muestran el stock y
        // las alertas funcionan igual que en las agregadas a mano.
        const ids = d.items
          .filter((l) => l.product_id)
          .map((l) => l.product_id!);
        if (ids.length > 0) {
          fetchProductsByIds(ids)
            .then((byId) => addProducts(Object.values(byId)))
            .catch(() => {});
        }
        form.setFieldsValue({
          party_id: d.party_id ?? undefined,
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

  // Q3: avisa antes de cerrar o recargar la pestaña si hay cambios sin guardar.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty || saving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saving]);

  const onProductChange = (name: number, pid: number) => {
    const p = products[pid];
    if (!p) return;
    const arr = form.getFieldValue("lineas");
    arr[name] = { ...arr[name], precio_unitario: p.precio };
    form.setFieldsValue({ lineas: arr });
  };

  const onFinish = async (v: FormValues) => {
    clearFormErrors(form);
    const payload = {
      party_id: v.party_id ?? null,
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
      setDirty(false);
      message.success(editId ? "Cotización actualizada" : "Borrador creado");
      navigate(`/cotizaciones/${r.id ?? editId}`);
    } catch (e) {
      const { message: msg } = applyApiErrors(e, form, "No se pudo guardar");
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    const to = editId ? `/cotizaciones/${editId}` : "/cotizaciones";
    if (!dirty) {
      navigate(to);
      return;
    }
    modal.confirm({
      title: "¿Descartar los cambios?",
      content: "Si sales ahora, los datos que no hayas guardado se perderán.",
      okText: "Descartar cambios",
      cancelText: "Seguir editando",
      okButtonProps: { danger: true },
      onOk: () => navigate(to),
    });
  };

  return (
    <div className="ui-document-form">
      <PageHeader
        eyebrow="Cotizaciones"
        title={editId ? "Editar cotización" : "Nueva cotización"}
        description="Precio del catálogo; descuento e IVA por línea."
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Guardar crea un borrador"
        description="Podrás revisarla y enviarla desde el detalle. Hasta entonces la cotización no compromete al cliente."
      />

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={() => setDirty(true)}
        initialValues={{ fecha_validez: dayjs().add(15, "day"), lineas: [{}] }}
      >
        <FormSection
          index="01"
          title="Cliente y vigencia"
          description="Tercero o datos manuales."
        >
          <div className="ui-doc-fields">
            <Form.Item
              className="ui-doc-field__lg"
              name="party_id"
              label={
                <>
                  Cliente registrado <span className="ui-optional">opcional</span>
                </>
              }
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Sin tercero (escribir manualmente)"
                onChange={onPartyChange}
                options={parties.map((p) => ({
                  value: p.id,
                  label: `${p.nombre}${p.documento ? ` · ${p.documento}` : ""}`,
                }))}
              />
            </Form.Item>
            <Form.Item
              className="ui-doc-field__md"
              name="cliente_nombre"
              label="Cliente"
              rules={[
                { required: true, message: "Requerido" },
                { min: 2, message: "Mínimo 2 caracteres" },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              className="ui-doc-field__sm"
              name="cliente_documento"
              label={
                <>
                  Documento <span className="ui-optional">opcional</span>
                </>
              }
            >
              <Input />
            </Form.Item>
            <Form.Item
              className="ui-doc-field__md"
              name="cliente_email"
              label={
                <>
                  Email <span className="ui-optional">opcional</span>
                </>
              }
              rules={[{ type: "email", message: "Email inválido" }, { max: 150 }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              className="ui-doc-field__sm"
              name="fecha_validez"
              label="Válido hasta"
              rules={[{ required: true, message: "Requerido" }]}
            >
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
          </div>
        </FormSection>

        <FormSection
          index="02"
          title="Notas"
          description="Opcional."
        >
          <Form.Item name="notas" rules={[{ max: 2000 }]}>
            <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Ej.: entrega estimada, vigencia de precios, forma de pago…" />
          </Form.Item>
        </FormSection>

        <FormSection
          index="03"
          title="Ítems"
          description="Descuento e IVA por línea."
          extra={<span className="ui-eyebrow">{lineas.length} línea(s)</span>}
        >
          <Form.List
            name="lineas"
            rules={[
              {
                validator: async (_, v: Partial<QuoteLineForm>[] | undefined) => {
                  if (!v?.length) throw new Error("Agrega al menos una línea");
                  const ids = v
                    .map((l) => l?.product_id)
                    .filter((id): id is number => typeof id === "number");
                  if (new Set(ids).size !== ids.length) {
                    throw new Error(
                      "Un producto no puede repetirse: ajusta las líneas marcadas como «ya agregado»"
                    );
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <div className="ui-doc-lines">
                  <div className="ui-doc-lines__head" aria-hidden="true">
                    <span>Producto</span>
                    <span>Cantidad</span>
                    <span>Precio unit.</span>
                    <span>Descuento</span>
                    <span>IVA</span>
                    <span>Total línea</span>
                    <span>Stock</span>
                    <span />
                  </div>
                  {fields.map(({ key, name }) => {
                    const line = lineas[name];
                    const product = line?.product_id ? products[line.product_id] : undefined;
                    const stockTag =
                      product && product.stock_actual !== undefined ? (
                        <StockTag
                          stockActual={product.stock_actual}
                          stockMinimo={product.stock_minimo}
                          solicitado={line?.cantidad}
                        />
                      ) : null;
                    return (
                      <div className="ui-doc-line" key={key}>
                        <Form.Item
                          className="ui-doc-line__product"
                          name={[name, "product_id"]}
                          label="Producto"
                          rules={[{ required: true, message: "Producto" }]}
                        >
                          <ProductSelect
                            products={products}
                            resultIds={resultIds}
                            loading={loading}
                            onSearch={search}
                            onChange={(pid) => onProductChange(name, pid!)}
                            style={{ width: "100%" }}
                            // Un producto ya elegido en otra línea no se puede repetir:
                            // el servidor rechazaría el documento (RN-P03).
                            takenIds={
                              new Set(
                                lineas
                                  .filter((_, i) => i !== name)
                                  .map((l) => l?.product_id)
                                  .filter((id): id is number => typeof id === "number")
                              )
                            }
                          />
                        </Form.Item>
                        <Form.Item
                          name={[name, "cantidad"]}
                          label="Cantidad"
                          rules={[{ required: true, message: "Cant." }]}
                        >
                          <InputNumber min={1} placeholder="Cant." />
                        </Form.Item>
                        <Form.Item
                          name={[name, "precio_unitario"]}
                          label="Precio unit."
                          rules={[{ required: true, message: "Precio" }]}
                        >
                          <InputNumber {...currencyInputProps} placeholder="$ 0" disabled />
                        </Form.Item>
                        <Form.Item
                          name={[name, "descuento_pct"]}
                          label="Descuento"
                          initialValue={0}
                        >
                          <InputNumber min={0} max={100} addonAfter="%" />
                        </Form.Item>
                        <Form.Item
                          name={[name, "impuesto_pct"]}
                          label="IVA"
                          initialValue={19}
                        >
                          <InputNumber min={0} max={100} addonAfter="%" />
                        </Form.Item>
                        <div className="ui-doc-line__total">
                          <span>Total línea</span>
                          <strong className="num">{money(lineTotal(line ?? {}))}</strong>
                        </div>
                        <div className="ui-doc-line__flag">{stockTag}</div>
                        <div className="ui-doc-line__remove">
                          <Tooltip title="Quitar esta línea">
                            <Button
                              type="text"
                              danger
                              aria-label={`Quitar línea ${name + 1}`}
                              icon={<MinusCircleOutlined />}
                              onClick={() => remove(name)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Form.ErrorList errors={errors} />
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => add({ descuento_pct: 0, impuesto_pct: 19 })}
                >
                  Agregar línea
                </Button>
              </>
            )}
          </Form.List>
        </FormSection>

        <FormSection
          index="04"
          title="Resumen"
          description="Importes en vivo."
        >
          <DocumentTotals
            rows={[
              { label: "Subtotal", value: money(t.subtotal), hint: "Suma de cantidad × precio de cada línea" },
              { label: "Descuento", value: money(-t.descuento), hint: "Descuentos aplicados por línea" },
              { label: "IVA", value: money(t.impuesto), hint: "IVA aplicado por línea" },
            ]}
            totalLabel="Total"
            totalValue={money(t.total)}
            totalHint="Total final de la cotización"
          />
        </FormSection>

        <DocumentFormFooter
          saving={saving}
          dirty={dirty}
          onCancel={cancel}
          submitLabel="Guardar"
          totalLabel="Total"
          totalValue={money(t.total)}
        />
      </Form>
    </div>
  );
}
