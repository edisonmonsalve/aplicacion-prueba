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
  Tag,
  Typography,
} from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  cancelInvoice,
  cancelInvoiceAdjustment,
  cancelInvoicePayment,
  confirmInvoice,
  getInvoice,
} from "@/services/invoicesService";
import { getFinanceAccounts } from "@/services/financeService";
import { canWriteFinance } from "@/utils/roles";
import type {
  FinanceAccount,
  InvoiceAdjustment,
  InvoiceAdjustmentItem,
  InvoiceDetail,
  InvoiceItem,
  InvoicePayment,
  InvoiceTransaction,
} from "@/types";
import { InvoiceEstadoTag, InvoiceTipoTag, fmtDate, money } from "./InvoiceUtils";
import PaymentModal from "./PaymentModal";
import InvoiceAdjustmentModal from "./InvoiceAdjustmentModal";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import PageHeader from "@/components/PageHeader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const CARTERA_META: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "blue" },
  parcial: { label: "Parcial", color: "gold" },
  pagada: { label: "Pagada", color: "green" },
  vencida: { label: "Vencida", color: "red" },
  no_aplica: { label: "No aplica", color: "default" },
};

const METODO_LABEL: Record<InvoicePayment["metodo"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const navigate = useNavigate();
  const { canOperate, user } = useAuth();
  const canWrite = canWriteFinance(user?.rol);
  const { message, modal } = App.useApp();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);

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

  // F6: saldo de la cuenta para mostrar el impacto en caja antes de confirmar.
  useEffect(() => {
    getFinanceAccounts()
      .then(setAccounts)
      .catch(() => {
        // Sin cuentas el detalle sigue funcionando; solo no se muestra el saldo.
      });
  }, []);

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

  const cancelPayment = async (payment: InvoicePayment) => {
    setBusy(true);
    try {
      await cancelInvoicePayment(invoiceId, payment.id);
      message.success("Movimiento anulado");
      await load();
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(msg ?? "No se pudo anular el movimiento");
    } finally {
      setBusy(false);
    }
  };

  const cancelAdjustment = async (adj: InvoiceAdjustment) => {
    setBusy(true);
    try {
      await cancelInvoiceAdjustment(invoiceId, adj.id);
      message.success("Nota anulada");
      await load();
    } catch (e) {
      const msg = isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : undefined;
      message.error(msg ?? "No se pudo anular la nota");
    } finally {
      setBusy(false);
    }
  };

  if (!invoice) return <Card loading />;

  const isDraft = invoice.estado === "borrador";
  const isConfirmed = invoice.estado === "confirmada";
  const esCredito = invoice.condicion_pago === "credito";

  // F6: cuenta que usará el asiento y saldo resultante tras confirmar.
  const account = invoice.account_id
    ? accounts.find((a) => a.id === invoice.account_id)
    : accounts.find((a) => a.activo);
  const signedImpact = esCredito
    ? 0
    : invoice.tipo === "venta"
      ? Number(invoice.total_neto)
      : -Number(invoice.total_neto);
  const saldoResultante = account
    ? Number(account.saldo_actual) + signedImpact
    : null;
  const impactoTexto = esCredito
    ? `Queda en cartera ${invoice.tipo === "venta" ? "por cobrar" : "por pagar"}: ${money(
        invoice.total_neto
      )}`
    : `Impacto en caja: ${signedImpact >= 0 ? "+" : "−"}${money(Math.abs(signedImpact))}`;

  const openConfirm = () => {
    modal.confirm({
      title: "¿Confirmar esta factura?",
      width: 480,
      content: (
        <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
          <span>
            {invoice.tipo === "venta"
              ? "Se validará stock, se descontará y se generará el ingreso."
              : "Se sumará stock, se actualizará el costo del producto y se generará el gasto."}
          </span>
          {account ? (
            <>
              <span>
                Cuenta: <strong>{account.nombre}</strong> ({account.tipo})
              </span>
              <span>Saldo actual: {money(account.saldo_actual)}</span>
              {esCredito ? (
                <span>
                  A crédito no mueve caja al confirmar. Queda en cartera{" "}
                  {invoice.tipo === "venta" ? "por cobrar" : "por pagar"}:{" "}
                  <strong>{money(invoice.total_neto)}</strong>
                </span>
              ) : (
                <>
                  <span>
                    Impacto en caja: {signedImpact >= 0 ? "+" : "−"}
                    {money(Math.abs(signedImpact))}
                  </span>
                  <span>
                    Saldo resultante: <strong>{money(saldoResultante!)}</strong>
                  </span>
                  {saldoResultante! < 0 && (
                    <Typography.Text type="danger">
                      La cuenta quedaría con saldo negativo.
                    </Typography.Text>
                  )}
                </>
              )}
            </>
          ) : (
            <Typography.Text type="warning">
              La factura no tiene cuenta asignada y no hay cuentas activas para usar por defecto.
            </Typography.Text>
          )}
        </Space>
      ),
      okText: "Sí, confirmar",
      cancelText: "No",
      onOk: () => run(confirmInvoice, "Factura confirmada"),
    });
  };

  if (!invoice) return <Card loading />;

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <PageBreadcrumb
        items={[{ label: "Facturas", to: "/facturas" }, { label: invoice.numero }]}
      />
      <PageHeader
        title={`Factura ${invoice.numero}`}
        description={
          invoice.tipo === "venta"
            ? "Al confirmar se descuenta stock y se registra el ingreso en finanzas."
            : "Al confirmar se suma stock, se actualiza el costo del producto y se registra el gasto."
        }
        style={{ marginBottom: 0 }}
        extra={
          <Space wrap>
            <Button onClick={() => navigate("/facturas")}>Volver</Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={() => navigate(`/facturas/${invoiceId}/imprimir`)}
            >
              Imprimir
            </Button>
            {canOperate && isDraft && (
              <>
                <Button type="primary" disabled={busy} onClick={openConfirm}>
                  Confirmar
                </Button>
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
            {canWrite && isConfirmed && (
              <Button onClick={() => setAdjustmentOpen(true)} disabled={busy}>
                Nota crédito/débito
              </Button>
            )}
          </Space>
        }
      />

      {isDraft && (
        <Alert
          type={!esCredito && saldoResultante !== null && saldoResultante < 0 ? "warning" : "info"}
          showIcon
          message={
            esCredito
              ? impactoTexto
              : account
                ? `${impactoTexto} · Saldo resultante: ${money(saldoResultante!)}`
                : "Esta factura no tiene cuenta asignada ni hay cuentas activas por defecto"
          }
          description={
            esCredito
              ? "Condición a crédito: al confirmar se reconoce el ingreso/activo y el IVA, pero la caja se mueve cuando se registre el cobro o pago."
              : account
                ? `Cuenta ${account.nombre} (${account.tipo}) · Saldo actual ${money(account.saldo_actual)}. Al confirmar se actualiza el stock y se registran los asientos financieros.`
                : "Asigna una cuenta desde Editar para poder ver el saldo y el impacto antes de confirmar."
          }
        />
      )}

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
            <Descriptions.Item label="Condición de pago">
              {esCredito ? `Crédito ${invoice.dias_credito} días` : "Contado"}
            </Descriptions.Item>
            <Descriptions.Item label="Vencimiento">
              {invoice.fecha_vencimiento ? fmtDate(invoice.fecha_vencimiento) : "—"}
            </Descriptions.Item>
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

      {isConfirmed && esCredito && (
        <Card
          title="Cartera y pagos"
          extra={
            <Space>
              <Tag color={CARTERA_META[invoice.estado_cartera]?.color}>
                {CARTERA_META[invoice.estado_cartera]?.label ?? invoice.estado_cartera}
              </Tag>
              {canWrite && (
                <Button
                  type="primary"
                  disabled={busy || invoice.saldo_pendiente <= 0}
                  onClick={() => setPaymentOpen(true)}
                >
                  {invoice.tipo === "venta" ? "Registrar cobro" : "Registrar pago"}
                </Button>
              )}
            </Space>
          }
        >
          <Space size={[32, 12]} wrap style={{ marginBottom: 16 }}>
            <Statistic title="Total neto" value={invoice.total_neto} precision={2} prefix="$" />
            <Statistic
              title="Pagado"
              value={invoice.pagado}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#389e0d" }}
            />
            <Statistic
              title="Saldo pendiente"
              value={invoice.saldo_pendiente}
              precision={2}
              prefix="$"
              valueStyle={{ color: invoice.saldo_pendiente > 0 ? "#cf1322" : undefined }}
            />
            <Statistic
              title="Vencimiento"
              value={invoice.fecha_vencimiento ? fmtDate(invoice.fecha_vencimiento) : "—"}
            />
          </Space>

          <Table<InvoicePayment>
            rowKey="id"
            pagination={false}
            scroll={{ x: "max-content" }}
            dataSource={invoice.pagos}
            locale={{ emptyText: "Aún no hay cobros ni pagos registrados" }}
            columns={[
              { title: "Fecha", dataIndex: "fecha", render: (v: string) => fmtDate(v) },
              {
                title: "Monto",
                dataIndex: "monto",
                align: "right",
                render: (v: number, p) => (
                  <Typography.Text delete={p.estado === "anulado"}>{money(v)}</Typography.Text>
                ),
              },
              {
                title: "Método",
                dataIndex: "metodo",
                render: (m: InvoicePayment["metodo"]) => METODO_LABEL[m] ?? m,
              },
              { title: "Cuenta", dataIndex: "cuenta", render: (v: string | null) => v ?? "—" },
              { title: "Referencia", dataIndex: "referencia", render: (v: string | null) => v ?? "—" },
              { title: "Registró", dataIndex: "creador" },
              {
                title: "Estado",
                dataIndex: "estado",
                render: (e: InvoicePayment["estado"]) =>
                  e === "valido" ? <Tag color="green">Válido</Tag> : <Tag>Anulado</Tag>,
              },
              ...(canWrite
                ? [
                    {
                      title: "",
                      width: 90,
                      render: (_: unknown, p: InvoicePayment) =>
                        p.estado === "valido" ? (
                          <Popconfirm
                            title="¿Anular este movimiento?"
                            description="Se registrará la contrapartida contable y el saldo volverá a la cartera."
                            okText="Sí, anular"
                            cancelText="No"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => cancelPayment(p)}
                          >
                            <Button size="small" danger disabled={busy}>
                              Anular
                            </Button>
                          </Popconfirm>
                        ) : null,
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      )}

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

      {invoice.ajustes && invoice.ajustes.length > 0 && (
        <Card title="Notas crédito/débito">
          <Table<InvoiceAdjustment>
            rowKey="id"
            pagination={false}
            scroll={{ x: "max-content" }}
            dataSource={invoice.ajustes}
            expandable={{
              expandedRowRender: (a) => (
                <Table<InvoiceAdjustmentItem>
                  rowKey="id"
                  pagination={false}
                  size="small"
                  dataSource={a.items}
                  columns={[
                    { title: "SKU", dataIndex: "sku" },
                    { title: "Producto", dataIndex: "producto" },
                    { title: "Cant.", dataIndex: "cantidad", align: "right" },
                    { title: "Precio unit.", dataIndex: "precio_unitario", align: "right", render: money },
                    { title: "Total línea", dataIndex: "total_linea", align: "right", render: money },
                  ]}
                />
              ),
            }}
            columns={[
              { title: "Número", dataIndex: "numero" },
              {
                title: "Tipo",
                dataIndex: "tipo",
                render: (t: InvoiceAdjustment["tipo"]) =>
                  t === "credito" ? <Tag color="green">Crédito</Tag> : <Tag color="orange">Débito</Tag>,
              },
              { title: "Fecha", dataIndex: "fecha", render: (v: string) => fmtDate(v) },
              { title: "Motivo", dataIndex: "motivo", render: (v: string | null) => v ?? "—" },
              { title: "Total", dataIndex: "total", align: "right", render: money },
              { title: "Neto", dataIndex: "total_neto", align: "right", render: money },
              {
                title: "Estado",
                dataIndex: "estado",
                render: (e: InvoiceAdjustment["estado"]) =>
                  e === "confirmada" ? <Tag color="green">Confirmada</Tag> : <Tag>Anulada</Tag>,
              },
              { title: "Registró", dataIndex: "creador" },
              ...(canWrite
                ? [
                    {
                      title: "",
                      width: 90,
                      render: (_: unknown, a: InvoiceAdjustment) =>
                        a.estado === "confirmada" ? (
                          <Popconfirm
                            title="¿Anular esta nota?"
                            description="Se revertirá el stock y se registrará la contrapartida contable."
                            okText="Sí, anular"
                            cancelText="No"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => cancelAdjustment(a)}
                          >
                            <Button size="small" danger disabled={busy}>
                              Anular
                            </Button>
                          </Popconfirm>
                        ) : null,
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      )}

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

      <PaymentModal
        open={paymentOpen}
        invoice={invoice}
        accounts={accounts}
        onCancel={() => setPaymentOpen(false)}
        onSaved={() => {
          setPaymentOpen(false);
          load();
        }}
      />

      <InvoiceAdjustmentModal
        open={adjustmentOpen}
        invoice={invoice}
        onCancel={() => setAdjustmentOpen(false)}
        onSaved={() => {
          setAdjustmentOpen(false);
          load();
        }}
      />
    </Space>
  );
}
