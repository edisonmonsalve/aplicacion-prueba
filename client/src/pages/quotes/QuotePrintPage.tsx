import { useEffect, useState } from "react";
import { Button, Card, Table, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { getQuote } from "../../services/quotesService";
import type { QuoteDetail, QuoteLine } from "../../types";
import { StatusTag, money, fmtDate } from "./quoteUtils";
import PrintHeader from "@/components/print/PrintHeader";
import PrintThemeProvider from "@/components/print/PrintThemeProvider";
import { COMPANY } from "@/config/company";

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
          />

          <section className="print-block print-client">
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
          </section>

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

          <section className="print-totals">
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
          </section>

          {quote.notas && (
            <section className="print-block print-section">
              <div className="print-label">Notas</div>
              <p className="print-pre">{quote.notas}</p>
            </section>
          )}

          <section className="print-section print-conditions">
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              Condiciones
            </Typography.Title>
            <ul>
              <li>Los precios están expresados en pesos colombianos (COP).</li>
              <li>La cotización es válida hasta el {fmtDate(quote.fecha_validez)}.</li>
              <li>La entrega y la forma de pago se acuerdan al aprobar la cotización.</li>
              <li>Los valores pueden cambiar si el cliente modifica cantidades o especificaciones.</li>
            </ul>
          </section>

          <section className="print-signatures print-section">
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
          </section>

          <footer className="print-footer">
            {COMPANY.nombre} · {COMPANY.telefono} · {COMPANY.email} · Gracias por su preferencia.
          </footer>
        </article>
      </div>
    </PrintThemeProvider>
  );
}
