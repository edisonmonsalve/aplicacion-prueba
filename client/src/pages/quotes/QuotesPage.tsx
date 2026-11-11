import { useEffect, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import {
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { duplicateQuote, listQuotes } from "@/services/quotesService";
import type { Quote, QuoteSortKey, QuoteStatus } from "@/types";
import { StatusTag, STATUS_OPTIONS, money, fmtDate } from "@/pages/quotes/QuoteUtils";
import { downloadCsv, fetchAllPages } from "@/utils/csv";
import TableSkeleton from "@/components/TableSkeleton";
import PageHeader from "@/components/PageHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/context/AuthContext";

const FMT = "YYYY-MM-DD";

const SORT_KEYS: QuoteSortKey[] = ["numero", "cliente", "total", "fecha_validez", "fecha"];

const SORT_BY_FIELD: Record<string, QuoteSortKey> = {
  numero: "numero",
  customer_nombre: "cliente",
  total: "total",
  fecha_validez: "fecha_validez",
  created_at: "fecha",
};

export default function QuotesPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [sp, setSp] = useSearchParams();
  const { canOperate } = useAuth();

  const q = sp.get("q") ?? "";
  const estado = (sp.get("estado") as QuoteStatus | null) ?? undefined;
  const desde = sp.get("desde") ?? undefined;
  const hasta = sp.get("hasta") ?? undefined;
  const rawSort = sp.get("sort");
  const sort = SORT_KEYS.includes(rawSort as QuoteSortKey)
    ? (rawSort as QuoteSortKey)
    : undefined;
  const rawOrder = sp.get("order");
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined;
  const page = Number(sp.get("page") ?? 1);
  const pageSize = Number(sp.get("pageSize") ?? 10);

  const [rows, setRows] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [montoTotal, setMontoTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(q);
  const [exporting, setExporting] = useState(false);
  const [duplicating, setDuplicating] = useState<number | null>(null);

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
    listQuotes({
      q: q || undefined,
      estado,
      desde,
      hasta,
      sort,
      order: sort ? order : undefined,
      page,
      pageSize,
    })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setTotal(r.total);
        setMontoTotal(r.monto_total ?? 0);
      })
      .catch(() => message.error("No se pudieron cargar las cotizaciones"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, estado, desde, hasta, sort, order, page, pageSize, message]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages<Quote>((p) =>
        listQuotes({
          q: q || undefined,
          estado,
          desde,
          hasta,
          sort,
          order: sort ? order : undefined,
          page: p,
          pageSize: 100,
        })
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
          { header: "IVA", value: (r) => r.impuesto_total },
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

  const clearFilters = () => {
    setText("");
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of ["q", "estado", "desde", "hasta", "page"]) next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  const onDuplicate = async (id: number) => {
    setDuplicating(id);
    try {
      const { id: newId } = await duplicateQuote(id);
      message.success("Borrador creado a partir de la cotización");
      navigate(`/cotizaciones/${newId}`);
    } catch {
      message.error("No se pudo duplicar la cotización");
    } finally {
      setDuplicating(null);
    }
  };

  const sortOrderFor = (key: QuoteSortKey): "ascend" | "descend" | null =>
    sort === key ? (order === "desc" ? "descend" : "ascend") : null;

  const hasFilters = !!(q || estado || desde || hasta);

  const firstLoad = loading && rows.length === 0;

  const columns: TableProps<Quote>["columns"] = [
    {
      title: <Tooltip title="Número único de la cotización">Número</Tooltip>,
      dataIndex: "numero",
      sorter: true,
      sortOrder: sortOrderFor("numero"),
      render: (numero: string, r) => (
        <Tooltip title="Abrir el detalle de la cotización">
          <Link to={`/cotizaciones/${r.id}`}>{numero}</Link>
        </Tooltip>
      ),
    },
    {
      title: <Tooltip title="Cliente al que se dirige la cotización">Cliente</Tooltip>,
      dataIndex: "customer_nombre",
      sorter: true,
      sortOrder: sortOrderFor("cliente"),
    },
    {
      title: <Tooltip title="Estado actual de la cotización">Estado</Tooltip>,
      dataIndex: "estado",
      render: (e: QuoteStatus) => <StatusTag estado={e} />,
    },
    {
      title: (
        <Tooltip title="Cotización entregada que aún no tiene una factura confirmada vinculada">
          Pendiente de facturar
        </Tooltip>
      ),
      dataIndex: "pendiente_facturar",
      responsive: ["md"],
      render: (v: boolean) =>
        v === true ? (
          <Tag color="orange">Pendiente de facturar</Tag>
        ) : (
          <Tag color="default">—</Tag>
        ),
    },
    {
      title: <Tooltip title="Total de la cotización con descuentos e impuestos">Total</Tooltip>,
      dataIndex: "total",
      align: "right",
      sorter: true,
      sortOrder: sortOrderFor("total"),
      render: (v: number) => <strong>{money(v)}</strong>,
    },
    {
      title: <Tooltip title="Fecha límite de validez de la cotización">Válido hasta</Tooltip>,
      dataIndex: "fecha_validez",
      responsive: ["md"],
      sorter: true,
      sortOrder: sortOrderFor("fecha_validez"),
      render: (v: string, r) => {
        const late =
          (r.estado === "borrador" || r.estado === "enviado") && dayjs(v).isBefore(dayjs(), "day");
        return <Typography.Text type={late ? "danger" : undefined}>{fmtDate(v)}</Typography.Text>;
      },
    },
    {
      title: <Tooltip title="Usuario que creó la cotización">Creado por</Tooltip>,
      dataIndex: "creador",
      responsive: ["lg"],
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 72,
      align: "center",
      fixed: "right" as const,
      render: (_, r) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "ver",
                icon: <EyeOutlined />,
                label: "Ver detalle",
                onClick: () => navigate(`/cotizaciones/${r.id}`),
              },
              {
                key: "imprimir",
                icon: <PrinterOutlined />,
                label: "Imprimir",
                onClick: () => navigate(`/cotizaciones/${r.id}/imprimir`),
              },
              {
                key: "duplicar",
                icon: <CopyOutlined />,
                label: "Duplicar",
                disabled: !canOperate || duplicating === r.id,
                onClick: () => onDuplicate(r.id),
              },
            ],
          }}
        >
          <Tooltip title="Acciones de la cotización">
            <Button
              type="text"
              aria-label={`Acciones de ${r.numero}`}
              icon={<MoreOutlined />}
              loading={duplicating === r.id}
            />
          </Tooltip>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        description="Crea, envía y da seguimiento a las cotizaciones de tus clientes."
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportCsv}>
              Exportar CSV
            </Button>
            {canOperate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/cotizaciones/nuevo")}
              >
                Nuevo
              </Button>
            )}
          </Space>
        }
      />

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div>
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 4, fontSize: 12 }}
          >
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
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 4, fontSize: 12 }}
          >
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
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 4, fontSize: 12 }}
          >
            Rango de fechas
          </Typography.Text>
          <DatePicker.RangePicker
            format={FMT}
            value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
            onChange={(v) => update({ desde: v?.[0]?.format(FMT), hasta: v?.[1]?.format(FMT) })}
          />
        </div>
        {hasFilters && <Button onClick={clearFilters}>Limpiar filtros</Button>}
      </div>

      <Space size={8} wrap style={{ marginBottom: 16 }}>
        <Tag color="blue" style={{ margin: 0, padding: "4px 10px" }}>
          {total} cotización(es)
        </Tag>
        <Tag color="geekblue" style={{ margin: 0, padding: "4px 10px" }}>
          Total filtrado: <strong>{money(montoTotal)}</strong>
        </Tag>
      </Space>

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<Quote>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          columns={columns}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters
                    ? "Ninguna cotización coincide con los filtros"
                    : "Aún no hay cotizaciones"
                }
              >
                {hasFilters ? (
                  <Button onClick={clearFilters}>Limpiar filtros</Button>
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
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra.action === "sort") {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const nextSort = s?.order ? SORT_BY_FIELD[String(s.field)] : undefined;
              update({
                page: undefined,
                pageSize: String(pagination.pageSize ?? pageSize),
                sort: nextSort,
                order: nextSort
                  ? s?.order === "descend"
                    ? "desc"
                    : "asc"
                  : undefined,
              });
              return;
            }
            update(
              {
                page: String(pagination.current ?? 1),
                pageSize: String(pagination.pageSize ?? pageSize),
              },
              false
            );
          }}
        />
      )}
    </>
  );
}
