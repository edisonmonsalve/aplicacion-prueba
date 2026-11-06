import { useEffect, useState } from "react";
import { App, Button, DatePicker, Empty, Input, Select, Space, Table, Typography } from "antd";
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
        <Typography.Title level={3} style={{ margin: 0 }}>
          Cotizaciones
        </Typography.Title>
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

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Número, cliente o documento"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: 280 }}
        />
        <Select
          allowClear
          placeholder="Estado"
          style={{ width: 160 }}
          value={estado}
          options={STATUS_OPTIONS}
          onChange={(v) => update({ estado: v })}
        />
        <DatePicker.RangePicker
          format={FMT}
          value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
          onChange={(v) => update({ desde: v?.[0]?.format(FMT), hasta: v?.[1]?.format(FMT) })}
        />
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
      </Space>

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
                {!hasFilters && canOperate && (
                  <Button type="primary" onClick={() => navigate("/cotizaciones/nuevo")}>
                    Crear el primero
                  </Button>
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
            { title: "Número", dataIndex: "numero" },
            { title: "Cliente", dataIndex: "customer_nombre" },
            { title: "Estado", dataIndex: "estado", render: (e: QuoteStatus) => <StatusTag estado={e} /> },
            {
              title: "Total",
              dataIndex: "total",
              align: "right",
              render: (v: number) => <strong>{money(v)}</strong>,
            },
            {
              title: "Válido hasta",
              dataIndex: "fecha_validez",
              responsive: ["md"],
              render: (v: string, r) => {
                const late =
                  (r.estado === "borrador" || r.estado === "enviado") && dayjs(v).isBefore(dayjs(), "day");
                return <Typography.Text type={late ? "danger" : undefined}>{fmtDate(v)}</Typography.Text>;
              },
            },
            { title: "Creado por", dataIndex: "creador", responsive: ["lg"] },
          ]}
        />
      )}
    </>
  );
}
