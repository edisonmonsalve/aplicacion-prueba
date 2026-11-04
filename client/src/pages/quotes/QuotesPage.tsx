import { useEffect, useState } from "react";
import { Input, Select, DatePicker, Table, Space, message, Button } from "antd";
import type { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import { listQuotes } from "@/services/quotesService";
import type { Quote, QuoteStatus } from "@/types";
import { StatusTag, money, fmtDate } from "@/pages/quotes/quoteUtils";
import { PlusOutlined } from "@ant-design/icons/es/icons/index";

const ESTADOS: QuoteStatus[] = ["borrador", "enviado", "aprobado", "rechazado", "entregado", "vencido"];

export default function QuotesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<QuoteStatus>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listQuotes({
      q: q || undefined,
      estado,
      desde: range?.[0]?.format("YYYY-MM-DD"),
      hasta: range?.[1]?.format("YYYY-MM-DD"),
      page,
      pageSize,
    })
      .then((r) => {
        if (!cancelled) {
          setRows(r.data);
          setTotal(r.total);
        }
      })
      .catch(() => message.error("No se pudo cargar los presupuestos"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, estado, range, page, pageSize]);

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Número, cliente o documento"
          onSearch={(v) => {
            setQ(v.trim());
            setPage(1);
          }}
          style={{ width: 280 }}
        />
        <Select
          allowClear
          placeholder="Estado"
          style={{ width: 160 }}
          options={ESTADOS.map((e) => ({ value: e, label: e }))}
          onChange={(v) => {
            setEstado(v);
            setPage(1);
          }}
        />
        <DatePicker.RangePicker
          format="YYYY-MM-DD"
          onChange={(v) => {
            setRange(v);
            setPage(1);
          }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/presupuestos/nuevo")}>
          Nuevo
        </Button>
      </Space>
      <Table<Quote>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRow={(r) => ({ onClick: () => navigate(`/presupuestos/${r.id}`), style: { cursor: "pointer" } })}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, s) => {
            setPage(p);
            setPageSize(s);
          },
        }}
        columns={[
          { title: "Número", dataIndex: "numero" },
          { title: "Cliente", dataIndex: "customer_nombre" },
          { title: "Estado", dataIndex: "estado", render: (e: QuoteStatus) => <StatusTag estado={e} /> },
          { title: "Total", dataIndex: "total", align: "right", render: money },
          { title: "Válido hasta", dataIndex: "fecha_validez", render: fmtDate },
          { title: "Creado por", dataIndex: "creador" },
        ]}
      />
    </>
  );
}
