import { useEffect, useState } from "react";
import { Button, Card, Table, Typography, message } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { getInvoice } from "@/services/invoicesService";
import type { InvoiceDetail, InvoiceItem } from "@/types";
import { InvoiceEstadoTag, fmtDate, money } from "./InvoiceUtils";
import PrintHeader from "@/components/print/PrintHeader";
import PrintThemeProvider from "@/components/print/PrintThemeProvider";
import { COMPANY } from "@/config/company";

export default function InvoicePrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);

  useEffect(() => {
    getInvoice(Number(id))
      .then(setInvoice)
      .catch(() => {
        message.error("No se pudo cargar la factura");
        navigate("/facturas", { replace: true });
      });
  }, [id, navigate]);

  useEffect(() => {
    if (!invoice) return;
    const prev = document.title;
    document.title = invoice.numero;
    return () => {
      document.title = prev;
    };
  }, [invoice]);

  if (!invoice) return <Card loading />;

  const isCompra = invoice.tipo === "compra";
  const retenciones =
    invoice.retencion_fuente + invoice.retencion_iva + invoice.retencion_ica;

  return (
    <PrintThemeProvider>
      <div className="print-area">
        <div className="no-print print-toolbar">
          <Button onClick={() => navigate(`/facturas/${invoice.id}`)}>Volver</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </Button>
        </div>

        <article className="print-document quote-print">
          <PrintHeader
            docKind={isCompra ? "FACTURA DE COMPRA" : "FACTURA DE VENTA"}
            docNumber={invoice.numero}
            status={<InvoiceEstadoTag estado={invoice.estado} />}
            meta={
              <>
                <div>Fecha: {fmtDate(invoice.fecha)}</div>
                {invoice.documento && <div>Documento: {invoice.documento}</div>}
              </>
            }
          />

      <section className="print-block print-client">
        <div>
          <div className="print-label">{isCompra ? "Proveedor" : "Cliente"}</div>
          <div className="print-strong">{invoice.contraparte}</div>
        </div>
        <div>
          <div className="print-label">Documento</div>
          <div>{invoice.documento ?? "—"}</div>
        </div>
        <div>
          <div className="print-label">Email</div>
          <div>{invoice.email ?? "—"}</div>
        </div>
        <div>
          <div className="print-label">Orden de compra</div>
          <div>{invoice.orden_compra ?? "—"}</div>
        </div>
        <div>
          <div className="print-label">Emitido por</div>
          <div>{invoice.creador}</div>
        </div>
        {invoice.quote_numero && (
          <div>
            <div className="print-label">Cotización</div>
            <div>{invoice.quote_numero}</div>
          </div>
        )}
      </section>

      <Table<InvoiceItem>
        className="print-table"
        rowKey={(r) => String(r.id ?? r.product_id)}
        size="small"
        pagination={false}
        dataSource={invoice.items}
        columns={[
          { title: "SKU", dataIndex: "sku", width: 110 },
          { title: "Producto", dataIndex: "producto" },
          { title: "Cant.", dataIndex: "cantidad", align: "right", width: 70 },
          {
            title: isCompra ? "Costo unit." : "Precio unit.",
            dataIndex: "precio_unitario",
            align: "right",
            render: money,
            width: 120,
          },
          { title: "Desc. %", dataIndex: "descuento_pct", align: "right", width: 80 },
          { title: "IVA %", dataIndex: "impuesto_pct", align: "right", width: 70 },
          {
            title: "Total",
            dataIndex: "total_linea",
            align: "right",
            render: money,
            width: 130,
          },
        ]}
      />

      <section className="print-totals">
        <div className="print-totals-box">
          <div>
            <span>Subtotal</span>
            <span>{money(invoice.subtotal)}</span>
          </div>
          <div>
            <span>Descuento</span>
            <span>{money(invoice.descuento_total)}</span>
          </div>
          <div>
            <span>IVA</span>
            <span>{money(invoice.impuesto_total)}</span>
          </div>
          <div>
            <span>Retenciones</span>
            <span>{money(retenciones)}</span>
          </div>
          <div className="print-total-final">
            <span>Total factura</span>
            <span>{money(invoice.total)}</span>
          </div>
          <div className="print-total-final">
            <span>Total neto a pagar</span>
            <span>{money(invoice.total_neto)}</span>
          </div>
        </div>
      </section>

      {invoice.notas && (
        <section className="print-block print-section">
          <div className="print-label">Notas</div>
          <p className="print-pre">{invoice.notas}</p>
        </section>
      )}

      <section className="print-section print-conditions">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          Condiciones
        </Typography.Title>
        <ul>
          <li>Los valores están expresados en pesos colombianos (COP).</li>
          <li>
            {isCompra
              ? "El pago se acuerda con el proveedor según las condiciones pactadas."
              : "El pago se acuerda con el cliente según las condiciones pactadas."}
          </li>
          <li>Las retenciones son informativas y reducen el valor neto a pagar.</li>
          <li>Factura sujeta a verificación de cantidades, precios y documentos de soporte.</li>
        </ul>
      </section>

      <section className="print-signatures print-section">
        <div>
          <div className="print-signature-line" />
          <div className="print-signature-label">Firma autorizada</div>
          <div className="print-signature-name">{invoice.creador}</div>
        </div>
        <div>
          <div className="print-signature-line" />
          <div className="print-signature-label">{isCompra ? "Recibido del proveedor" : "Recibido por el cliente"}</div>
          <div className="print-signature-name">{invoice.contraparte}</div>
        </div>
      </section>

      <footer className="print-footer">
        {COMPANY.nombre} · {COMPANY.telefono} · {COMPANY.email} · Documento generado por el sistema.
      </footer>
        </article>
      </div>
    </PrintThemeProvider>
  );
}
