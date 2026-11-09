import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Dropdown,
  Popconfirm,
  Space,
  Statistic,
  Steps,
  Table,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import { DownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getQuote,
  sendQuote,
  approveQuote,
  rejectQuote,
  duplicateQuote,
  deliverQuote,
} from "../../services/quotesService";
import type { QuoteDetail, QuoteLine, QuoteStatus, StockFailure } from "../../types";
import { StatusTag, money, fmtDate, fmtDateTime } from "@/pages/quotes/QuoteUtils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const FLOW: QuoteStatus[] = ["borrador", "enviado", "aprobado", "entregado"];

export default function QuoteDetailPage() {
  const { id } = useParams();
  const quoteId = Number(id);
  const navigate = useNavigate();
  const { user, canOperate } = useAuth();
  const { message, modal } = App.useApp();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useDocumentTitle(quote?.numero ?? "Cotización");

  const load = useCallback(async () => {
    try {
      setQuote(await getQuote(quoteId));
    } catch (e) {
      const s = isAxiosError(e) ? e.response?.status : undefined;
      message.error(
        s === 403
          ? "No tienes acceso a esta cotización"
          : s === 404
            ? "Cotización no encontrada"
            : "Error al cargar la cotización"
      );
      navigate("/cotizaciones", { replace: true });
    }
  }, [quoteId, navigate, message]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: (id: number) => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn(quoteId);
      message.success(okMsg);
      await load();
    } catch (e) {
      const data = isAxiosError(e)
        ? (e.response?.data as { message?: string; errors?: StockFailure[] } | undefined)
        : undefined;
      if (data?.errors?.length) {
        modal.error({
          title: data.message ?? "No se pudo completar la acción",
          content: (
            <ul>
              {data.errors.map((f) => (
                <li key={f.sku}>
                  {f.sku} — {f.nombre}: {f.motivo}
                  {f.requerido !== undefined && ` (requerido ${f.requerido}, disponible ${f.disponible})`}
                </li>
              ))}
            </ul>
          ),
        });
      } else {
        message.error(data?.message ?? "No se pudo completar la acción");
      }
    } finally {
      setBusy(false);
    }
  };

  const onDuplicate = async () => {
    setBusy(true);
    try {
      const { id: newId } = await duplicateQuote(quoteId);
      message.success("Borrador creado");
      navigate(`/cotizaciones/${newId}`);
    } catch {
      message.error("No se pudo duplicar");
    } finally {
      setBusy(false);
    }
  };

  if (!quote) return <Card loading />;

  const canAct = canOperate && (user?.rol === "admin" || quote.created_by === user?.id);

  const confirm = (
    label: string,
    fn: (id: number) => Promise<unknown>,
    ok: string,
    opts: { danger?: boolean; primary?: boolean; tooltip?: string } = {}
  ) => (
    <Popconfirm
      title={`¿${label} esta cotización?`}
      okText="Sí"
      cancelText="No"
      onConfirm={() => run(fn, ok)}
    >
      <Tooltip title={opts.tooltip}>
        <Button type={opts.primary ? "primary" : "default"} danger={opts.danger} disabled={busy}>
          {label}
        </Button>
      </Tooltip>
    </Popconfirm>
  );

  const failed = quote.estado === "rechazado" || quote.estado === "vencido";
  const stepIdx = FLOW.indexOf(quote.estado);
  const open = quote.estado === "borrador" || quote.estado === "enviado";
  const daysLeft = dayjs(quote.fecha_validez).diff(dayjs().startOf("day"), "day");

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Cotización {quote.numero}
        </Typography.Title>
        <Typography.Text type="secondary">
          Consulta el detalle, avanza el estado y revisa el historial de cambios.
        </Typography.Text>
      </div>

      <Space wrap>
        <Tooltip title="Volver a la lista de cotizaciones">
          <Button onClick={() => navigate("/cotizaciones")}>Volver</Button>
        </Tooltip>
        {canAct &&
          quote.estado === "borrador" &&
          confirm("Enviar", sendQuote, "Cotización enviada", {
            primary: true,
            tooltip: "Marca la cotización como enviada al cliente y activa el control de vencimiento.",
          })}
        {canAct &&
          quote.estado === "enviado" &&
          confirm("Aprobar", approveQuote, "Cotización aprobada", {
            primary: true,
            tooltip: "Registra que el cliente aceptó la cotización.",
          })}
        {canAct &&
          quote.estado === "enviado" &&
          confirm("Rechazar", rejectQuote, "Cotización rechazada", {
            danger: true,
            tooltip: "Marca la cotización como rechazada; ya no podrá entregarse.",
          })}
        {canAct &&
          quote.estado === "aprobado" &&
          confirm("Entregar", deliverQuote, "Cotización entregada", {
            primary: true,
            tooltip: "Descuenta el stock de cada línea y genera el ingreso correspondiente en finanzas.",
          })}
        {canAct &&
          (quote.estado === "aprobado" || quote.estado === "entregado") && (
            <Button
              onClick={() => navigate(`/facturas/nuevo?quote=${quoteId}`)}
              disabled={busy}
              style={{ marginLeft: 8 }}
            >
              Generar factura
            </Button>
          )}
        {canAct && quote.estado === "borrador" && (
          <Tooltip title="Editar las líneas y datos de la cotización mientras siga en borrador">
            <Button onClick={() => navigate(`/cotizaciones/${quoteId}/editar`)} disabled={busy}>
              Editar
            </Button>
          </Tooltip>
        )}
        <Dropdown
          menu={{
            items: [
              { key: "dup", label: "Duplicar", disabled: busy || !canOperate, onClick: onDuplicate },
              {
                key: "print",
                label: "Imprimir",
                onClick: () => navigate(`/cotizaciones/${quoteId}/imprimir`),
              },
            ],
          }}
        >
          <Button>
            Más <DownOutlined />
          </Button>
        </Dropdown>
      </Space>

      {quote.estado === "entregado" && quote.pendiente_facturar && (
        <Alert
          showIcon
          type="warning"
          message="Esta cotización está entregada pero aún no tiene una factura vinculada."
          description={
            <>
              Puede generar una factura desde este documento (los datos se precargan) o crear una
              factura manualmente vinculándola. La suma de todas las facturas de una cotización no
              debe superar el total cotizado.
            </>
          }
        />
      )}

      {open && daysLeft <= 3 && (
        <Alert
          showIcon
          type={daysLeft < 0 ? "error" : "warning"}
          message={
            daysLeft < 0
              ? "Esta cotización está vencida"
              : daysLeft === 0
                ? "Esta cotización vence hoy"
                : `Esta cotización vence en ${daysLeft} día(s)`
          }
          description={
            daysLeft < 0
              ? "Puedes duplicarla para crear una nueva versión con fecha vigente."
              : "Revisa la fecha de validez antes de enviarla o aprobarla."
          }
        />
      )}

      <Card>
        <Steps
          size="small"
          current={stepIdx === -1 ? 1 : stepIdx}
          status={failed ? "error" : quote.estado === "entregado" ? "finish" : "process"}
          items={[
            { title: <Tooltip title="La cotización aún no se ha enviado al cliente">Borrador</Tooltip> },
            { title: <Tooltip title="Enviada al cliente, pendiente de respuesta">Enviado</Tooltip> },
            { title: <Tooltip title="El cliente aceptó la cotización">Aprobado</Tooltip> },
            { title: <Tooltip title="Se descontó el stock y se registró el ingreso">Entregado</Tooltip> },
          ]}
        />
      </Card>

      <Card title="Resumen" extra={<StatusTag estado={quote.estado} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between" }}>
          <Descriptions column={{ xs: 1, md: 2 }} size="small" style={{ flex: "1 1 420px" }}>
            <Descriptions.Item label="Cliente">{quote.customer_nombre}</Descriptions.Item>
            <Descriptions.Item label="Email">{quote.customer_email ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Documento">{quote.customer_documento ?? "—"}</Descriptions.Item>
            <Descriptions.Item label="Válido hasta">{fmtDate(quote.fecha_validez)}</Descriptions.Item>
            <Descriptions.Item label="Creado por">{quote.creador}</Descriptions.Item>
            <Descriptions.Item label="Notas" span={2}>
              {quote.notas ?? "—"}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <Statistic
              title={<Tooltip title="Suma de las líneas antes de descuentos e impuestos">Subtotal</Tooltip>}
              value={money(quote.subtotal)}
            />
            <Statistic
              title={<Tooltip title="Descuentos aplicados por línea">Descuento</Tooltip>}
              value={money(quote.descuento_total)}
            />
            <Statistic
              title={<Tooltip title="Impuestos aplicados por línea">Impuesto</Tooltip>}
              value={money(quote.impuesto_total)}
            />
            <Statistic
              title={<Tooltip title="Total final de la cotización">Total</Tooltip>}
              value={money(quote.total)}
              valueStyle={{ fontWeight: 700 }}
            />
          </div>
        </div>
      </Card>

      <Card title="Líneas">
        <Table<QuoteLine>
          rowKey="sku"
          pagination={false}
          scroll={{ x: "max-content" }}
          dataSource={quote.items}
          columns={[
            { title: <Tooltip title="Código del producto">SKU</Tooltip>, dataIndex: "sku" },
            { title: <Tooltip title="Nombre del producto">Nombre</Tooltip>, dataIndex: "nombre" },
            { title: <Tooltip title="Unidades cotizadas">Cant.</Tooltip>, dataIndex: "cantidad", align: "right" },
            { title: <Tooltip title="Precio unitario del catálogo">Precio unit.</Tooltip>, dataIndex: "precio_unitario", align: "right", render: money },
            { title: <Tooltip title="Descuento porcentual de la línea">Desc. %</Tooltip>, dataIndex: "descuento_pct", align: "right" },
            { title: <Tooltip title="Impuesto porcentual de la línea">Imp. %</Tooltip>, dataIndex: "impuesto_pct", align: "right" },
            { title: <Tooltip title="Precio por cantidad con descuento e impuesto">Total línea</Tooltip>, dataIndex: "total_linea", align: "right", render: money },
          ]}
        />
      </Card>

      <Card title="Historial de estados">
        <Timeline
          items={quote.historial.map((h) => ({
            children: (
              <>
                {h.estado_anterior ? <StatusTag estado={h.estado_anterior} /> : "—"} →{" "}
                <StatusTag estado={h.estado_nuevo} />
                <div style={{ opacity: 0.65, fontSize: 12 }}>
                  {h.usuario} · {fmtDateTime(h.created_at)}
                </div>
              </>
            ),
          }))}
        />
      </Card>
    </Space>
  );
}
