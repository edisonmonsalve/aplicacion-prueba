import { useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
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
  theme,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { isAxiosError } from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createInvoice, getInvoice, updateInvoice } from "@/services/invoicesService";
import { getProducts } from "@/services/productsService";
import { getFinanceAccounts } from "@/services/financeService";
import { listQuotes, getQuote } from "@/services/quotesService";
import { listThirdParties } from "@/services/thirdPartiesService";
import { fetchProductsByIds, productOptionLabel } from "@/utils/productLookup";
import StockTag from "@/components/StockTag";
import type {
  FinanceAccount,
  InvoiceTipo,
  PaymentCondition,
  Quote,
  QuoteDetail,
  ThirdParty,
} from "@/types";
import { TIPO_OPTIONS, money } from "./InvoiceUtils";

interface ProductOpt {
  id: number;
  sku: string;
  nombre: string;
  precio: number;
  costo: number | null;
  stock_actual?: number;
  stock_minimo?: number;
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
  party_id?: number | null;
  condicion_pago?: PaymentCondition;
  dias_credito?: number;
  account_id?: number;
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
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [products, setProducts] = useState<Record<number, ProductOpt>>({});
  const [quotes, setQuotes] = useState<Quote[]>([]);
  // Datos de la cotización vinculada para mostrar el saldo cotizado como referencia.
  const [quoteInfo, setQuoteInfo] = useState<QuoteDetail | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [parties, setParties] = useState<ThirdParty[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loadedQuoteRef = useRef<number | null>(null);
  const lineas = Form.useWatch("items", form) ?? [];
  const tipo = Form.useWatch("tipo", form);
  const quoteIdForm = Form.useWatch("quote_id", form);
  const condicionPago = Form.useWatch("condicion_pago", form) ?? "contado";
  // Catálogo actual sin reejecutar el efecto de precios en cada búsqueda.
  const productsRef = useRef(products);
  productsRef.current = products;
  const prevTipoRef = useRef<InvoiceTipo | undefined>(undefined);

  // Al cambiar venta/compra, las líneas toman el valor que corresponde al nuevo
  // tipo: precio de venta o costo de compra. Se respetan los precios que el
  // usuario haya escrito manualmente (distintos del valor sugerido anterior).
  useEffect(() => {
    const prev = prevTipoRef.current;
    prevTipoRef.current = tipo;
    if (!prev || !tipo || prev === tipo || editId) return;

    const arr = (form.getFieldValue("items") as LineForm[] | undefined) ?? [];
    if (arr.length === 0) return;

    const next = arr.map((l) => {
      const p = l?.product_id ? productsRef.current[l.product_id] : undefined;
      if (!p) return l;
      const prevSuggested = prev === "compra" ? (p.costo ?? p.precio) : p.precio;
      const newSuggested = tipo === "compra" ? (p.costo ?? p.precio) : p.precio;
      const actual = l.precio_unitario;
      const sinEditar = actual === undefined || Math.abs(actual - prevSuggested) < 0.005;
      return sinEditar ? { ...l, precio_unitario: newSuggested } : l;
    });
    form.setFieldsValue({ items: next });
  }, [tipo, editId, form]);

  // M3: retenciones prellenadas automáticamente según el tipo de factura.
  // Los porcentajes son parámetros configurables (no tarifas legales hardcodeadas sin confirmar);
  // por defecto 0 y siempre editables. Reducen el total_neto y, al confirmar,
  // se reconocen como activo fiscal (venta) o pasivo (compra).
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
  // Referencia informativa: el saldo cotizado no limita la factura, solo ayuda a
  // detectar diferencias frente a la propuesta comercial.
  const saldoCotizado = quoteInfo
    ? quoteInfo.saldo_por_facturar ?? Math.max(0, quoteInfo.total - (quoteInfo.facturado ?? 0))
    : 0;
  const excedeCotizacion = !!quoteInfo && tipo !== "compra" && t.total > saldoCotizado + 0.005;
  // Si la cotización ya se entregó, el stock salió en la entrega: confirmar la
  // factura solo contabiliza y no vuelve a descontar existencias.
  const quoteEntregada = !!quoteInfo && quoteInfo.estado === "entregado";
  const enCotizacion = (productId?: number) =>
    !!productId && !!quoteInfo?.items.some((l) => l.product_id === productId);

  const search = async (q: string) => {
    try {
      const r = await getProducts({ q, page: 1, pageSize: 20 });
      setProducts((prev) => ({ ...prev, ...Object.fromEntries(r.data.map((p) => [p.id, p])) }));
    } catch {
      message.error("No se pudo buscar productos");
    }
  };

  // Cuentas de caja/banco: definen de dónde sale o dónde entra el dinero.
  useEffect(() => {
    getFinanceAccounts()
      .then((list) => {
        const active = list.filter((a) => a.activo);
        setAccounts(active);
        if (!editId && !form.getFieldValue("account_id")) {
          const preferred = active.find((a) => a.tipo === "banco") ?? active[0];
          if (preferred) form.setFieldsValue({ account_id: preferred.id });
        }
      })
      .catch(() => message.error("No se pudieron cargar las cuentas"));
  }, [editId, form]);

  // Terceros disponibles según el tipo de factura. Se incluyen los "ambos".
  useEffect(() => {
    listThirdParties({
      page: 1,
      pageSize: 100,
      tipo: tipo === "compra" ? "proveedor" : "cliente",
      activo: 1,
    })
      .then((r) => setParties(r.data))
      .catch(() => {
        // Sin terceros la factura sigue funcionando con la contraparte libre.
      });
  }, [tipo]);

  // Al elegir un tercero se copian sus datos como snapshot editable.
  const onPartyChange = (partyId?: number) => {
    if (!partyId) return;
    const p = parties.find((x) => x.id === partyId);
    if (!p) return;
    form.setFieldsValue({
      contraparte: p.nombre,
      documento: p.documento ?? undefined,
      email: p.email ?? undefined,
      condicion_pago: p.condicion_pago,
      dias_credito: p.condicion_pago === "credito" ? p.dias_credito : 0,
    });
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
  const urlTipo = searchParams.get("tipo");
  const initialTipo: InvoiceTipo = urlTipo === "compra" ? "compra" : "venta";

  const loadedProductRef = useRef<number | null>(null);

  // Reabastecimiento: al llegar desde un producto con stock bajo (?tipo=compra&product=id),
  // precarga una línea de compra con ese producto y su costo como precio unitario.
  useEffect(() => {
    if (editId) return;
    if (tipo !== "compra") return;
    const pid = urlProductId ? Number(urlProductId) : null;
    if (!pid || pid === loadedProductRef.current) return;
    loadedProductRef.current = pid;

    fetchProductsByIds([pid])
      .then((byId) => {
        const p = byId[pid];
        if (!p) return;
        setProducts((prev) => ({ ...prev, ...byId }));
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
      })
      .catch(() => message.error("No se pudo cargar el producto a reabastecer"));
  }, [tipo, editId, urlProductId, form, message]);

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
        setQuoteInfo(d);
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
                },
              ])
          ),
        }));
        // Completar el stock real de los productos de la cotización. Se consulta
        // por lote de ids porque el catálogo pagina y el stock es lo que alimenta
        // las alertas y la etiqueta del select.
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
      })
      .catch(() => {
        message.error("No se pudo cargar la cotización");
        setQuoteInfo(null);
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
                { id: l.product_id, sku: l.sku ?? "", nombre: l.producto ?? "", precio: l.precio_unitario, costo: l.precio_unitario },
              ])
          ),
        }));
        // Completar el stock real de los productos de la factura. Se consulta
        // por lote de ids para que las líneas autocompletadas muestren stock.
        const ids = d.items
          .filter((l) => l.product_id)
          .map((l) => l.product_id);
        if (ids.length > 0) {
          fetchProductsByIds(ids)
            .then((byId) =>
              setProducts((prev) => ({ ...prev, ...byId }))
            )
            .catch(() => {});
        }
        form.setFieldsValue({
          tipo: d.tipo,
          fecha: dayjs(d.fecha),
          contraparte: d.contraparte,
          documento: d.documento ?? undefined,
          orden_compra: d.orden_compra ?? undefined,
          email: d.email ?? undefined,
          notas: d.notas ?? undefined,
          quote_id: d.quote_id ?? undefined,
          party_id: d.party_id ?? undefined,
          condicion_pago: d.condicion_pago ?? "contado",
          dias_credito: d.dias_credito ?? 0,
          account_id: d.account_id ?? undefined,
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
        // El detalle de la cotización permite avisar si el stock ya salió en la
        // entrega; sin él, la edición perdería ese contexto.
        if (d.quote_id) {
          getQuote(d.quote_id).then(setQuoteInfo).catch(() => setQuoteInfo(null));
        }
      })
      .catch(() => {
        message.error("No se pudo cargar la factura");
        navigate("/facturas", { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // F3: avisa antes de cerrar o recargar la pestaña si hay cambios sin guardar.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty || saving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saving]);

  const cancel = () => {
    const to = editId ? `/facturas/${editId}` : "/facturas";
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
      party_id: v.party_id ?? null,
      condicion_pago: v.condicion_pago ?? "contado",
      dias_credito: v.condicion_pago === "credito" ? v.dias_credito ?? 0 : 0,
      account_id: v.account_id ?? null,
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
      setDirty(false);
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
        onValuesChange={() => setDirty(true)}
        initialValues={{ tipo: initialTipo, fecha: dayjs(), condicion_pago: "contado", dias_credito: 0, items: [{}] }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Guardar deja la factura en borrador"
          description="Guardar un borrador no mueve stock ni finanzas. Desde el detalle podrás revisarla y usar Confirmar para actualizar el stock y registrar los asientos financieros."
        />

        <Card size="small" title="Datos generales" style={{ marginBottom: 16 }}>
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
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="party_id"
            label={tipo === "compra" ? "Proveedor registrado" : "Cliente registrado"}
            tooltip="Opcional. Al elegirlo se cargan documento, email y condición de pago. Los datos quedan como snapshot editable en la factura."
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Sin tercero (escribir manualmente)"
              style={{ width: 320 }}
              onChange={onPartyChange}
              options={parties.map((p) => ({
                value: p.id,
                label: `${p.nombre}${p.documento ? ` · ${p.documento}` : ""}`,
              }))}
            />
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
                onChange={(v?: number) => {
                  if (!v) {
                    setQuoteInfo(null);
                    loadedQuoteRef.current = null;
                  }
                }}
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
          <Form.Item
            name="condicion_pago"
            label="Condición de pago"
            tooltip="Contado mueve la caja al confirmar. Crédito reconoce el ingreso/activo y deja el saldo en cartera hasta el cobro o pago."
          >
            <Select
              style={{ width: 160 }}
              options={[
                { value: "contado", label: "Contado" },
                { value: "credito", label: "Crédito" },
              ]}
              onChange={(v) => {
                if (v === "contado") form.setFieldsValue({ dias_credito: 0 });
                else if (!form.getFieldValue("dias_credito"))
                  form.setFieldsValue({ dias_credito: 30 });
              }}
            />
          </Form.Item>
          {condicionPago === "credito" && (
            <Form.Item name="dias_credito" label="Días de crédito" initialValue={30}>
              <InputNumber min={0} max={3650} style={{ width: 130 }} />
            </Form.Item>
          )}
        </Space>

        <Form.Item name="notas" label="Notas">
          <Input.TextArea rows={2} maxLength={2000} showCount />
        </Form.Item>
        </Card>

        <Card size="small" title="Cuenta" style={{ marginBottom: 16 }}>
          <Form.Item
            name="account_id"
            label="Cuenta de caja o banco"
            tooltip="Caja = efectivo; banco = transferencia. Define de dónde sale o dónde entra el dinero al confirmar la factura."
            extra="Al confirmar verás el saldo actual y el impacto en esta cuenta."
          >
            <Select
              placeholder="Cuenta por defecto"
              style={{ width: 260 }}
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.nombre} (${a.tipo}) · saldo ${money(a.saldo_actual)}`,
              }))}
            />
          </Form.Item>
        </Card>

        <Card size="small" title="Líneas" style={{ marginBottom: 16 }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {tipo === "compra"
              ? "Registra los productos comprados. El precio unitario es el costo neto de compra (sin IVA); al confirmar suma stock y registra el activo Inventario en la cuenta elegida."
              : "Registra los productos vendidos. Al confirmar se descuenta stock (si la cotización no lo entregó antes) y se reconoce el ingreso neto + IVA en la cuenta elegida."}
          </Typography.Paragraph>
          {quoteEntregada && tipo !== "compra" && (
            <Alert
              showIcon
              type="info"
              style={{ marginBottom: 12 }}
              message="La cotización ya fue entregada"
              description="El stock salió al entregar la cotización. Al confirmar esta factura solo se registra la venta, el IVA y el costo de ventas: no se vuelve a descontar inventario."
            />
          )}

        <Form.List
          name="items"
          rules={[
            {
              validator: async (_, v: Array<{ product_id?: number }> | undefined) => {
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
                      options={Object.values(products).map((p) => {
                        // Un producto ya elegido en otra línea no se puede repetir:
                        // el servidor rechazaría la factura.
                        const taken = lineas.some(
                          (l, i) => i !== name && l?.product_id === p.id
                        );
                        return {
                          value: p.id,
                          label: taken
                            ? `${productOptionLabel(p)} · ya agregado`
                            : productOptionLabel(p),
                          disabled: taken,
                        };
                      })}
                    />
                  </Form.Item>
                  <Form.Item name={[name, "cantidad"]} label="Cantidad" rules={[{ required: true, message: "Cant." }]}>
                    <InputNumber min={1} />
                  </Form.Item>
                  <Form.Item
                    name={[name, "precio_unitario"]}
                    label={tipo === "compra" ? "Costo unit." : "Precio unit."}
                    rules={[{ required: true, message: "Precio" }]}
                    tooltip={tipo === "compra" ? "Costo neto de compra (sin IVA). No modifica el costo de referencia del producto." : "Precio de venta por unidad."}
                  >
                    <InputNumber min={0.01} step={0.01} style={{ width: 140 }} />
                  </Form.Item>
                  <Form.Item name={[name, "descuento_pct"]} label="Desc." initialValue={0}>
                    <InputNumber min={0} max={100} addonAfter="%" />
                  </Form.Item>
                  <Form.Item name={[name, "impuesto_pct"]} label="IVA %" initialValue={19}>
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
                    // Cotización entregada: el stock ya salió. Se reemplaza el
                    // semáforo de stock por el estado real de la línea para no
                    // mostrar un falso "Stock insuficiente".
                    if (quoteEntregada && tipo !== "compra") {
                      const incluido = enCotizacion(l?.product_id);
                      return (
                        <div style={{ marginTop: 30 }}>
                          <Tooltip
                            title={
                              incluido
                                ? "El stock salió al entregar la cotización; al confirmar la factura no se vuelve a descontar."
                                : "Producto agregado después de la entrega: no forma parte del stock ya despachado y esta factura tampoco lo descuenta."
                            }
                          >
                            <Tag color={incluido ? "green" : "orange"}>
                              {incluido ? "Entregado en cotización" : "Agregado tras la entrega"}
                            </Tag>
                          </Tooltip>
                        </div>
                      );
                    }
                    if (!p || p.stock_actual === undefined) return null;
                    return (
                      <div style={{ marginTop: 30 }}>
                        <StockTag
                          stockActual={p.stock_actual}
                          stockMinimo={p.stock_minimo}
                          solicitado={tipo === "compra" ? undefined : l?.cantidad}
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
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ descuento_pct: 0, impuesto_pct: 19 })}>
                  Agregar línea
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
        </Card>

        <Card size="small" title="Retenciones y totales" style={{ marginBottom: 16 }}>
        {quoteInfo && tipo !== "compra" && (
          <Alert
            showIcon
            type={excedeCotizacion ? "warning" : "info"}
            style={{ marginBottom: 12 }}
            message={
              excedeCotizacion
                ? "Esta factura supera el saldo cotizado"
                : `Cotización ${quoteInfo.numero} vinculada`
            }
            description={
              excedeCotizacion
                ? `Cotizado ${money(quoteInfo.total)}, facturado ${money(
                    quoteInfo.facturado ?? 0
                  )} y saldo ${money(saldoCotizado)}; esta factura suma ${money(
                    t.total
                  )}. Puedes continuar: la factura refleja el valor real de la venta si cambiaron cantidades, precios, descuentos o impuestos.`
                : `Total cotizado ${money(quoteInfo.total)} · facturado ${money(
                    quoteInfo.facturado ?? 0
                  )} · saldo ${money(saldoCotizado)}.`
            }
          />
        )}
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
            <Tooltip title="Guarda la factura como borrador. Todavía no mueve stock ni finanzas.">
              <Button type="primary" htmlType="submit" loading={saving}>
                {editId ? "Guardar cambios" : "Guardar borrador"}
              </Button>
            </Tooltip>
            <Button onClick={cancel}>Cancelar</Button>
          </Space>
        </div>
        </Card>
      </Form>
    </Card>
  );
}
