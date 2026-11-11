import { useEffect, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
} from "antd";
import dayjs from "dayjs";
import { isAxiosError } from "axios";
import { createInvoiceAdjustment } from "@/services/invoicesService";
import type { InvoiceDetail, InvoiceItem } from "@/types";
import { money } from "./InvoiceUtils";

interface RowState {
  invoice_item_id: number;
  sku?: string;
  producto?: string;
  cantidadOriginal: number;
  maxCantidad: number;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  impuesto_pct: number;
  selected: boolean;
}

interface Props {
  open: boolean;
  invoice: InvoiceDetail;
  onCancel: () => void;
  onSaved: () => void;
}

const lineTotal = (r: RowState) => {
  const bruto = r.cantidad * r.precio_unitario;
  const descuento = (bruto * r.descuento_pct) / 100;
  const base = bruto - descuento;
  const iva = (base * r.impuesto_pct) / 100;
  return base + iva;
};

export default function InvoiceAdjustmentModal({ open, invoice, onCancel, onSaved }: Props) {
  const { message } = App.useApp();
  const [tipo, setTipo] = useState<"credito" | "debito">("credito");
  const [fecha, setFecha] = useState<dayjs.Dayjs>(dayjs());
  const [motivo, setMotivo] = useState("");
  const [afectaStock, setAfectaStock] = useState(true);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo("credito");
    setFecha(dayjs());
    setMotivo("");
    setAfectaStock(true);
    setRows(
      invoice.items.map((it: InvoiceItem) => ({
        invoice_item_id: it.id as number,
        sku: it.sku,
        producto: it.producto,
        cantidadOriginal: it.cantidad,
        maxCantidad: (it as InvoiceItem & { cantidad_disponible?: number }).cantidad_disponible ?? it.cantidad,
        cantidad: 0,
        precio_unitario: it.precio_unitario,
        descuento_pct: it.descuento_pct,
        impuesto_pct: it.impuesto_pct,
        selected: false,
      }))
    );
  }, [open, invoice]);

  useEffect(() => {
    setAfectaStock(tipo === "credito");
  }, [tipo]);

  const updateRow = (id: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.invoice_item_id === id ? { ...r, ...patch } : r)));
  };

  const total = rows.reduce((acc, r) => (r.selected && r.cantidad > 0 ? acc + lineTotal(r) : acc), 0);

  const handleSave = async () => {
    const items = rows
      .filter((r) => r.selected && r.cantidad > 0)
      .map((r) => ({
        invoice_item_id: r.invoice_item_id,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
        descuento_pct: r.descuento_pct,
        impuesto_pct: r.impuesto_pct,
      }));
    if (items.length === 0) {
      message.error("Selecciona al menos una línea con cantidad mayor a cero");
      return;
    }
    setSaving(true);
    try {
      await createInvoiceAdjustment(invoice.id, {
        tipo,
        fecha: fecha.format("YYYY-MM-DD"),
        motivo: motivo.trim() || undefined,
        afecta_stock: afectaStock,
        items,
      });
      message.success(tipo === "credito" ? "Nota crédito creada" : "Nota débito creada");
      onSaved();
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(msg ?? "No se pudo crear la nota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={tipo === "credito" ? "Nueva nota crédito" : "Nueva nota débito"}
      onCancel={onCancel}
      onOk={handleSave}
      okText="Crear"
      cancelText="Cancelar"
      confirmLoading={saving}
      width={820}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Space wrap>
          <Form.Item label="Tipo" style={{ margin: 0 }}>
            <Space>
              <Button
                type={tipo === "credito" ? "primary" : "default"}
                onClick={() => setTipo("credito")}
              >
                Crédito
              </Button>
              <Button
                type={tipo === "debito" ? "primary" : "default"}
                onClick={() => setTipo("debito")}
              >
                Débito
              </Button>
            </Space>
          </Form.Item>
          <Form.Item label="Fecha" style={{ margin: 0 }}>
            <DatePicker value={fecha} onChange={(v) => v && setFecha(v)} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item label="Afecta stock" style={{ margin: 0 }}>
            <Switch checked={afectaStock} onChange={setAfectaStock} />
          </Form.Item>
        </Space>
        <Form.Item label="Motivo" style={{ margin: 0 }}>
          <Input.TextArea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Motivo o referencia de la nota"
          />
        </Form.Item>
        <Table<RowState>
          rowKey="invoice_item_id"
          pagination={false}
          size="small"
          dataSource={rows}
          columns={[
            {
              title: "",
              width: 40,
              render: (_: unknown, r) => (
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) => updateRow(r.invoice_item_id, { selected: e.target.checked })}
                />
              ),
            },
            { title: "SKU", dataIndex: "sku" },
            { title: "Producto", dataIndex: "producto" },
            {
              title: "Cant. original",
              dataIndex: "cantidadOriginal",
              align: "right",
            },
            {
              title: "Disponible",
              dataIndex: "maxCantidad",
              align: "right",
            },
            {
              title: "Cantidad",
              align: "right",
              render: (_: unknown, r) => (
                <InputNumber
                  min={1}
                  max={tipo === "credito" ? r.maxCantidad : undefined}
                  value={r.cantidad}
                  onChange={(v) => updateRow(r.invoice_item_id, { cantidad: Number(v ?? 0) })}
                  style={{ width: 80 }}
                />
              ),
            },
            {
              title: "Precio unit.",
              align: "right",
              render: (_: unknown, r) => (
                <InputNumber
                  min={0.01}
                  value={r.precio_unitario}
                  onChange={(v) => updateRow(r.invoice_item_id, { precio_unitario: Number(v ?? 0) })}
                  style={{ width: 110 }}
                />
              ),
            },
            {
              title: "Total línea",
              align: "right",
              render: (_: unknown, r) => money(r.selected ? lineTotal(r) : 0),
            },
          ]}
        />
        <div style={{ textAlign: "right", fontWeight: 700 }}>
          Total nota: {money(total)}
        </div>
      </Space>
    </Modal>
  );
}
