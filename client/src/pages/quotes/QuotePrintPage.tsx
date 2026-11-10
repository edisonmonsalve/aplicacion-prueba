import { useEffect, useState } from "react";
import { Button, Card, Descriptions, Table, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { getQuote } from "../../services/quotesService";
import type { QuoteDetail, QuoteLine } from "../../types";
import { StatusTag, money, fmtDate } from "./QuoteUtils";

export default function QuotePrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);

  useEffect(() => {
    getQuote(Number(id))
      .then(setQuote)
      .catch(() => {
        message.error("No se pudo cargar la cotización");
        navigate("/cotizaciones", { replace: true });
      });
  }, [id, navigate]);
  useEffect(() => {
    if (!quote) return;
    const prev = document.title;
    document.title = quote.numero;
    return () => {
      document.title = prev;
    };
  }, [quote]);

  if (!quote) return <Card loading />;

  return (
    <div className="print-area">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate(`/cotizaciones/${quote.id}`)} style={{ marginRight: 8 }}>
          Volver
        </Button>
        <Button type="primary" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </Button>
      </div>

      <Typography.Title level={3}>Cotización {quote.numero}</Typography.Title>
      <StatusTag estado={quote.estado} />

      <Descriptions column={2} size="small" style={{ margin: "16px 0" }}>
        <Descriptions.Item label="Cliente">{quote.customer_nombre}</Descriptions.Item>
        <Descriptions.Item label="Documento">{quote.customer_documento ?? "—"}</Descriptions.Item>
        <Descriptions.Item label="Email">{quote.customer_email ?? "—"}</Descriptions.Item>
        <Descriptions.Item label="Válido hasta">{fmtDate(quote.fecha_validez)}</Descriptions.Item>
        <Descriptions.Item label="Emitido por">{quote.creador}</Descriptions.Item>
        <Descriptions.Item label="Fecha">{fmtDate(quote.created_at)}</Descriptions.Item>
      </Descriptions>

      <Table<QuoteLine>
        rowKey="sku"
        size="small"
        pagination={false}
        dataSource={quote.items}
        columns={[
          { title: "SKU", dataIndex: "sku" },
          { title: "Producto", dataIndex: "nombre" },
          { title: "Cant.", dataIndex: "cantidad", align: "right" },
          { title: "Precio unit.", dataIndex: "precio_unitario", align: "right", render: money },
          { title: "Desc. %", dataIndex: "descuento_pct", align: "right" },
          { title: "IVA %", dataIndex: "impuesto_pct", align: "right" },
          { title: "Total", dataIndex: "total_linea", align: "right", render: money },
        ]}
      />

      <div style={{ textAlign: "right", marginTop: 16 }}>
        <div>Subtotal: {money(quote.subtotal)}</div>
        <div>Descuento: {money(quote.descuento_total)}</div>
        <div>IVA: {money(quote.impuesto_total)}</div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Total: {money(quote.total)}
        </Typography.Title>
      </div>

      {quote.notas && (
        <div style={{ marginTop: 24 }}>
          <strong>Notas:</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{quote.notas}</p>
        </div>
      )}
    </div>
  );
}
