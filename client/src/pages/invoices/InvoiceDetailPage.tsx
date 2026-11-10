import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cancelInvoice, confirmInvoice, getInvoice } from "@/services/invoicesService";
import type { InvoiceDetail, InvoiceItem, InvoiceTransaction } from "@/types";
import { InvoiceEstadoTag, InvoiceTipoTag, fmtDate, money } from "./InvoiceUtils";
import PageBreadcrumb from "@/components/PageBreadcrumb";
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
      <PageBreadcrumb
        items={[{ label: "Facturas", to: "/facturas" }, { label: invoice.numero }]}
      />
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
        <Alert type="warning" showIcon message="Esta factura está anulada. Se revirtieron el stock y todos sus asientos financieros." />
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
            <Descriptions.Item label="Orden de compra">{invoice.orden_compra ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Cotización">
              {invoice.quote_numero ? (
                <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/cotizaciones/${invoice.quote_id}`)}>
                  {invoice.quote_numero}
                </Button>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Email">{invoice.email ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Creado por">{invoice.creador}</Descriptions.Item>
            <Descriptions.Item label="Notas" span={2}>
              {invoice.notas ?? "—"}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ minWidth: 280 }}>
            {[
              { label: "Subtotal", value: invoice.subtotal },
              { label: "Descuento", value: -invoice.descuento_total },
              { label: "IVA", value: invoice.impuesto_total },
              {
                label: "Retenciones",
                value:
                  -(invoice.retencion_fuente + invoice.retencion_iva + invoice.retencion_ica),
              },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span>{label}</span>
                <span>{money(value)}</span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
                paddingTop: 6,
                borderTop: "1px solid rgba(0,0,0,0.06)",
                fontWeight: 700,
              }}
            >
              <span>Total factura</span>
              <span>{money(invoice.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Total neto a pagar</span>
              <span>{money(invoice.total_neto)}</span>
            </div>
          </div>
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
            { title: "IVA %", dataIndex: "impuesto_pct", align: "right" },
            { title: "Total línea", dataIndex: "total_linea", align: "right", render: money },
          ]}
        />
      </Card>

      {invoice.transacciones.length > 0 && (
        <Card title="Asientos financieros">
          <Table<InvoiceTransaction>
            rowKey="id"
            pagination={false}
            scroll={{ x: "max-content" }}
            dataSource={invoice.transacciones}
            columns={[
              {
                title: "Naturaleza",
                dataIndex: "tipo",
                render: (t: InvoiceTransaction["tipo"]) => {
                  const meta: Record<InvoiceTransaction["tipo"], { color: string; label: string }> = {
                    ingreso: { color: "green", label: "Ingreso" },
                    gasto: { color: "red", label: "Gasto" },
                    activo: { color: "blue", label: "Activo" },
                    pasivo: { color: "purple", label: "Pasivo" },
                  };
                  return <Tag color={meta[t].color}>{meta[t].label}</Tag>;
                },
              },
              { title: "Categoría", dataIndex: "categoria" },
              { title: "Cuenta", dataIndex: "cuenta" },
              { title: "Descripción", dataIndex: "descripcion", render: (v: string | null) => v ?? "—" },
              { title: "Monto", dataIndex: "monto", align: "right", render: money },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}
