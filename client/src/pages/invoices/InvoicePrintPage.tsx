import { useEffect, useState } from "react";
import { Button, Card, Table, message } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { getInvoice } from "@/services/invoicesService";
import type { InvoiceDetail, InvoiceItem } from "@/types";
import { InvoiceEstadoTag, fmtDate, money } from "./InvoiceUtils";
import PrintHeader from "@/components/print/PrintHeader";
import PrintSection from "@/components/print/PrintSection";
import PrintThemeProvider from "@/components/print/PrintThemeProvider";
import { useCompany } from "@/context/CompanyContext";

export default function InvoicePrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { company } = useCompany();
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
  const unidades = invoice.items.reduce((total, item) => total + item.cantidad, 0);

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
                <div>Hora de expedición: {invoice.hora_expedicion?.slice(0, 5) ?? "—"} (Bogotá, UTC-5)</div>
                <div>Número: {invoice.numero}</div>
              </>
            }
            summary={[
              { label: "Ítems", value: invoice.items.length },
              { label: "Unidades", value: unidades },
              {
                label: isCompra ? "Orden de compra" : "Cotización",
                value: isCompra ? invoice.orden_compra ?? "—" : invoice.quote_numero ?? "—",
              },
            ]}
          />

          <PrintSection index="01" title={isCompra ? "Proveedor" : "Cliente"}>
            <div className="print-block print-client">
              <div>
                <div className="print-label">{isCompra ? "Proveedor" : "Cliente"}</div>
                <div className="print-strong">{invoice.contraparte}</div>
              </div>
              <div>
                <div className="print-label">Documento</div>
                <div>
                  {invoice.tipo_documento_adquirente ?? "NIT"} · {invoice.documento ?? "—"}
                </div>
              </div>
              <div>
                <div className="print-label">Email</div>
                <div>{invoice.email ?? "—"}</div>
              </div>
              <div>
                <div className="print-label">Condición de pago</div>
                <div>
                  {invoice.condicion_pago === "credito"
                    ? `Crédito a ${invoice.dias_credito} días${invoice.fecha_vencimiento ? ` · vence ${fmtDate(invoice.fecha_vencimiento)}` : ""}`
                    : "Contado"}
                </div>
              </div>
              <div>
                <div className="print-label">Medio de pago</div>
                <div>{invoice.medio_pago ?? "—"}</div>
              </div>
              {invoice.orden_compra && (
                <div>
                  <div className="print-label">Orden de compra</div>
                  <div>{invoice.orden_compra}</div>
                </div>
              )}
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
            </div>
          </PrintSection>

          <PrintSection index="02" title="Datos fiscales">
            <div className="print-block print-client">
              <div>
                <div className="print-label">Resolución</div>
                <div className="print-strong">{invoice.resolucion_numero ?? "—"}</div>
              </div>
              <div>
                <div className="print-label">Fecha de resolución</div>
                <div>{invoice.resolucion_fecha ? fmtDate(invoice.resolucion_fecha) : "—"}</div>
              </div>
              <div>
                <div className="print-label">Prefijo</div>
                <div>{invoice.prefijo ?? "—"}</div>
              </div>
              <div>
                <div className="print-label">Rango autorizado</div>
                <div>
                  {invoice.rango_desde ?? "—"} — {invoice.rango_hasta ?? "—"}
                </div>
              </div>
              <div>
                <div className="print-label">Expedición</div>
                <div>
                  {fmtDate(invoice.fecha)} · {invoice.hora_expedicion?.slice(0, 5) ?? "—"}
                </div>
              </div>
            </div>
            <p className="print-note">
              Información exigida por el artículo 617 del Estatuto Tributario. Los datos quedan
              grabados en esta factura y no cambian si se actualiza la configuración de la empresa.
            </p>
          </PrintSection>

          <PrintSection index="03" title="Ítems" className="print-items">
            <Table<InvoiceItem>
              className="print-table"
              rowKey={(r) => String(r.id ?? r.product_id)}
              size="small"
              pagination={false}
              dataSource={invoice.items}
              columns={[
                {
                  title: "Descripción",
                  dataIndex: "descripcion",
                  render: (value: string | undefined, row: InvoiceItem) => (
                    <>
                      <div className="print-strong">{value ?? row.producto}</div>
                      <div className="print-label">{row.sku}</div>
                    </>
                  ),
                },
                { title: "Und.", dataIndex: "unidad_medida", align: "center", width: 55 },
                { title: "Cant.", dataIndex: "cantidad", align: "right", width: 60 },
                {
                  title: isCompra ? "Costo unit." : "Precio unit.",
                  dataIndex: "precio_unitario",
                  align: "right",
                  render: money,
                  width: 110,
                },
                { title: "Dto. %", dataIndex: "descuento_pct", align: "right", width: 60 },
                {
                  title: "Tributos % (IVA/INC/Otro)",
                  align: "right",
                  width: 140,
                  render: (_, row: InvoiceItem) =>
                    `${row.impuesto_pct ?? 0} / ${row.inc_pct ?? 0} / ${row.otro_impuesto_pct ?? 0}`,
                },
                {
                  title: "Total",
                  dataIndex: "total_linea",
                  align: "right",
                  render: money,
                  width: 120,
                },
              ]}
            />
          </PrintSection>

          <PrintSection index="04" title="Totales" className="print-totals-section">
            <div className="print-totals">
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
                  <span>INC</span>
                  <span>{money(invoice.inc_total)}</span>
                </div>
                <div>
                  <span>Otros impuestos</span>
                  <span>{money(invoice.otros_impuestos_total)}</span>
                </div>
                <div>
                  <span>Retenciones</span>
                  <span>{money(retenciones)}</span>
                </div>
                <div className="print-total-final">
                  <span>Total factura</span>
                  <span>{money(invoice.total)}</span>
                </div>
                <div className="print-total-final print-total-net">
                  <span>Total neto a pagar</span>
                  <span>{money(invoice.total_neto)}</span>
                </div>
              </div>
            </div>
          </PrintSection>

          {invoice.notas && (
            <div className="print-note">
              <div className="print-label">Notas</div>
              <p className="print-pre">{invoice.notas}</p>
            </div>
          )}

          <PrintSection index="05" title="Condiciones">
            <div className="print-conditions">
              <ul>
                <li>Los valores están expresados en pesos colombianos (COP).</li>
                <li>
                  La hora de expedición se reporta en hora local de Bogotá (UTC-5) y la numeración
                  corresponde al rango autorizado indicado arriba.
                </li>
                <li>
                  {isCompra
                    ? "El pago se acuerda con el proveedor según las condiciones pactadas."
                    : "El pago se acuerda con el cliente según las condiciones pactadas."}
                </li>
                <li>Las retenciones son informativas y reducen el valor neto a pagar.</li>
                <li>Factura sujeta a verificación de cantidades, precios y documentos de soporte.</li>
              </ul>
            </div>
          </PrintSection>

          <PrintSection index="06" title="Firmas" className="print-signatures-section">
            <div className="print-signatures">
              <div>
                <div className="print-signature-line" />
                <div className="print-signature-label">Firma autorizada</div>
                <div className="print-signature-name">{invoice.creador}</div>
              </div>
              <div>
                <div className="print-signature-line" />
                <div className="print-signature-label">
                  {isCompra ? "Recibido del proveedor" : "Recibido por el cliente"}
                </div>
                <div className="print-signature-name">{invoice.contraparte}</div>
              </div>
            </div>
          </PrintSection>

          <footer className="print-footer">
            {company.nombre} · {company.telefono} · {company.email} · Documento generado por el sistema.
          </footer>
        </article>
      </div>
    </PrintThemeProvider>
  );
}
