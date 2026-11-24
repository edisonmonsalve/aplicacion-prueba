import { useCallback, useEffect, useRef, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  TimePicker,
  Tooltip,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DownOutlined,
  MinusCircleOutlined,
  MoreOutlined,
  PercentageOutlined,
  PlusOutlined,
  SnippetsOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createInvoice, getInvoice, updateInvoice } from "@/services/invoicesService";
import { getFinanceAccounts } from "@/services/financeService";
import { listQuotes, getQuote } from "@/services/quotesService";
import { listThirdParties } from "@/services/thirdPartiesService";
import { fetchProductsByIds, type ProductOption } from "@/utils/productLookup";
import { currencyInputProps } from "@/utils/format";
import { useProductSearch } from "@/hooks/useProductSearch";
import useReducedMotion from "@/hooks/useReducedMotion";
import { useStepperLabels } from "@/hooks/useStepperLabels";
import ProductSelect from "@/components/ProductSelect";
import StockTag from "@/components/StockTag";
import DocumentTotals from "@/components/form/DocumentTotals";
import DocumentFormFooter from "@/components/form/DocumentFormFooter";
import PasteLinesDialog, { type PastedLine } from "@/components/form/PasteLinesDialog";
import { useCompany } from "@/context/CompanyContext";
import { applyApiErrors, clearFormErrors } from "@/utils/formErrors";
import type {
  FinanceAccount,
  InvoiceDocumentoTipo,
  InvoiceMedioPago,
  InvoiceTipo,
  PaymentCondition,
  Quote,
  QuoteDetail,
  ThirdParty,
} from "@/types";
import { TIPO_OPTIONS, money } from "./InvoiceUtils";

type FieldName = Array<string | number>;

interface LineForm {
  product_id?: number;
  /** Descripción facturada: se guarda como snapshot y no depende del catálogo. */
  descripcion?: string;
  unidad_medida?: string;
  cantidad?: number;
  precio_unitario?: number;
  descuento_pct?: number;
  impuesto_pct?: number;
  inc_pct?: number;
  otro_impuesto_nombre?: string;
  otro_impuesto_pct?: number;
}

interface FormValues {
  tipo: InvoiceTipo;
  fecha: Dayjs;
  hora_expedicion?: Dayjs;
  contraparte: string;
  tipo_documento_adquirente?: InvoiceDocumentoTipo;
  documento?: string;
  prefijo?: string;
  resolucion_numero?: string;
  resolucion_fecha?: Dayjs;
  rango_desde?: number;
  rango_hasta?: number;
  orden_compra?: string;
  email?: string;
  notas?: string;
  quote_id?: number | null;
  party_id?: number | null;
  condicion_pago?: PaymentCondition;
  medio_pago?: InvoiceMedioPago;
  dias_credito?: number;
  fecha_vencimiento?: Dayjs | null;
  account_id?: number;
  retencion_fuente?: number;
  retencion_iva?: number;
  retencion_ica?: number;
  items: LineForm[];
}

/** IVA sugerido por tipo: venta tributa 19 % y reabastecimiento no. */
const IMPUESTO_DEFAULT: Record<InvoiceTipo, number> = { venta: 19, compra: 0 };

/** Marca las líneas que ya guardan datos en el panel desplegable de detalle. */
const tieneDetalle = (line?: LineForm, tipo: InvoiceTipo = "venta") =>
  !!line &&
  (!!line.descripcion?.trim() ||
    (!!line.unidad_medida && line.unidad_medida !== "UND") ||
    !!line.descuento_pct ||
    (line.impuesto_pct !== undefined && line.impuesto_pct !== IMPUESTO_DEFAULT[tipo]) ||
    !!line.inc_pct ||
    !!line.otro_impuesto_pct ||
    !!line.otro_impuesto_nombre?.trim());

/** Campos que viven dentro de «Información adicional» y deben abrirla al saltar. */
const MORE_FIELDS = new Set([
  "quote_id",
  "prefijo",
  "resolucion_numero",
  "resolucion_fecha",
  "rango_desde",
  "rango_hasta",
  "orden_compra",
  "account_id",
  "retencion_fuente",
  "retencion_iva",
  "retencion_ica",
]);

const DOCUMENTO_OPTIONS: { value: InvoiceDocumentoTipo; label: string }[] = [
  { value: "NIT", label: "NIT" },
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "OTRO", label: "Otro" },
];

const MEDIO_PAGO_OPTIONS: { value: InvoiceMedioPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
];

// Parámetros configurables, no tarifas legales: reducen el neto y se pueden editar.
// Fuera del componente para que el efecto de prellenado no dependa de un literal.
const DEFAULT_RETENCIONES: Record<InvoiceTipo, { fuente: number; iva: number; ica: number }> = {
  venta: { fuente: 0, iva: 0, ica: 0 },
  compra: { fuente: 0, iva: 0, ica: 0 },
};

/** Desglose de una línea: IVA, INC y otro tributo comparten la misma base. */
const lineBreakdown = (l: LineForm) => {
  const base = (l.cantidad ?? 0) * (l.precio_unitario ?? 0);
  const descuento = (base * (l.descuento_pct ?? 0)) / 100;
  const baseGravada = base - descuento;
  const iva = (baseGravada * (l.impuesto_pct ?? 0)) / 100;
  const inc = (baseGravada * (l.inc_pct ?? 0)) / 100;
  const otro = (baseGravada * (l.otro_impuesto_pct ?? 0)) / 100;
  return { base, descuento, baseGravada, iva, inc, otro, total: baseGravada + iva + inc + otro };
};

const lineTotal = (l: LineForm) => lineBreakdown(l).total;

const totals = (ls: LineForm[]) =>
  ls.reduce(
    (t, l) => {
      const b = lineBreakdown(l ?? {});
      return {
        subtotal: t.subtotal + b.base,
        descuento: t.descuento + b.descuento,
        impuesto: t.impuesto + b.iva,
        inc: t.inc + b.inc,
        otros: t.otros + b.otro,
        total: t.total + b.total,
      };
    },
    { subtotal: 0, descuento: 0, impuesto: 0, inc: 0, otros: 0, total: 0 }
  );

const DRAFT_PREFIX = "signal-invoice-draft:";
/** Última resolución usada por tipo: se reutiliza al crear otra factura. */
const FISCAL_PREFIX = "signal-invoice-fiscal:";
const DRAFT_DATE_KEYS = ["fecha", "hora_expedicion", "resolucion_fecha", "fecha_vencimiento"];

interface FiscalSnapshot {
  resolucion_numero?: string;
  resolucion_fecha?: string;
  rango_desde?: number;
  rango_hasta?: number;
}

interface LocalDraft {
  values: Record<string, unknown>;
  products: ProductOption[];
  savedAt: string;
}

/** Dayjs no es serializable: se guarda como texto y se rehidrata al restaurar. */
function serializeDraftValue(value: unknown): unknown {
  if (dayjs.isDayjs(value)) return value.format("YYYY-MM-DDTHH:mm:ss");
  if (Array.isArray(value)) return value.map(serializeDraftValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, serializeDraftValue(v)])
    );
  }
  return value;
}

function hydrateDraftValues(values: Record<string, unknown>): Record<string, unknown> {
  const next = { ...values };
  for (const key of DRAFT_DATE_KEYS) {
    if (next[key]) next[key] = dayjs(String(next[key]));
  }
  return next;
}

