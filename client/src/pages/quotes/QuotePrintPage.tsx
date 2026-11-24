import { useEffect, useState } from "react";
import { Button, Card, Table, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { getQuote } from "../../services/quotesService";
import type { QuoteDetail, QuoteLine } from "../../types";
import { StatusTag, money, fmtDate } from "./quoteUtils";
import PrintHeader from "@/components/print/PrintHeader";
import PrintSection from "@/components/print/PrintSection";
import PrintThemeProvider from "@/components/print/PrintThemeProvider";
import { useCompany } from "@/context/CompanyContext";

export default function QuotePrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { company } = useCompany();
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

  const unidades = quote.items.reduce((total, item) => total + item.cantidad, 0);

  return (
    <PrintThemeProvider>
      <div className="print-area">
        <div className="no-print print-toolbar">
          <Button onClick={() => navigate(`/cotizaciones/${quote.id}`)}>Volver</Button>
          <Button type="primary" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </Button>
        </div>

        <article className="print-document quote-print">
          <PrintHeader
            docKind="COTIZACIÓN"
            docNumber={quote.numero}
            status={<StatusTag estado={quote.estado} />}
            meta={
              <>
                <div>Fecha: {fmtDate(quote.created_at)}</div>
                <div>Válida hasta: {fmtDate(quote.fecha_validez)}</div>
              </>
            }
            summary={[
              { label: "Ítems", value: quote.items.length },
              { label: "Unidades", value: unidades },
              { label: "Vigencia", value: fmtDate(quote.fecha_validez) },
            ]}
          />

          <PrintSection index="01" title="Cliente">
            <div className="print-block print-client">
              <div>
                <div className="print-label">Cliente</div>
                <div className="print-strong">{quote.customer_nombre}</div>
              </div>
              <div>
                <div className="print-label">Documento</div>
                <div>{quote.customer_documento ?? "—"}</div>
              </div>
              <div>
                <div className="print-label">Email</div>
                <div>{quote.customer_email ?? "—"}</div>
              </div>
              <div>
                <div className="print-label">Emitido por</div>
                <div>{quote.creador}</div>
              </div>
            </div>
          </PrintSection>

          <PrintSection index="02" title="Ítems" className="print-items">
            <Table<QuoteLine>
              className="print-table"
              rowKey="sku"
              size="small"
              pagination={false}
              dataSource={quote.items}
              columns={[
                { title: "SKU", dataIndex: "sku", width: 110 },
                { title: "Producto", dataIndex: "nombre" },
                { title: "Cant.", dataIndex: "cantidad", align: "right", width: 70 },
                {
                  title: "Precio unit.",
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
          </PrintSection>

          <PrintSection index="03" title="Totales" className="print-totals-section">
            <div className="print-totals">
              <div className="print-totals-box">
                <div>
                  <span>Subtotal</span>
                  <span>{money(quote.subtotal)}</span>
                </div>
                <div>
                  <span>Descuento</span>
                  <span>{money(quote.descuento_total)}</span>
                </div>
                <div>
                  <span>IVA</span>
                  <span>{money(quote.impuesto_total)}</span>
                </div>
                <div className="print-total-final">
                  <span>Total</span>
                  <span>{money(quote.total)}</span>
                </div>
              </div>
            </div>
          </PrintSection>

          {quote.notas && (
            <div className="print-note">
              <div className="print-label">Notas</div>
              <p className="print-pre">{quote.notas}</p>
            </div>
          )}

          <PrintSection index="04" title="Condiciones">
            <div className="print-conditions">
              <ul>
                <li>Los precios están expresados en pesos colombianos (COP).</li>
                <li>La cotización es válida hasta el {fmtDate(quote.fecha_validez)}.</li>
                <li>La entrega y la forma de pago se acuerdan al aprobar la cotización.</li>
                <li>Los valores pueden cambiar si el cliente modifica cantidades o especificaciones.</li>
              </ul>
            </div>
          </PrintSection>

          <PrintSection index="05" title="Firmas" className="print-signatures-section">
            <div className="print-signatures">
              <div>
                <div className="print-signature-line" />
                <div className="print-signature-label">Firma autorizada</div>
                <div className="print-signature-name">{quote.creador}</div>
              </div>
              <div>
                <div className="print-signature-line" />
                <div className="print-signature-label">Aceptación del cliente</div>
                <div className="print-signature-name">{quote.customer_nombre}</div>
              </div>
            </div>
          </PrintSection>

          <footer className="print-footer">
            {company.nombre} · {company.telefono} · {company.email} · Gracias por su preferencia.
          </footer>
        </article>
      </div>
    </PrintThemeProvider>
  );
}
