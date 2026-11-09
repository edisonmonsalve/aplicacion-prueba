import { useEffect, useState } from "react";
import { App, Button, DatePicker, Empty, Input, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listQuotes } from "@/services/quotesService";
import type { Quote, QuoteStatus } from "@/types";
import { StatusTag, STATUS_OPTIONS, money, fmtDate } from "@/pages/quotes/QuoteUtils";
import { downloadCsv, fetchAllPages } from "@/utils/csv";
import TableSkeleton from "@/components/TableSkeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/context/AuthContext";

const FMT = "YYYY-MM-DD";

export default function QuotesPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [sp, setSp] = useSearchParams();
  const { canOperate } = useAuth();

  const q = sp.get("q") ?? "";
  const estado = (sp.get("estado") as QuoteStatus | null) ?? undefined;
  const desde = sp.get("desde") ?? undefined;
  const hasta = sp.get("hasta") ?? undefined;
  const page = Number(sp.get("page") ?? 1);
  const pageSize = Number(sp.get("pageSize") ?? 10);

  const [rows, setRows] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(q);
  const [exporting, setExporting] = useState(false);

  useDocumentTitle("Cotizaciones");

  // Debounce: busca 400 ms después de dejar de escribir
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
    listQuotes({ q: q || undefined, estado, desde, hasta, page, pageSize })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setTotal(r.total);
      })
      .catch(() => message.error("No se pudieron cargar las cotizaciones"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, estado, desde, hasta, page, pageSize, message]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages<Quote>((p) =>
        listQuotes({ q: q || undefined, estado, desde, hasta, page: p, pageSize: 100 })
      );
      downloadCsv(
        `cotizaciones-${dayjs().format("YYYY-MM-DD")}.csv`,
        [
          { header: "Número", value: (r) => r.numero },
          { header: "Cliente", value: (r) => r.customer_nombre },
          { header: "Documento", value: (r) => r.customer_documento },
          { header: "Estado", value: (r) => r.estado },
          { header: "Subtotal", value: (r) => r.subtotal },
          { header: "Descuento", value: (r) => r.descuento_total },
          { header: "Impuesto", value: (r) => r.impuesto_total },
          { header: "Total", value: (r) => r.total },
          { header: "Válido hasta", value: (r) => fmtDate(r.fecha_validez) },
          { header: "Creado por", value: (r) => r.creador },
        ],
        all
      );
    } catch {
      message.error("No se pudo exportar");
    } finally {
      setExporting(false);
    }
  };

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

  const hasFilters = !!(q || estado || desde || hasta);

  const firstLoad = loading && rows.length === 0;

  return (
    <>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}
      >
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Cotizaciones
          </Typography.Title>
          <Typography.Text type="secondary">
            Crea, envía y da seguimiento a las cotizaciones de tus clientes.
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportCsv}>
            Exportar CSV
          </Button>
          {canOperate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/cotizaciones/nuevo")}>
              Nuevo
            </Button>
          )}
        </Space>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Buscar
          </Typography.Text>
          <Input.Search
            allowClear
            placeholder="Número, cliente o documento"
            aria-label="Buscar cotizaciones"
value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: 280 }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Estado
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 160 }}
            value={estado}
            options={STATUS_OPTIONS}
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
        <Table<Quote>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          onRow={(r) => ({ onClick: () => navigate(`/cotizaciones/${r.id}`), style: { cursor: "pointer" } })}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters ? "Ninguna cotización coincide con los filtros" : "Aún no hay cotizaciones"
                }
              >
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
                    <Button type="primary" onClick={() => navigate("/cotizaciones/nuevo")}>
                      Crear el primero
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
            showTotal: (t) => `${t} cotizaciones`,
            onChange: (p, s) => update({ page: String(p), pageSize: String(s) }, false),
          }}
          columns={[
            { title: <Tooltip title="Número único de la cotización">Número</Tooltip>, dataIndex: "numero" },
            { title: <Tooltip title="Cliente al que se dirige la cotización">Cliente</Tooltip>, dataIndex: "customer_nombre" },
            { title: <Tooltip title="Estado actual de la cotización">Estado</Tooltip>, dataIndex: "estado", render: (e: QuoteStatus) => <StatusTag estado={e} /> },
            {
              title: <Tooltip title="Cotización entregada que aún no tiene una factura confirmada vinculada">Pendiente de facturar</Tooltip>,
              dataIndex: "pendiente_facturar",
              responsive: ["md"],
              render: (v: boolean) => (v === true ? <Tag color="orange">Pendiente de facturar</Tag> : <Tag color="default">—</Tag>),
            },
            {
              title: <Tooltip title="Total de la cotización con descuentos e impuestos">Total</Tooltip>,
              dataIndex: "total",
              align: "right",
              render: (v: number) => <strong>{money(v)}</strong>,
            },
            {
              title: <Tooltip title="Fecha límite de validez de la cotización">Válido hasta</Tooltip>,
              dataIndex: "fecha_validez",
              responsive: ["md"],
              render: (v: string, r) => {
                const late =
                  (r.estado === "borrador" || r.estado === "enviado") && dayjs(v).isBefore(dayjs(), "day");
                return <Typography.Text type={late ? "danger" : undefined}>{fmtDate(v)}</Typography.Text>;
              },
            },
            { title: <Tooltip title="Usuario que creó la cotización">Creado por</Tooltip>, dataIndex: "creador", responsive: ["lg"] },
          ]}
        />
      )}
    </>
  );
}