export default function InvoiceFormPage() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { company } = useCompany();
  const [form] = Form.useForm<FormValues>();
  const { products, addProducts, resultIds, loading, search } = useProductSearch();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  // Datos de la cotización vinculada para mostrar el saldo cotizado como referencia.
  const [quoteInfo, setQuoteInfo] = useState<QuoteDetail | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [parties, setParties] = useState<ThirdParty[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<Set<number>>(new Set());
  /** Resolución, referencias y contabilidad: plegadas para no competir con las líneas. */
  const [moreOpen, setMoreOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  /** `add` de Form.List se guarda aquí para poder agregar líneas con el teclado. */
  const editorRef = useRef<HTMLDivElement>(null);
  useStepperLabels(editorRef);
  const reducedMotion = useReducedMotion();

  const addLineRef = useRef<((value?: LineForm) => void) | null>(null);
  const removeLineRef = useRef<((index: number) => void) | null>(null);
  const draftKey = `${DRAFT_PREFIX}${editId ?? "new"}`;
  const loadedQuoteRef = useRef<number | null>(null);
  const lineas = Form.useWatch("items", form) ?? [];
  const tipo = Form.useWatch("tipo", form);
  const fecha = Form.useWatch("fecha", form);
  const contraparte = Form.useWatch("contraparte", form);
  const documentoAdquirente = Form.useWatch("documento", form);
  const quoteIdForm = Form.useWatch("quote_id", form);
  const condicionPago = Form.useWatch("condicion_pago", form) ?? "contado";
  const diasCredito = Form.useWatch("dias_credito", form);
  const horaExpedicion = Form.useWatch("hora_expedicion", form);
  const tipoDocumento = Form.useWatch("tipo_documento_adquirente", form);
  const prefijo = Form.useWatch("prefijo", form);
  const resolucionNumero = Form.useWatch("resolucion_numero", form);
  const resolucionFecha = Form.useWatch("resolucion_fecha", form);
  const rangoDesde = Form.useWatch("rango_desde", form);
  const rangoHasta = Form.useWatch("rango_hasta", form);
  const medioPago = Form.useWatch("medio_pago", form);
  const fechaVencimiento = Form.useWatch("fecha_vencimiento", form);
  const accountId = Form.useWatch("account_id", form);
  // Catálogo actual sin reejecutar el efecto de precios en cada búsqueda.
  const productsRef = useRef(products);
  productsRef.current = products;
  const prevTipoRef = useRef<InvoiceTipo | undefined>(undefined);

  // Borrador local: solo vive en este navegador y nunca sustituye al borrador
  // del servidor. Permite cerrar la pestaña sin perder una captura larga.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as LocalDraft;
      if (!draft.values || typeof draft.values !== "object") return;
      if (Array.isArray(draft.products) && draft.products.length > 0) {
        addProducts(draft.products);
      }
      form.setFieldsValue(hydrateDraftValues(draft.values));
      setDraftSavedAt(draft.savedAt ?? null);
      setDirty(true);
      if (draft.values.quote_id) {
        loadedQuoteRef.current = Number(draft.values.quote_id);
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const saveDraft = useCallback(() => {
    try {
      const savedAt = new Date().toISOString();
      const draft: LocalDraft = {
        values: serializeDraftValue(form.getFieldsValue(true)) as Record<string, unknown>,
        products: Object.values(productsRef.current),
        savedAt,
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftSavedAt(savedAt);
      message.success("Borrador local guardado en este navegador");
    } catch {
      message.error("No se pudo guardar el borrador local");
    }
  }, [draftKey, form, message]);

  /** Alta de línea con foco automático en el producto, también con Alt+Enter. */
  const addLine = useCallback((value?: LineForm) => {
    addLineRef.current?.({
      cantidad: 1,
      descuento_pct: 0,
      impuesto_pct: IMPUESTO_DEFAULT[tipo ?? "venta"],
      inc_pct: 0,
      otro_impuesto_pct: 0,
      unidad_medida: "UND",
      ...value,
    });
    window.setTimeout(() => {
      const rows = document.querySelectorAll(".ui-invoice-table__row");
      const last = rows[rows.length - 1];
      // AntD v6 pone el foco en `.ant-select-input` (v5 usaba
      // `.ant-select-selection-search-input`); enfocar el div del selector
      // dejaría el foco donde estaba.
      const target =
        last?.querySelector<HTMLElement>(".ant-select-input") ??
        last?.querySelector<HTMLElement>(".ant-select-selection-search-input") ??
        last?.querySelector<HTMLElement>(".ant-select-selector");
      target?.focus();
    }, 0);
  }, [tipo]);

  /** Enfoca el producto de una línea; es la puerta de entrada a cada fila. */
  const focusRow = useCallback((index: number) => {
    window.setTimeout(() => {
      const row = document.querySelectorAll(".ui-invoice-table__row")[index];
      const target =
        row?.querySelector<HTMLElement>(".ant-select-input") ??
        row?.querySelector<HTMLElement>(".ant-select-selection-search-input") ??
        row?.querySelector<HTMLElement>(".ant-select-selector");
      target?.focus();
    }, 0);
  }, []);

  /** Tras elegir el producto, la cantidad queda seleccionada para escribir. */
  const focusQuantity = useCallback((index: number) => {
    window.setTimeout(() => {
      const row = document.querySelectorAll<HTMLElement>(".ui-invoice-table__row")[index];
      const input = row?.querySelector<HTMLInputElement>(
        '[aria-colindex="3"] .ant-input-number input'
      );
      input?.focus();
      // El valor inicial suele ser 1: seleccionarlo evita borrarlo a mano.
      input?.select();
    }, 0);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inDialog = !!target?.closest(".ant-modal");
      const row = target?.closest<HTMLElement>(".ui-invoice-table__row") ?? null;
      const rows = Array.from(document.querySelectorAll<HTMLElement>(".ui-invoice-table__row"));
      const index = row ? rows.indexOf(row) : -1;

      if (e.altKey && e.key === "Enter" && !inDialog) {
        e.preventDefault();
        addLine();
        return;
      }
      // El desplegable de producto usa Enter para elegir: no debe mover la fila.
      const dropdownOpen = !!document.querySelector(
        ".ant-select-dropdown:not(.ant-select-dropdown-hidden)"
      );
      // Enter dentro de la tabla avanza a la siguiente línea; en la última, abre una.
      if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        index >= 0 &&
        !inDialog &&
        !dropdownOpen
      ) {
        if (target?.tagName === "TEXTAREA") return;
        // Un selector vacío usa Enter para abrir la lista; con un producto ya
        // elegido, Enter pasa a la siguiente línea como en una hoja de cálculo.
        const emptySelect =
          target?.classList.contains("ant-select-input") &&
          !target.closest(".ant-select")?.querySelector(".ant-select-selection-item");
        if (emptySelect) return;
        e.preventDefault();
        if (index === rows.length - 1) addLine();
        else focusRow(index + 1);
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || inDialog) return;
      if (e.key === "Enter") {
        e.preventDefault();
        form.submit();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft();
      } else if (e.key.toLowerCase() === "d" && index >= 0) {
        e.preventDefault();
        const current = (form.getFieldValue("items") as LineForm[] | undefined)?.[index];
        if (current) {
          addLine({ ...current, product_id: undefined });
          setAnnouncement(`Línea ${index + 1} duplicada`);
        }
      } else if (e.key === "Delete" && index >= 0) {
        e.preventDefault();
        if (rows.length <= 1) return;
        removeLineRef.current?.(index);
        setAnnouncement(`Línea ${index + 1} eliminada`);
        focusRow(Math.max(0, index - 1));
      }
    };
    // Captura: si el evento llegara antes a AntD, el Select abriría su lista y
    // Enter nunca avanzaría de línea.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [form, saveDraft, addLine, focusRow]);

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

  // El vencimiento se recalcula si cambian la fecha, el plazo o la condición;
  // editarlo a mano no dispara este efecto porque no es una dependencia.
  useEffect(() => {
    if (editId || condicionPago !== "credito" || !fecha) return;
    const dias = Number(diasCredito ?? 0);
    if (!dias) return;
    const esperada = fecha.add(dias, "day");
    const actual = form.getFieldValue("fecha_vencimiento") as Dayjs | undefined;
    if (!actual?.isSame(esperada, "day")) form.setFieldsValue({ fecha_vencimiento: esperada });
  }, [fecha, condicionPago, diasCredito, editId, form]);

  useEffect(() => {
    if (editId) return;
    const defaults = DEFAULT_RETENCIONES[tipo ?? "venta"];
    const prefijoActual = form.getFieldValue("prefijo") as string | undefined;
    const prefijoEsperado = tipo === "compra" ? "COM" : "FAC";
    const prefijoAnterior = tipo === "compra" ? "FAC" : "COM";

    // La resolución se repite entre facturas del mismo tipo. La última usada
    // se guarda en este navegador para no volver a pedirla en cada captura.
    let fiscal: FiscalSnapshot = {};
    try {
      const raw = localStorage.getItem(`${FISCAL_PREFIX}${tipo ?? "venta"}`);
      if (raw) fiscal = JSON.parse(raw) as FiscalSnapshot;
    } catch {
      localStorage.removeItem(`${FISCAL_PREFIX}${tipo ?? "venta"}`);
    }

    form.setFieldsValue({
      retencion_fuente: form.getFieldValue("retencion_fuente") ?? defaults.fuente,
      retencion_iva: form.getFieldValue("retencion_iva") ?? defaults.iva,
      retencion_ica: form.getFieldValue("retencion_ica") ?? defaults.ica,
      prefijo: !prefijoActual || prefijoActual === prefijoAnterior ? prefijoEsperado : prefijoActual,
      hora_expedicion: form.getFieldValue("hora_expedicion") ?? dayjs(),
      resolucion_numero: form.getFieldValue("resolucion_numero") ?? fiscal.resolucion_numero,
      resolucion_fecha:
        form.getFieldValue("resolucion_fecha") ??
        (fiscal.resolucion_fecha ? dayjs(fiscal.resolucion_fecha) : dayjs()),
      tipo_documento_adquirente:
        form.getFieldValue("tipo_documento_adquirente") ?? "NIT",
      medio_pago: form.getFieldValue("medio_pago") ?? "transferencia",
      rango_desde: form.getFieldValue("rango_desde") ?? fiscal.rango_desde ?? 1,
      rango_hasta: form.getFieldValue("rango_hasta") ?? fiscal.rango_hasta ?? 9999,
    });
  }, [tipo, editId, form]);

  const retencionFuente = Form.useWatch("retencion_fuente", form) ?? 0;
  const retencionIva = Form.useWatch("retencion_iva", form) ?? 0;
  const retencionIca = Form.useWatch("retencion_ica", form) ?? 0;
  const t = totals(lineas);
  const retenciones = (retencionFuente ?? 0) + (retencionIva ?? 0) + (retencionIca ?? 0);
  const totalNeto = Math.max(0, t.total - retenciones);
  // Referencia informativa: el saldo cotizado no limita la factura, solo ayuda a
  // detectar diferencias frente a la propuesta comercial.
  const saldoCotizado = quoteInfo
    ? quoteInfo.saldo_por_facturar ?? Math.max(0, quoteInfo.total - (quoteInfo.facturado ?? 0))
    : 0;
  const excedeCotizacion = !!quoteInfo && tipo !== "compra" && t.total > saldoCotizado + 0.005;
  // Una sola regla para la validación y la checklist fiscal.
  const documentoRequerido = tipo === "venta";
  const rangoInvalido =
    typeof rangoDesde === "number" &&
    typeof rangoHasta === "number" &&
    rangoDesde > 0 &&
    rangoDesde > rangoHasta;
  // Si la cotización ya se entregó, el stock salió en la entrega: confirmar la
  // factura solo contabiliza y no vuelve a descontar existencias.
  const quoteEntregada = !!quoteInfo && quoteInfo.estado === "entregado";
  const enCotizacion = (productId?: number) =>
    !!productId && !!quoteInfo?.items.some((l) => l.product_id === productId);
  // Resumen de una línea para el bloque plegado: informa sin abrir nada.
  const accountName = accounts.find((a) => a.id === accountId)?.nombre;
  const moreSummary = [
    resolucionNumero?.trim() ? `Resolución ${resolucionNumero.trim()}` : "Sin resolución",
    accountName ?? "Cuenta por defecto",
    retenciones > 0 ? "Con retenciones" : "Sin retenciones",
  ].join(" · ");

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
  }, [editId, form, message]);

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
      tipo_documento_adquirente: p.tipo_documento,
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
        addProducts(Object.values(byId));
        const arr = [...(form.getFieldValue("items") ?? [])];
        if (arr.length === 1 && !arr[0]?.product_id) {
          arr[0] = {
            product_id: pid,
            descripcion: p.nombre,
            unidad_medida: "UND",
            cantidad: 1,
            precio_unitario: p.costo ?? p.precio,
            descuento_pct: 0,
            impuesto_pct: IMPUESTO_DEFAULT.compra,
            inc_pct: 0,
            otro_impuesto_pct: 0,
          };
          form.setFieldsValue({ items: arr });
        }
      })
      .catch(() => message.error("No se pudo cargar el producto a reabastecer"));
  }, [tipo, editId, urlProductId, form, message, addProducts]);

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
          documento: d.party_documento ?? undefined,
          email: d.customer_email ?? undefined,
          quote_id: d.id,
          notas: d.notas ?? undefined,
        });
        setQuoteInfo(d);
        const items = d.items.map((l) => ({
          product_id: l.product_id!,
          descripcion: l.nombre,
          unidad_medida: "UND",
          cantidad: l.cantidad ?? 1,
          precio_unitario: l.precio_unitario,
          descuento_pct: l.descuento_pct,
          impuesto_pct: l.impuesto_pct,
          inc_pct: 0,
          otro_impuesto_pct: 0,
        }));
        form.setFieldsValue({ items });
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
        // Completar el stock real de los productos de la cotización. Se consulta
        // por lote de ids porque el catálogo pagina y el stock es lo que alimenta
        // las alertas y la etiqueta del select.
        const ids = d.items
          .filter((l) => l.product_id)
          .map((l) => l.product_id!);
        if (ids.length > 0) {
          fetchProductsByIds(ids)
            .then((byId) => addProducts(Object.values(byId)))
            .catch(() => {});
        }
      })
      .catch(() => {
        message.error("No se pudo cargar la cotización");
        setQuoteInfo(null);
        loadedQuoteRef.current = null;
      });
  }, [quoteIdForm, urlQuoteId, editId, tipo, form, message, addProducts]);

  useEffect(() => {
    if (!editId) return;
    getInvoice(editId)
      .then((d) => {
        if (d.estado !== "borrador") {
          message.error("Solo se pueden editar facturas en borrador");
          navigate(`/facturas/${editId}`, { replace: true });
          return;
        }
        addProducts(
          d.items
            .filter((l) => l.product_id)
            .map(
              (l): ProductOption => ({
                id: l.product_id,
                sku: l.sku ?? "",
                nombre: l.producto ?? "",
                precio: l.precio_unitario,
                costo: l.precio_unitario,
              })
            )
        );
        // Completar el stock real de los productos de la factura. Se consulta
        // por lote de ids para que las líneas autocompletadas muestren stock.
        const ids = d.items
          .filter((l) => l.product_id)
          .map((l) => l.product_id);
        if (ids.length > 0) {
          fetchProductsByIds(ids)
            .then((byId) => addProducts(Object.values(byId)))
            .catch(() => {});
        }
        form.setFieldsValue({
          tipo: d.tipo,
          fecha: dayjs(d.fecha),
          hora_expedicion: d.hora_expedicion
            ? dayjs(`2000-01-01T${d.hora_expedicion}:00`)
            : dayjs(),
          contraparte: d.contraparte,
          tipo_documento_adquirente: d.tipo_documento_adquirente ?? "NIT",
          documento: d.documento ?? undefined,
          prefijo: d.prefijo ?? (d.tipo === "compra" ? "COM" : "FAC"),
          resolucion_numero: d.resolucion_numero ?? undefined,
          resolucion_fecha: d.resolucion_fecha
            ? dayjs(d.resolucion_fecha)
            : dayjs(d.fecha),
          rango_desde: d.rango_desde ?? 1,
          rango_hasta: d.rango_hasta ?? 9999,
          orden_compra: d.orden_compra ?? undefined,
          email: d.email ?? undefined,
          notas: d.notas ?? undefined,
          quote_id: d.quote_id ?? undefined,
          party_id: d.party_id ?? undefined,
          condicion_pago: d.condicion_pago ?? "contado",
          medio_pago: d.medio_pago ?? "transferencia",
          dias_credito: d.dias_credito ?? 0,
          fecha_vencimiento: d.fecha_vencimiento ? dayjs(d.fecha_vencimiento) : null,
          account_id: d.account_id ?? undefined,
          retencion_fuente: d.retencion_fuente,
          retencion_iva: d.retencion_iva,
          retencion_ica: d.retencion_ica,
          items: d.items.map((l) => ({
            product_id: l.product_id,
            descripcion: l.descripcion ?? l.producto,
            unidad_medida: l.unidad_medida ?? "UND",
            cantidad: l.cantidad ?? 1,
            precio_unitario: l.precio_unitario,
            descuento_pct: l.descuento_pct,
            impuesto_pct: l.impuesto_pct,
            inc_pct: l.inc_pct ?? 0,
            otro_impuesto_nombre: l.otro_impuesto_nombre ?? undefined,
            otro_impuesto_pct: l.otro_impuesto_pct ?? 0,
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

  const fiscalChecks = [
    {
      label: "Adquirente identificado",
      ok: !!contraparte?.trim() && (!documentoRequerido || !!documentoAdquirente?.trim()) && !!tipoDocumento,
      field: contraparte?.trim() ? "documento" : "contraparte",
    },
    {
      label: "Fecha y hora de expedición",
      ok: !!fecha && !!horaExpedicion,
      field: fecha ? "hora_expedicion" : "fecha",
    },
    {
      label: "Resolución y rango autorizado",
      ok:
        !!prefijo?.trim() &&
        !!resolucionNumero?.trim() &&
        !!resolucionFecha &&
        typeof rangoDesde === "number" &&
        typeof rangoHasta === "number" &&
        !rangoInvalido,
      field: !resolucionNumero?.trim() ? "resolucion_numero" : "rango_desde",
    },
    {
      label: "Líneas con descripción",
      ok: lineas.length > 0 && lineas.every((l) => !!l?.descripcion?.trim()),
      field: lineas.length > 0 ? ["items", 0, "descripcion"] : "items",
    },
    {
      label: "Forma y medio de pago",
      ok:
        !!condicionPago &&
        !!medioPago &&
        (condicionPago !== "credito" || !!fechaVencimiento),
      field: condicionPago === "credito" ? "fecha_vencimiento" : "medio_pago",
    },
  ];
  /** Lleva al campo; si vive en «Información adicional», la abre primero. */
  const goToField = (name: FieldName) => {
    if (MORE_FIELDS.has(String(name[0]))) setMoreOpen(true);
    // El cuerpo plegado se monta en el mismo ciclo: el salto espera un turno.
    window.setTimeout(() => {
      form.scrollToField(name, {
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      });
      window.setTimeout(() => {
        const instance = form.getFieldInstance(name) as { focus?: () => void } | undefined;
        instance?.focus?.();
      }, 140);
    }, 20);
  };

  // La clave de Form.List es estable al mover, clonar o quitar líneas: usar el
  // índice dejaría abierto el detalle de otra fila después de reordenar.
  const toggleDetails = (key: number) =>
    setDetailsOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // La fecha de vencimiento se deriva de los días de crédito sobre la fecha de
  // factura; así el mencionado en la factura siempre concuerda con el plazo.
  const applyCreditDays = (dias: number) => {
    const base = (form.getFieldValue("fecha") as Dayjs | undefined) ?? dayjs();
    form.setFieldsValue({ fecha_vencimiento: base.add(Math.max(0, dias), "day") });
  };

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
    const repetido = (form.getFieldValue("items") as LineForm[] | undefined)?.some(
      (line, i) => i !== name && line?.product_id === pid
    );
    if (repetido) {
      message.warning("Ese producto ya está en otra línea; revisa la cantidad");
    }
    const arr = [...(form.getFieldValue("items") ?? [])];
    const anteriorId = arr[name]?.product_id;
    const anteriorNombre = anteriorId ? products[anteriorId]?.nombre : undefined;
    const descripcion = arr[name]?.descripcion?.trim();
    // Si el usuario no ha tocado la descripción (o todavía es la del producto
    // anterior), se refresca con el nuevo nombre; si la editó, se conserva.
    const descripcionSnapshot =
      !descripcion || descripcion === anteriorNombre ? p.nombre : descripcion;
    const suggested = tipo === "compra" ? (p.costo ?? p.precio) : p.precio;
    arr[name] = {
      ...arr[name],
      cantidad: arr[name]?.cantidad ?? 1,
      precio_unitario: suggested,
      // La descripción se captura como snapshot facturado, no se lee del catálogo al imprimir.
      descripcion: descripcionSnapshot,
      unidad_medida: arr[name]?.unidad_medida || "UND",
    };
    form.setFieldsValue({ items: arr });
    // El foco continúa donde empieza la captura de la línea: escribir la
    // cantidad reemplaza el valor sugerido sin necesidad de otro clic.
    focusQuantity(name);
    setAnnouncement(
      `${repetido ? `Producto ${p.nombre} repetido en otra línea. ` : `Producto ${p.nombre} seleccionado. `}Cantidad de la línea ${name + 1} lista para ingresar.`
    );
  };

  /** Convierte filas pegadas en líneas; reemplaza la línea vacía inicial. */
  const onPasteLines = (lines: PastedLine[]) => {
    if (lines.length === 0) return;
    const current = (form.getFieldValue("items") as LineForm[] | undefined) ?? [];
    const vacia = current.length === 1 && !current[0]?.product_id && !current[0]?.cantidad;
    const base = vacia ? [] : current;
    const usados = new Set(
      base.map((l) => l.product_id).filter((id): id is number => typeof id === "number")
    );
    let repetidos = 0;
    const nuevas: LineForm[] = [];
    for (const l of lines) {
      if (!l.productId) continue;
      if (usados.has(l.productId)) {
        repetidos += 1;
        continue;
      }
      usados.add(l.productId);
      nuevas.push({
        product_id: l.productId,
        descripcion: l.descripcion,
        unidad_medida: "UND",
        cantidad: l.cantidad ?? 1,
        precio_unitario: l.precio,
        descuento_pct: 0,
        impuesto_pct: IMPUESTO_DEFAULT[tipo ?? "venta"],
        inc_pct: 0,
        otro_impuesto_pct: 0,
      });
    }
    if (nuevas.length === 0) {
      message.warning("Esas líneas ya están en la factura");
      return;
    }
    form.setFieldsValue({ items: [...base, ...nuevas] });
    setDirty(true);
    setPasteOpen(false);
    // Pegar también termina en la primera cantidad nueva: el usuario puede
    // ajustarla de inmediato con el teclado.
    focusQuantity(base.length);
    setAnnouncement(
      `${nuevas.length} líneas agregadas desde Excel. Cantidad de la línea ${base.length + 1} lista para revisar.`
    );
    message.success(
      repetidos > 0
        ? `${nuevas.length} líneas agregadas · ${repetidos} producto(s) repetido(s) omitido(s)`
        : `${nuevas.length} líneas agregadas`
    );
  };

  const onFinish = async (v: FormValues) => {
    if (saving) return; // Ctrl+Enter repetido no debe duplicar la factura.
    if (rangoInvalido) {
      goToField(["rango_desde"]);
      message.error("El rango desde debe ser menor o igual al rango hasta");
      return;
    }
    clearFormErrors(form);
    const payload = {
      tipo: v.tipo,
      fecha: v.fecha.format("YYYY-MM-DD"),
      hora_expedicion: v.hora_expedicion?.format("HH:mm"),
      contraparte: v.contraparte.trim(),
      tipo_documento_adquirente: v.tipo_documento_adquirente,
      documento: v.documento?.trim() || undefined,
      prefijo: v.prefijo?.trim(),
      resolucion_numero: v.resolucion_numero?.trim(),
      resolucion_fecha: v.resolucion_fecha?.format("YYYY-MM-DD"),
      rango_desde: v.rango_desde,
      rango_hasta: v.rango_hasta,
      orden_compra: v.orden_compra?.trim() || undefined,
      email: v.email?.trim() || undefined,
      notas: v.notas?.trim() || undefined,
      quote_id: v.tipo === "venta" ? v.quote_id ?? null : null,
      party_id: v.party_id ?? null,
      condicion_pago: v.condicion_pago ?? "contado",
      medio_pago: v.medio_pago,
      dias_credito: v.condicion_pago === "credito" ? v.dias_credito ?? 0 : 0,
      fecha_vencimiento:
        v.condicion_pago === "credito" ? v.fecha_vencimiento?.format("YYYY-MM-DD") ?? null : null,
      account_id: v.account_id ?? null,
      retencion_fuente: v.retencion_fuente ?? 0,
      retencion_iva: v.retencion_iva ?? 0,
      retencion_ica: v.retencion_ica ?? 0,
      items: (v.items ?? []).map((l) => ({
        product_id: l.product_id!,
        descripcion: l.descripcion?.trim() || undefined,
        unidad_medida: l.unidad_medida?.trim() || "UND",
        cantidad: l.cantidad!,
        precio_unitario: l.precio_unitario!,
        descuento_pct: l.descuento_pct ?? 0,
        impuesto_pct: l.impuesto_pct ?? 0,
        inc_pct: l.inc_pct ?? 0,
        otro_impuesto_nombre: l.otro_impuesto_nombre?.trim() || undefined,
        otro_impuesto_pct: l.otro_impuesto_pct ?? 0,
      })),
    };
    setSaving(true);
    try {
      const r = editId ? await updateInvoice(editId, payload) : await createInvoice(payload);
      try {
        const fiscal: FiscalSnapshot = {
          resolucion_numero: v.resolucion_numero,
          resolucion_fecha: v.resolucion_fecha?.format("YYYY-MM-DD"),
          rango_desde: v.rango_desde,
          rango_hasta: v.rango_hasta,
        };
        localStorage.setItem(`${FISCAL_PREFIX}${v.tipo}`, JSON.stringify(fiscal));
      } catch {
        // Si el navegador bloquea localStorage, la factura ya quedó guardada.
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // El borrador local es comodidad; la factura ya quedó guardada.
      }
      setDraftSavedAt(null);
      setDirty(false);
      message.success(editId ? "Factura actualizada" : "Borrador creado");
      navigate(`/facturas/${r.id ?? editId}`);
    } catch (e) {
      const { message: msg, fieldCount } = applyApiErrors(e, form, "No se pudo guardar");
      message.error(msg);
      if (fieldCount > 0) {
        const first = form.getFieldsError().find((f) => f.errors.length > 0);
        if (first) goToField(first.name);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-invoice-editor" ref={editorRef}>
      <h1 className="ui-visually-hidden">
        {editId ? `Factura ${prefijo ?? ""}-${editId}` : "Nueva factura"}
      </h1>
      <p className="ui-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <Form<FormValues>
        form={form}
        layout="vertical"
        validateTrigger={["onBlur", "onChange"]}
        onFinish={onFinish}
        onFinishFailed={({ errorFields }) => {
          if (errorFields[0]) goToField(errorFields[0].name);
          message.error("Revisa los campos marcados antes de guardar");
        }}
        onValuesChange={() => setDirty(true)}
        initialValues={{
          tipo: initialTipo,
          fecha: dayjs(),
          hora_expedicion: dayjs(),
          resolucion_fecha: dayjs(),
          prefijo: initialTipo === "compra" ? "COM" : "FAC",
          tipo_documento_adquirente: "NIT",
          medio_pago: "transferencia",
          rango_desde: 1,
          rango_hasta: 9999,
          condicion_pago: "contado",
          dias_credito: 0,
          items: [{ cantidad: 1 }],
        }}
      >
        <div className="ui-invoice-grid">
          <header className="ui-invoice-head">
            <div className="ui-invoice-head__issuer">
              {company.logo_url ? (
                <img
                  className="ui-invoice-head__logo"
                  src={company.logo_url}
                  alt={`Logotipo de ${company.nombre}`}
                />
              ) : (
                <span className="ui-invoice-head__mark" aria-hidden="true">
                  {company.nombre.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="ui-invoice-head__identity">
                <strong>{company.nombre}</strong>
                <span>{[company.nit, company.regimen].filter(Boolean).join(" · ")}</span>
                {company.direccion && <span>{company.direccion}</span>}
                <span>{[company.telefono, company.email].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            <div className="ui-invoice-head__doc">
              <span className="ui-invoice-head__kind">
                {tipo === "compra" ? "Factura de compra" : "Factura de venta"}
              </span>
              <strong className="ui-invoice-head__number">
                {editId ? `${prefijo ?? ""}-${editId}` : "BORRADOR"}
              </strong>
              <div className="ui-invoice-head__meta">
                <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
                  <Select
                    variant="borderless"
                    options={TIPO_OPTIONS}
                    disabled={!!editId}
                  />
                </Form.Item>
                <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]}>
                  <DatePicker variant="borderless" format="DD/MM/YYYY" />
                </Form.Item>
                <Form.Item
                  name="hora_expedicion"
                  label="Hora"
                  rules={[{ required: true, message: "Ingresa la hora de expedición" }]}
                >
                  <TimePicker variant="borderless" format="HH:mm" />
                </Form.Item>
              </div>
            </div>
          </header>

          <div className="ui-invoice-parties">
            <span className="ui-invoice-rowlabel">Facturar a</span>
            <div className="ui-invoice-parties__fields">
              <Form.Item
                name="party_id"
                label="Tercero"
                tooltip="Al elegirlo se cargan el documento y el correo."
              >
                <Select
                  variant="borderless"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Buscar tercero (opcional)"
                  onChange={onPartyChange}
                  options={parties.map((p) => ({
                    value: p.id,
                    label: `${p.nombre}${p.documento ? ` · ${p.documento}` : ""}`,
                  }))}
                />
              </Form.Item>
              <Form.Item
                className="ui-invoice-parties__name"
                name="contraparte"
                label={tipo === "compra" ? "Proveedor" : "Cliente"}
                rules={[
                  { required: true, message: "Ingresa el nombre de la contraparte" },
                  { min: 2, message: "Escribe al menos 2 caracteres" },
                ]}
              >
                <Input
                  variant="borderless"
                  placeholder="Razón social o nombre"
                  autoComplete="organization"
                  allowClear
                />
              </Form.Item>
              <div className="ui-invoice-parties__row">
                <Form.Item
                  name="tipo_documento_adquirente"
                  label="Tipo"
                  rules={[{ required: true, message: "Elige el tipo de documento" }]}
                >
                  <Select variant="borderless" options={DOCUMENTO_OPTIONS} />
                </Form.Item>
                <Form.Item
                  name="documento"
                  label="Número"
                  rules={[{ required: documentoRequerido, message: "Ingresa el número de documento" }]}
                >
                  <Input
                    variant="borderless"
                    placeholder="NIT / Cédula"
                    inputMode={tipoDocumento === "NIT" || tipoDocumento === "CC" ? "numeric" : "text"}
                    allowClear
                  />
                </Form.Item>
              </div>
              <Form.Item
                name="email"
                label="Correo"
                rules={[{ type: "email", message: "Email inválido" }, { max: 150 }]}
              >
                <Input
                  variant="borderless"
                  placeholder="correo@empresa.com"
                  type="email"
                  autoComplete="email"
                  allowClear
                />
              </Form.Item>
            </div>
            <span className="ui-invoice-rowlabel">Condiciones</span>
            <div className="ui-invoice-parties__fields">
              <div className="ui-invoice-parties__row">
                <Form.Item name="condicion_pago" label="Forma de pago">
                  <Select
                    variant="borderless"
                    options={[
                      { value: "contado", label: "Contado" },
                      { value: "credito", label: "Crédito" },
                    ]}
                    onChange={(v) => {
                      if (v === "contado") {
                        form.setFieldsValue({ dias_credito: 0, fecha_vencimiento: null });
                        return;
                      }
                      const dias = form.getFieldValue("dias_credito") || 30;
                      form.setFieldsValue({ dias_credito: dias });
                      applyCreditDays(dias);
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="medio_pago"
                  label="Medio de pago"
                  rules={[{ required: true, message: "Elige el medio de pago" }]}
                >
                  <Select variant="borderless" options={MEDIO_PAGO_OPTIONS} />
                </Form.Item>
              </div>
              {condicionPago === "credito" && (
                <div className="ui-invoice-parties__row">
                  <Form.Item name="dias_credito" label="Días">
                    <InputNumber
                      variant="borderless"
                      min={0}
                      max={3650}
                      placeholder="30"
                      suffix="días"
                      onChange={(v) => v !== null && applyCreditDays(Number(v))}
                    />
                  </Form.Item>
                  <Form.Item name="fecha_vencimiento" label="Vence">
                    <DatePicker variant="borderless" format="DD/MM/YYYY" />
                  </Form.Item>
                </div>
              )}
              {quoteInfo && (
                <p className="ui-invoice-hint">
                  Cotización {quoteInfo.numero} · saldo {money(saldoCotizado)}
                  {quoteEntregada && " · entregada"}
                </p>
              )}
            </div>
          </div>

          <div className="ui-invoice-table">
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
                      throw new Error("Un producto no puede repetirse en dos líneas");
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove, move }, { errors }) => {
                addLineRef.current = add;
                removeLineRef.current = remove;
                return (
                <>
                  <div
                    role="table"
                    aria-label="Líneas de la factura"
                    aria-colcount={6}
                    aria-rowcount={fields.length + 1}
                  >
                  <div className="ui-invoice-table__head" role="row">
                    <span id="inv-col-index" role="columnheader" aria-colindex={1}>#</span>
                    <span id="inv-col-product" role="columnheader" aria-colindex={2}>Descripción</span>
                    <span id="inv-col-qty" role="columnheader" aria-colindex={3}>Cant.</span>
                    <span id="inv-col-price" role="columnheader" aria-colindex={4}>Precio unit.</span>
                    <span id="inv-col-total" role="columnheader" aria-colindex={5}>Total</span>
                    <span role="columnheader" aria-colindex={6}>
                      <Tooltip title="Pegar varias líneas desde Excel">
                        <Button
                          type="text"
                          size="small"
                          aria-label="Pegar líneas desde Excel"
                          icon={<SnippetsOutlined />}
                          onClick={() => setPasteOpen(true)}
                        />
                      </Tooltip>
                    </span>
                  </div>
                  {fields.map(({ key, name }) => {
                    const l = lineas[name];
                    const p = l?.product_id ? products[l.product_id] : undefined;
                    let flag;
                    if (quoteEntregada && tipo !== "compra") {
                      const incluido = enCotizacion(l?.product_id);
                      flag = (
                        <Tooltip
                          title={
                            incluido
                              ? "El stock salió al entregar la cotización; al confirmar no se vuelve a descontar."
                              : "Producto agregado después de la entrega: esta factura tampoco descuenta stock."
                          }
                        >
                          <Tag color={incluido ? "green" : "orange"} tabIndex={0}>
                            {incluido ? "Entregado" : "Agregado tras entrega"}
                          </Tag>
                        </Tooltip>
                      );
                    } else if (p && p.stock_actual !== undefined) {
                      flag = (
                        <StockTag
                          stockActual={p.stock_actual}
                          stockMinimo={p.stock_minimo}
                          solicitado={tipo === "compra" ? undefined : l?.cantidad}
                        />
                      );
                    }
                    // El semáforo también vive en la fila: un faltante no debe
                    // esconderse dentro del panel desplegable de detalle.
                    const stock =
                      p && p.stock_actual !== undefined && tipo !== "compra"
                        ? (l?.cantidad ?? 0) > p.stock_actual
                          ? {
                              tone: "out",
                              text: `Stock insuficiente · disponible ${p.stock_actual}, solicitado ${l?.cantidad ?? 0}`,
                            }
                          : p.stock_minimo !== undefined && p.stock_actual <= p.stock_minimo
                            ? {
                                tone: "low",
                                text: `Stock bajo · ${p.stock_actual} / mín. ${p.stock_minimo}`,
                              }
                            : { tone: "ok", text: `Stock disponible · ${p.stock_actual}` }
                        : null;
                    // El producto ya imprime nombre y SKU en la columna; el panel
                    // solo viaja al papel cuando la descripción fue personalizada.
                    const descripcionCustom =
                      !!l?.descripcion?.trim() && l.descripcion.trim() !== p?.nombre;
                    return (
                      <div
                        className="ui-invoice-table__row"
                        key={key}
                        role="row"
                        aria-rowindex={name + 2}
                        aria-label={`Línea ${name + 1}`}
                      >
                        <span
                          className="ui-invoice-table__index"
                          role="cell"
                          aria-colindex={1}
                          aria-label="Número de línea"
                        >
                          {name + 1}
                        </span>
                        <div className="ui-invoice-table__product" role="cell" aria-colindex={2}>
                          <Form.Item
                            name={[name, "product_id"]}
                            label="Producto"
                            rules={[{ required: true, message: "Elige un producto" }]}
                          >
                            <ProductSelect
                              variant="borderless"
                              products={products}
                              resultIds={resultIds}
                              loading={loading}
                              onSearch={search}
                              onChange={(pid) => onProductChange(name, pid!)}
                              takenIds={
                                new Set(
                                  lineas
                                    .filter((_, i) => i !== name)
                                    .map((x) => x?.product_id)
                                    .filter((id): id is number => typeof id === "number")
                                )
                              }
                            />
                          </Form.Item>
                          {stock && (
                            <Tooltip title={stock.text}>
                              <span
                                className={`ui-invoice-table__stock is-${stock.tone}`}
                                role="img"
                                tabIndex={0}
                                aria-label={stock.text}
                              />
                            </Tooltip>
                          )}
                          <Tooltip title="Descuento, IVA y otros datos de la línea">
                            <Button
                              type="text"
                              size="small"
                              className={`ui-invoice-table__detail${detailsOpen.has(key) ? " is-open" : ""}`}
                              aria-label={`Descuento e impuestos de la línea ${name + 1}`}
                              aria-expanded={detailsOpen.has(key)}
                              aria-controls={`ui-invoice-detalle-${key}`}
                              onClick={() => toggleDetails(key)}
                              icon={<PercentageOutlined className="ui-invoice-table__detail-icon" />}
                            >
                              <DownOutlined className="ui-invoice-table__detail-caret" />
                            </Button>
                          </Tooltip>
                        </div>
                        <div className="ui-invoice-table__cell" role="cell" aria-colindex={3}>
                          <Form.Item
                            name={[name, "cantidad"]}
                            label="Cantidad"
                            rules={[{ required: true, message: "Ingresa la cantidad" }]}
                          >
                            <InputNumber variant="borderless" min={1} placeholder="1" />
                          </Form.Item>
                        </div>
                        <div className="ui-invoice-table__cell" role="cell" aria-colindex={4}>
                          <Form.Item
                            name={[name, "precio_unitario"]}
                            label="Precio unitario"
                            rules={[{ required: true, message: "Ingresa el precio unitario" }]}
                          >
                            <InputNumber
                              {...currencyInputProps}
                              variant="borderless"
                              min={0.01}
                              placeholder="$ 0"
                            />
                          </Form.Item>
                        </div>
                        <div className="ui-invoice-table__total num" role="cell" aria-colindex={5}>
                          {money(lineTotal(l ?? {}))}
                        </div>
                        <div className="ui-invoice-table__actions" role="cell" aria-colindex={6}>
                          <Dropdown
                            trigger={["click"]}
                            placement="bottomRight"
                            menu={{
                              items: [
                                {
                                  key: "up",
                                  label: "Mover arriba",
                                  icon: <ArrowUpOutlined />,
                                  disabled: name === 0,
                                  onClick: () => move(name, name - 1),
                                },
                                {
                                  key: "down",
                                  label: "Mover abajo",
                                  icon: <ArrowDownOutlined />,
                                  disabled: name === fields.length - 1,
                                  onClick: () => move(name, name + 1),
                                },
                                {
                                  key: "clone",
                                  label: "Clonar importes",
                                  icon: <CopyOutlined />,
                                  onClick: () => add({ ...l, product_id: undefined }),
                                },
                                { type: "divider" },
                                {
                                  key: "remove",
                                  label: "Quitar línea",
                                  icon: <MinusCircleOutlined />,
                                  danger: true,
                                  onClick: () => remove(name),
                                },
                              ],
                            }}
                          >
                            <Button
                              type="text"
                              aria-label={`Acciones de la línea ${name + 1}`}
                              icon={<MoreOutlined />}
                            />
                          </Dropdown>
                        </div>
                        {/* Siempre en el DOM: al imprimir, la descripción facturada
                            debe aparecer aunque el panel esté plegado en pantalla. */}
                        <div
                          className={`ui-invoice-table__detail-row${
                            detailsOpen.has(key) ? "" : " is-collapsed"
                          }${tieneDetalle(l, tipo) ? "" : " is-empty"}${
                            descripcionCustom ? " has-custom-description" : ""
                          }`}
                          id={`ui-invoice-detalle-${key}`}
                        >
                            <Form.Item
                              className="ui-invoice-table__wide"
                              name={[name, "descripcion"]}
                              label="Descripción facturada"
                            >
                              <Input
                                variant="borderless"
                                maxLength={300}
                                showCount
                                placeholder="Texto que aparece en la factura"
                              />
                            </Form.Item>
                            <Form.Item
                              className="ui-invoice-table__detail-extra"
                              name={[name, "unidad_medida"]}
                              label="Unidad"
                              initialValue="UND"
                            >
                              <Input variant="borderless" maxLength={20} allowClear placeholder="UND" />
                            </Form.Item>
                            <Form.Item
                              className="ui-invoice-table__detail-extra"
                              name={[name, "descuento_pct"]}
                              label="Descuento %"
                              initialValue={0}
                            >
                              <InputNumber variant="borderless" min={0} max={100} placeholder="0" />
                            </Form.Item>
                            <Form.Item
                              className="ui-invoice-table__detail-extra"
                              name={[name, "impuesto_pct"]}
                              label="IVA %"
                              initialValue={IMPUESTO_DEFAULT[tipo ?? "venta"]}
                            >
                              <InputNumber variant="borderless" min={0} max={100} placeholder="19" />
                            </Form.Item>
                            <Form.Item
                              className="ui-invoice-table__detail-extra"
                              name={[name, "inc_pct"]}
                              label="INC %"
                              initialValue={0}
                            >
                              <InputNumber variant="borderless" min={0} max={100} placeholder="0" />
                            </Form.Item>
                            <Form.Item
                              className="ui-invoice-table__wide ui-invoice-table__detail-extra"
                              name={[name, "otro_impuesto_nombre"]}
                              label="Nombre del tributo"
                            >
                              <Input variant="borderless" maxLength={60} placeholder="Ej.: ICA" allowClear />
                            </Form.Item>
                            <Form.Item
                              className="ui-invoice-table__detail-extra"
                              name={[name, "otro_impuesto_pct"]}
                              label="Otro tributo %"
                              initialValue={0}
                            >
                              <InputNumber variant="borderless" min={0} max={100} placeholder="0" />
                            </Form.Item>
                            <div className="ui-invoice-table__flag">{flag}</div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  <Form.ErrorList errors={errors} />
                  <Button
                    type="default"
                    block
                    className="ui-invoice-table__add"
                    icon={<PlusOutlined className="ui-invoice-table__add-icon" />}
                    onClick={() => addLine()}
                  >
                    <span className="ui-invoice-table__add-label">Agregar línea</span>
                    <Tooltip title="Atajo: Alt + Enter">
                      <span className="ui-invoice-table__add-shortcut">Alt + ↵</span>
                    </Tooltip>
                  </Button>
                  <Button
                    type="link"
                    block
                    className="ui-invoice-table__paste-mobile"
                    icon={<SnippetsOutlined />}
                    onClick={() => setPasteOpen(true)}
                  >
                    Pegar varias líneas desde Excel
                  </Button>
                </>
                );
              }}
            </Form.List>
          </div>

          {excedeCotizacion && (
            <p className="ui-invoice-alert" role="status">
              Supera el saldo cotizado en {money(t.total - saldoCotizado)}
            </p>
          )}

          <div className="ui-invoice-closing">
            <Form.Item name="notas" label="Notas" rules={[{ max: 2000 }]}>
              <Input.TextArea
                variant="borderless"
                rows={2}
                maxLength={2000}
                showCount
                placeholder="Condiciones o observaciones (opcional)"
              />
            </Form.Item>
            <DocumentTotals
              rows={[
                { label: "Subtotal", value: money(t.subtotal), hint: "Suma de cantidad × precio de cada línea" },
                { label: "Descuento", value: money(-t.descuento), hint: "Descuentos por línea" },
                { label: "IVA", value: money(t.impuesto), hint: "IVA aplicado por línea" },
                { label: "INC", value: money(t.inc) },
                { label: "Otros impuestos", value: money(t.otros) },
                { label: "Retenciones", value: money(-retenciones), hint: "Informativas" },
              ]}
              totalLabel="Total factura"
              totalValue={money(t.total)}
              totalHint="Total de la factura antes de restar las retenciones informativas"
              net={retenciones > 0 ? { label: "Neto a pagar", value: money(totalNeto) } : undefined}
            />
          </div>

          <section className={`ui-invoice-more${moreOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="ui-invoice-more__toggle"
              aria-expanded={moreOpen}
              aria-controls="ui-invoice-more-body"
              onClick={() => setMoreOpen((value) => !value)}
            >
              <span className="ui-invoice-more__title">Información adicional</span>
              <span className="ui-invoice-more__summary">{moreSummary}</span>
              <DownOutlined className="ui-invoice-more__caret" />
            </button>
            <div
              className={`ui-invoice-more__body${moreOpen ? "" : " is-collapsed"}`}
              id="ui-invoice-more-body"
            >
              <div className="ui-invoice-foot__row">
                <span className="ui-invoice-rowlabel">Resolución</span>
                <div className="ui-invoice-foot__fields">
                  <Form.Item
                    name="prefijo"
                    label="Prefijo"
                    rules={[
                      { required: true, message: "Ingresa el prefijo" },
                      { max: 10, message: "Máximo 10 caracteres" },
                    ]}
                  >
                    <Input variant="borderless" placeholder="FAC" style={{ textTransform: "uppercase" }} disabled={!!editId} />
                  </Form.Item>
                  <Form.Item
                    className="ui-invoice-foot__wide"
                    name="resolucion_numero"
                    label="Resolución"
                    rules={[
                      { required: tipo === "venta", message: "Ingresa el número de resolución" },
                      { max: 40 },
                    ]}
                  >
                    <Input variant="borderless" placeholder="RES-0001" />
                  </Form.Item>
                  <Form.Item
                    name="resolucion_fecha"
                    label="Fecha resolución"
                    rules={[{ required: tipo === "venta", message: "Elige la fecha de la resolución" }]}
                  >
                    <DatePicker variant="borderless" format="DD/MM/YYYY" />
                  </Form.Item>
                  <Form.Item
                    name="rango_desde"
                    label="Desde"
                    dependencies={["rango_hasta"]}
                    rules={[
                      { required: true, message: "Ingresa el rango desde" },
                      {
                        validator: (_, value?: number) => {
                          const desde = value;
                          const hasta = form.getFieldValue("rango_hasta") as number | undefined;
                          if (desde && hasta && desde > hasta) {
                            return Promise.reject(new Error("El rango desde debe ser menor o igual al rango hasta"));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber variant="borderless" min={1} placeholder="1" />
                  </Form.Item>
                  <Form.Item
                    name="rango_hasta"
                    label="Hasta"
                    rules={[{ required: true, message: "Ingresa el rango hasta" }]}
                  >
                    <InputNumber variant="borderless" min={1} placeholder="9999" />
                  </Form.Item>
                </div>
              </div>
              {rangoInvalido && (
                <p className="ui-invoice-error ui-invoice-foot__error" role="alert">
                  El rango desde debe ser menor o igual al rango hasta.
                </p>
              )}
              <div className="ui-invoice-foot__row">
                <span className="ui-invoice-rowlabel">Referencia</span>
                <div className="ui-invoice-foot__fields">
                  {tipo !== "compra" && (
                    <Form.Item name="quote_id" label="Cotización">
                      <Select
                        variant="borderless"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder="Sin cotización"
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
                  <Form.Item name="orden_compra" label="Orden de compra">
                    <Input variant="borderless" placeholder="OC-0001" />
                  </Form.Item>
                </div>
              </div>
              <div className="ui-invoice-foot__row">
                <span className="ui-invoice-rowlabel">Contabilidad</span>
                <div className="ui-invoice-foot__fields">
                  <Form.Item
                    className="ui-invoice-foot__wide"
                    name="account_id"
                    label="Cuenta de destino"
                  >
                    <Select
                      variant="borderless"
                      allowClear
                      placeholder="Cuenta por defecto"
                      options={accounts.map((a) => ({
                        value: a.id,
                        label: `${a.nombre} (${a.tipo}) · saldo ${money(a.saldo_actual)}`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="retencion_fuente" label="Ret. fuente" initialValue={0}>
                    <InputNumber {...currencyInputProps} variant="borderless" placeholder="$ 0" />
                  </Form.Item>
                  <Form.Item name="retencion_iva" label="Ret. IVA" initialValue={0}>
                    <InputNumber {...currencyInputProps} variant="borderless" placeholder="$ 0" />
                  </Form.Item>
                  <Form.Item name="retencion_ica" label="Ret. ICA" initialValue={0}>
                    <InputNumber {...currencyInputProps} variant="borderless" placeholder="$ 0" />
                  </Form.Item>
                </div>
              </div>
              <div className="ui-invoice-foot__legal">
                Hora local de Bogotá (UTC-5) · Los datos fiscales se validan al confirmar.
              </div>
            </div>
          </section>
        </div>

        <DocumentFormFooter
          saving={saving}
          dirty={dirty}
          onCancel={cancel}
          submitLabel="Guardar"
          totalLabel="Total factura"
          totalValue={money(t.total)}
          net={retenciones > 0 ? { label: "Neto a pagar", value: money(totalNeto) } : undefined}
          onSaveDraft={saveDraft}
          draftSavedAt={draftSavedAt}
          eyebrow={editId ? `Factura ${prefijo ?? ""}-${editId}` : "Nueva factura"}
          checklist={fiscalChecks.map((check) => ({
            label: check.label,
            ok: check.ok,
            onGo: () =>
              goToField(typeof check.field === "string" ? [check.field] : check.field),
          }))}
        />
      </Form>

      <PasteLinesDialog
        open={pasteOpen}
        products={products}
        onCancel={() => setPasteOpen(false)}
        onConfirm={onPasteLines}
      />

    </div>
  );
}
