import { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Input, Modal, Select, Table, Tag } from "antd";
import { SnippetsOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { ProductOption } from "@/utils/productLookup";

export interface PastedLine {
  descripcion: string;
  cantidad: number;
  precio: number;
  sku?: string;
  productId?: number;
}

interface RawRow {
  key: number;
  cells: string[];
}

export interface PastedParseResult {
  rows: RawRow[];
  separator: "tab" | "semicolon" | "comma";
}

const asNumber = (text: string) => {
  const cleaned = text.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(cleaned);
};

/** Detecta el separador mirando la primera fila con varias celdas. */
function detectSeparator(text: string): "tab" | "semicolon" | "comma" {
  const line = text.split(/\r?\n/).find((l) => l.includes("\t") || l.includes(";") || l.includes(","));
  if (line?.includes("\t")) return "tab";
  if (line?.includes(";")) return "semicolon";
  return "comma";
}

export function parsePastedLines(text: string): PastedParseResult {
  const separator = detectSeparator(text);
  const splitChar = separator === "tab" ? "\t" : separator === "semicolon" ? ";" : ",";
  const rows = text
    .split(/\r?\n/)
    .map((row, key) => ({
      key,
      cells: row.split(splitChar).map((cell) => cell.trim().replace(/^"|"$/g, "")),
    }))
    .filter((row) => row.cells.some((cell) => cell.length > 0));
  return { rows, separator };
}

type Column = "descripcion" | "cantidad" | "precio" | "sku";

interface Props {
  open: boolean;
  products: Record<number, ProductOption>;
  onCancel: () => void;
  onConfirm: (lines: PastedLine[]) => void;
}

/**
 * Vista previa del pegado desde Excel. El usuario confirma el mapeo de columnas
 * antes de tocar las líneas del formulario: una celda mal copiada no debe
 * convertirse en una factura con precios equivocados.
 */
export default function PasteLinesDialog({ open, products, onCancel, onConfirm }: Props) {
  const { message } = App.useApp();
  const [raw, setRaw] = useState("");
  useEffect(() => {
    if (open) setRaw("");
  }, [open]);
  const parsed = useMemo(() => parsePastedLines(raw), [raw]);
  const [mapping, setMapping] = useState<Record<Column, number>>({
    descripcion: 0,
    cantidad: 1,
    precio: 2,
    sku: 3,
  });

  const preview = useMemo(
    () =>
      parsed.rows.map((row) => {
        const get = (col: Column) => (row.cells[mapping[col]] ?? "").trim().replace(/^"|"$/g, "");
        const descripcion = get("descripcion");
        const sku = get("sku");
        const catalog = Object.values(products);
        const match =
          (sku ? catalog.find((p) => p.sku.toLowerCase() === sku.toLowerCase()) : undefined) ??
          catalog.find(
            (p) =>
              p.nombre.trim().toLowerCase() === descripcion.trim().toLowerCase() ||
              descripcion.trim().toLowerCase().includes(p.nombre.trim().toLowerCase())
          );
        return {
          key: row.key,
          descripcion,
          cantidad: asNumber(get("cantidad")),
          precio: asNumber(get("precio")),
          sku,
          match,
        };
      }),
    [parsed.rows, products, mapping]
  );

  const valid = preview.filter((p) => p.descripcion && p.cantidad > 0 && p.precio > 0);
  const matched = valid.filter((p) => p.match);
  const skipped = parsed.rows.length - valid.length;
  const unmatched = valid.length - matched.length;

  const columns: ColumnsType<(typeof preview)[number]> = [
    { title: "#", width: 44, render: (_, __, i) => i + 1 },
    { title: "Descripción", dataIndex: "descripcion", ellipsis: true },
    { title: "Cant.", dataIndex: "cantidad", width: 90, align: "right" },
    {
      title: "Precio",
      dataIndex: "precio",
      width: 120,
      align: "right",
      render: (v: number) => v.toLocaleString("es-CO"),
    },
    {
      title: "Producto",
      dataIndex: "sku",
      width: 190,
      render: (sku: string, row) =>
        row.match ? (
          <Tag color="green">{row.match.nombre}</Tag>
        ) : sku ? (
          <Tag>SKU {sku} sin coincidencia</Tag>
        ) : (
          <span className="ui-paste__muted">Sin SKU</span>
        ),
    },
  ];

  const maxColumns = Math.max(4, ...parsed.rows.map((row) => row.cells.length));
  const columnOptions = Array.from({ length: Math.min(maxColumns, 12) }, (_, i) => ({
    value: i,
    label: `Columna ${i + 1}`,
  }));

  return (
    <Modal
      open={open}
      title="Pegar líneas desde Excel"
      okText={`Agregar ${matched.length} líneas`}
      cancelText="Cancelar"
      onOk={() =>
        onConfirm(
          matched.map((p) => ({
            descripcion: p.descripcion,
            cantidad: p.cantidad,
            precio: p.precio,
            sku: p.sku || undefined,
            productId: p.match?.id,
          }))
        )
      }
      onCancel={onCancel}
      okButtonProps={{ disabled: matched.length === 0 }}
      width={760}
    >
      <div className="ui-paste__source">
        <Input.TextArea
          autoFocus
          rows={4}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Pega aquí las celdas copiadas de Excel o Calc…"
          aria-label="Celdas copiadas desde Excel"
        />
        <Button
          icon={<SnippetsOutlined />}
          onClick={() => {
            navigator.clipboard
              .readText()
              .then((clip) => {
                setRaw(clip);
                if (!clip) message.info("El portapapeles está vacío");
              })
              .catch(() => message.warning("El navegador no permitió leer el portapapeles"));
          }}
        >
          Pegar del portapapeles
        </Button>
      </div>
      <p className="ui-paste__hint">
        Copia desde Excel o Calc y pega aquí. Se detectó separador{" "}
        <strong>
          {parsed.separator === "tab" ? "tabulación" : parsed.separator === "semicolon" ? ";" : ","}
        </strong>
        . Ajusta el origen de cada columna si hace falta.
      </p>
      <div className="ui-paste__mapping">
        {(["descripcion", "cantidad", "precio", "sku"] as Column[]).map((col) => (
          <label key={col}>
            {
              col === "descripcion"
                ? "Descripción"
                : col === "cantidad"
                  ? "Cantidad"
                  : col === "precio"
                    ? "Precio"
                    : "SKU (opcional)"
            }
            <Select
              size="small"
              value={mapping[col]}
              options={columnOptions}
              onChange={(value) => setMapping((m) => ({ ...m, [col]: value }))}
            />
          </label>
        ))}
      </div>
      {skipped > 0 && (
        <Alert
          className="ui-paste__alert"
          type="info"
          showIcon
          title={`${skipped} fila(s) omitida(s) por no tener descripción, cantidad y precio válidos`}
        />
      )}
      {unmatched > 0 && (
        <Alert
          className="ui-paste__alert"
          type="warning"
          showIcon
          title={`${unmatched} fila(s) no coinciden con un producto del catálogo y no se agregarán`}
        />
      )}
      <Table
        className="ui-paste__table"
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={preview}
        pagination={false}
        scroll={{ y: 260 }}
        locale={{ emptyText: "No se encontraron filas válidas" }}
      />
    </Modal>
  );
}
