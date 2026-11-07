import { useEffect, useState } from "react";
import { Button, DatePicker, Empty, Input, Select, Table, Tooltip, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listInvoices } from "@/services/invoicesService";
import type { Invoice, InvoiceEstado, InvoiceTipo } from "@/types";
import { ESTADO_OPTIONS, InvoiceEstadoTag, InvoiceTipoTag, TIPO_OPTIONS, fmtDate, money } from "./InvoiceUtils";
import TableSkeleton from "@/components/TableSkeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/context/AuthContext";

const FMT = "YYYY-MM-DD";

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { canOperate } = useAuth();

  const q = sp.get("q") ?? "";
  const tipo = (sp.get("tipo") as InvoiceTipo | null) ?? undefined;
  const estado = (sp.get("estado") as InvoiceEstado | null) ?? undefined;
  const desde = sp.get("desde") ?? undefined;
  const hasta = sp.get("hasta") ?? undefined;
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
    listInvoices({ tipo, estado, desde, hasta, page, pageSize })
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
  }, [q, tipo, estado, desde, hasta, page, pageSize]);

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
            onChange: (p, s) => update({ page: String(p), pageSize: String(s) }, false),
          }}
          columns={[
            { title: "Número", dataIndex: "numero" },
            { title: "Tipo", dataIndex: "tipo", render: (t: InvoiceTipo) => <InvoiceTipoTag tipo={t} /> },
            { title: "Contraparte", dataIndex: "contraparte" },
            {
              title: "Estado",
              dataIndex: "estado",
              render: (e: InvoiceEstado) => <InvoiceEstadoTag estado={e} />,
            },
            { title: "Fecha", dataIndex: "fecha", render: (v: string) => fmtDate(v) },
            { title: <Tooltip title="Total de la factura">Total</Tooltip>, dataIndex: "total", align: "right", render: (v: number) => <strong>{money(v)}</strong> },
            { title: "Creado por", dataIndex: "creador", responsive: ["lg"] },
          ]}
        />
      )}
    </>
  );
}
