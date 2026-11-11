import { useEffect, useState } from "react";
import { Button, DatePicker, Empty, Input, Select, Table, Tooltip, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listInvoices } from "@/services/invoicesService";
import type { Invoice, InvoiceEstado, InvoiceSortKey, InvoiceTipo } from "@/types";
import { ESTADO_OPTIONS, InvoiceEstadoTag, InvoiceTipoTag, TIPO_OPTIONS, fmtDate, money } from "./InvoiceUtils";
import TableSkeleton from "@/components/TableSkeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/context/AuthContext";

const FMT = "YYYY-MM-DD";

const SORT_KEYS: InvoiceSortKey[] = [
  "numero",
  "tipo",
  "contraparte",
  "estado",
  "fecha",
  "total",
  "creador",
];

const SORT_BY_FIELD: Record<string, InvoiceSortKey> = {
  numero: "numero",
  tipo: "tipo",
  contraparte: "contraparte",
  estado: "estado",
  fecha: "fecha",
  total: "total",
  creador: "creador",
};

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { canOperate } = useAuth();

  const q = sp.get("q") ?? "";
  const tipo = (sp.get("tipo") as InvoiceTipo | null) ?? undefined;
  const estado = (sp.get("estado") as InvoiceEstado | null) ?? undefined;
  const desde = sp.get("desde") ?? undefined;
  const hasta = sp.get("hasta") ?? undefined;
  const rawSort = sp.get("sort");
  const sort = SORT_KEYS.includes(rawSort as InvoiceSortKey)
    ? (rawSort as InvoiceSortKey)
    : undefined;
  const rawOrder = sp.get("order");
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined;
  const page = Number(sp.get("page") ?? 1);
  const pageSize = Number(sp.get("pageSize") ?? 10);

  const [rows, setRows] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(q);

  useDocumentTitle("Facturas");

  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== q) update({ q: text.trim() || undefined });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // El backend lista por tipo/estado/fecha; "q" (contraparte) lo filtramos client-side si el API no lo soporta
    listInvoices({ tipo, estado, desde, hasta, sort, order: sort ? order : undefined, page, pageSize })
      .then((r) => {
        if (cancelled) return;
        const filtered = q
          ? r.data.filter(
              (x) =>
                x.numero.toLowerCase().includes(q.toLowerCase()) ||
                x.contraparte.toLowerCase().includes(q.toLowerCase())
            )
          : r.data;
        setRows(filtered);
        setTotal(q ? filtered.length : r.total);
      })
      .catch(() => message.error("No se pudieron cargar las facturas"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, tipo, estado, desde, hasta, sort, order, page, pageSize]);

  const update = (changes: Record<string, string | undefined>, resetPage = true) =>
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true }
    );

  const sortOrderFor = (key: InvoiceSortKey): "ascend" | "descend" | null =>
    sort === key ? (order === "desc" ? "descend" : "ascend") : null;

  const hasFilters = !!(q || tipo || estado || desde || hasta);
  const firstLoad = loading && rows.length === 0;

  return (
    <>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}
      >
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Facturas
          </Typography.Title>
          <Typography.Text type="secondary">
            Registra compras y ventas, confirma para actualizar stock y finanzas.
          </Typography.Text>
        </div>
        {canOperate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/facturas/nuevo")}>
            Nueva
          </Button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Buscar
          </Typography.Text>
          <Input.Search
            allowClear
            placeholder="Número o contraparte"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Tipo
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 140 }}
            value={tipo}
            options={TIPO_OPTIONS}
            onChange={(v) => update({ tipo: v })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Estado
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 150 }}
            value={estado}
            options={ESTADO_OPTIONS}
            onChange={(v) => update({ estado: v })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Rango de fechas
          </Typography.Text>
          <DatePicker.RangePicker
            format={FMT}
            value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
            onChange={(v) => update({ desde: v?.[0]?.format(FMT), hasta: v?.[1]?.format(FMT) })}
          />
        </div>
        {hasFilters && (
          <Button
            onClick={() => {
              setText("");
              setSp({}, { replace: true });
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<Invoice>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          onRow={(r) => ({ onClick: () => navigate(`/facturas/${r.id}`), style: { cursor: "pointer" } })}
          locale={{
            emptyText: (
              <Empty description={hasFilters ? "Ninguna factura coincide con los filtros" : "Aún no hay facturas"}>
                {hasFilters ? (
                  <Button
                    onClick={() => {
                      setText("");
                      setSp({}, { replace: true });
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : (
                  canOperate && (
                    <Button type="primary" onClick={() => navigate("/facturas/nuevo")}>
                      Crear la primera
                    </Button>
                  )
                )}
              </Empty>
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} facturas`,
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra.action === "sort") {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const nextSort = s?.order ? SORT_BY_FIELD[String(s.field)] : undefined;
              // Al cambiar el orden se vuelve a la primera página.
              update(
                {
                  sort: nextSort,
                  order: nextSort
                    ? s?.order === "descend"
                      ? "desc"
                      : "asc"
                    : undefined,
                  pageSize: pagination.pageSize ? String(pagination.pageSize) : undefined,
                },
                true
              );
              return;
            }
            // Paginar conserva el orden vigente.
            update(
              {
                page: String(pagination.current ?? 1),
                pageSize: pagination.pageSize ? String(pagination.pageSize) : undefined,
              },
              false
            );
          }}
          columns={[
            { title: "Número", dataIndex: "numero", sorter: true, sortOrder: sortOrderFor("numero") },
            {
              title: "Tipo",
              dataIndex: "tipo",
              sorter: true,
              sortOrder: sortOrderFor("tipo"),
              render: (t: InvoiceTipo) => <InvoiceTipoTag tipo={t} />,
            },
            {
              title: "Contraparte",
              dataIndex: "contraparte",
              sorter: true,
              sortOrder: sortOrderFor("contraparte"),
            },
            {
              title: "Estado",
              dataIndex: "estado",
              sorter: true,
              sortOrder: sortOrderFor("estado"),
              render: (e: InvoiceEstado) => <InvoiceEstadoTag estado={e} />,
            },
            {
              title: "Fecha",
              dataIndex: "fecha",
              sorter: true,
              sortOrder: sortOrderFor("fecha"),
              render: (v: string) => fmtDate(v),
            },
            {
              title: <Tooltip title="Total de la factura">Total</Tooltip>,
              dataIndex: "total",
              align: "right",
              sorter: true,
              sortOrder: sortOrderFor("total"),
              render: (v: number) => <strong>{money(v)}</strong>,
            },
            {
              title: "Creado por",
              dataIndex: "creador",
              responsive: ["lg"],
              sorter: true,
              sortOrder: sortOrderFor("creador"),
            },
          ]}
        />
      )}
    </>
  );
}
