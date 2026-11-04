import { useEffect, useState } from "react";
import { Input, Select, Space, Table, Tag, message } from "antd";
import type { TableProps } from "antd";
import { getQuotes, type Quote, type QuotesQuery } from "@/services/quotesService";
import { getErrorMessage } from "@/utils/errors";
import { formatCurrency } from "@/utils/format";

const statusColors: Record<string, string> = {
  borrador: "default",
  enviado: "blue",
  aprobado: "green",
  rechazado: "red",
  vencido: "orange",
};

export default function QuotesPage() {
  const [messageApi, contextHolder] = message.useMessage();

  const [query, setQuery] = useState<QuotesQuery>({ page: 1, pageSize: 10 });

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    setLoading(true);

    getQuotes(query)
      .then((res) => {
        if (ignore) return;
        setQuotes(res.data);
        setTotal(res.total);
      })
      .catch((err) => {
        if (!ignore) {
          messageApi.error(getErrorMessage(err, "No se pudieron cargar los presupuestos"));
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [query, messageApi]);

  const updateFilters = (changes: Partial<QuotesQuery>) => {
    setQuery((prev) => ({ ...prev, ...changes, page: 1 }));
  };

  const columns: TableProps<Quote>["columns"] = [
    {
      title: "Número",
      dataIndex: "numero",
    },
    {
      title: "Cliente",
      dataIndex: "customer_nombre",
    },
    {
      title: "Estado",
      dataIndex: "estado",
      render: (estado: string) => <Tag color={statusColors[estado] ?? "default"}>{estado.toUpperCase()}</Tag>,
    },
    {
      title: "Fecha de validez",
      dataIndex: "fecha_validez",
    },
    {
      title: "Total",
      dataIndex: "total",
      align: "right",
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Creador",
      dataIndex: "creador",
    },
  ];

  return (
    <div>
      {contextHolder}

      <h2>Presupuestos</h2>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Buscar presupuesto o cliente"
          allowClear
          style={{ width: 280 }}
          onSearch={(q) => updateFilters({ q: q || undefined })}
        />

        <Select
          placeholder="Filtrar por estado"
          allowClear
          style={{ width: 180 }}
          options={[
            { value: "borrador", label: "Borrador" },
            { value: "enviado", label: "Enviado" },
            { value: "aprobado", label: "Aprobado" },
            { value: "rechazado", label: "Rechazado" },
            { value: "vencido", label: "Vencido" },
          ]}
          onChange={(estado) => updateFilters({ estado })}
        />
      </Space>

      <Table<Quote>
        rowKey="id"
        columns={columns}
        dataSource={quotes}
        loading={loading}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: "No hay presupuestos registrados" }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => setQuery((prev) => ({ ...prev, page, pageSize })),
        }}
      />
    </div>
  );
}
