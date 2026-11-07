import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cancelInvoice, confirmInvoice, getInvoice } from "@/services/invoicesService";
import type { InvoiceDetail, InvoiceItem } from "@/types";
import { InvoiceEstadoTag, InvoiceTipoTag, fmtDate, money } from "./InvoiceUtils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const navigate = useNavigate();
  const { canOperate } = useAuth();
  const { message } = App.useApp();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useDocumentTitle(invoice?.numero ?? "Factura");

  const load = useCallback(async () => {
    try {
      setInvoice(await getInvoice(invoiceId));
    } catch (e) {
      const s = isAxiosError(e) ? e.response?.status : undefined;
      message.error(s === 404 ? "Factura no encontrada" : "Error al cargar la factura");
      navigate("/facturas", { replace: true });
    }
  }, [invoiceId, navigate, message]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: (id: number) => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn(invoiceId);
      message.success(okMsg);
      await load();
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(msg ?? "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  };

  if (!invoice) return <Card loading />;

  const isDraft = invoice.estado === "borrador";
  const isConfirmed = invoice.estado === "confirmada";

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Factura {invoice.numero}
        </Typography.Title>
        <Typography.Text type="secondary">
          {invoice.tipo === "venta"
            ? "Al confirmar se descuenta stock y se registra el ingreso en finanzas."
            : "Al confirmar se suma stock, se actualiza el costo del producto y se registra el gasto."}
        </Typography.Text>
      </div>

      <Space wrap>
        <Button onClick={() => navigate("/facturas")}>Volver</Button>
        {canOperate && isDraft && (
          <>
            <Popconfirm
              title="¿Confirmar esta factura?"
              description={
                invoice.tipo === "venta"
                  ? "Se validará stock, se descontará y se generará el ingreso."
                  : "Se sumará stock, se actualizará el costo del producto y se generará el gasto."
              }
              okText="Sí, confirmar"
              cancelText="No"
              onConfirm={() => run(confirmInvoice, "Factura confirmada")}
            >
              <Button type="primary" disabled={busy}>
                Confirmar
              </Button>
            </Popconfirm>
            <Button onClick={() => navigate(`/facturas/${invoiceId}/editar`)} disabled={busy}>
              Editar
            </Button>
          </>
        )}
        {canOperate && isConfirmed && (
          <Popconfirm
            title="¿Anular esta factura?"
            description="Se revertirá el stock y se registrará la contrapartida financiera."
            okText="Sí, anular"
            cancelText="No"
            okButtonProps={{ danger: true }}
            onConfirm={() => run(cancelInvoice, "Factura anulada")}
          >
            <Button danger disabled={busy}>
              Anular
            </Button>
          </Popconfirm>
        )}
      </Space>

      {invoice.estado === "anulada" && (
        <Alert type="warning" showIcon message="Esta factura está anulada. El stock y la contrapartida financiera fueron revertidos." />
      )}

      <Card
        title="Resumen"
        extra={
          <Space>
            <InvoiceTipoTag tipo={invoice.tipo} />
            <InvoiceEstadoTag estado={invoice.estado} />
          </Space>
        }
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between" }}>
          <Descriptions column={{ xs: 1, md: 2 }} size="small" style={{ flex: "1 1 420px" }}>
            <Descriptions.Item label={invoice.tipo === "compra" ? "Proveedor" : "Cliente"}>
              {invoice.contraparte}
            </Descriptions.Item>
            <Descriptions.Item label="Fecha">{fmtDate(invoice.fecha)}</Descriptions.Item>
            <Descriptions.Item label="Documento">{invoice.documento ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Email">{invoice.email ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Creado por">{invoice.creador}</Descriptions.Item>
            <Descriptions.Item label="Notas" span={2}>
              {invoice.notas ?? "—"}
            </Descriptions.Item>
          </Descriptions>
          <Statistic title="Total" value={money(invoice.total)} valueStyle={{ fontWeight: 700 }} />
        </div>
      </Card>

      <Card title="Líneas">
        <Table<InvoiceItem>
          rowKey={(r) => String(r.id ?? r.product_id)}
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={invoice.items}
          columns={[
            { title: "SKU", dataIndex: "sku" },
            { title: "Producto", dataIndex: "producto" },
            { title: "Cant.", dataIndex: "cantidad", align: "right" },
            {
              title: invoice.tipo === "compra" ? "Costo unit." : "Precio unit.",
              dataIndex: "precio_unitario",
              align: "right",
              render: money,
            },
            { title: "Desc. %", dataIndex: "descuento_pct", align: "right" },
            { title: "Imp. %", dataIndex: "impuesto_pct", align: "right" },
            { title: "Total línea", dataIndex: "total_linea", align: "right", render: money },
          ]}
        />
      </Card>
    </Space>
  );
}
