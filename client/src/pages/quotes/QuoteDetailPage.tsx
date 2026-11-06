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
    opts: { danger?: boolean; primary?: boolean } = {}
  ) => (
    <Popconfirm
      title={`¿${label} esta cotización?`}
      okText="Sí"
      cancelText="No"
      onConfirm={() => run(fn, ok)}
    >
      <Button type={opts.primary ? "primary" : "default"} danger={opts.danger} disabled={busy}>
        {label}
      </Button>
    </Popconfirm>
  );

  const failed = quote.estado === "rechazado" || quote.estado === "vencido";
  const stepIdx = FLOW.indexOf(quote.estado);
  const open = quote.estado === "borrador" || quote.estado === "enviado";
  const daysLeft = dayjs(quote.fecha_validez).diff(dayjs().startOf("day"), "day");

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap>
        <Button onClick={() => navigate("/cotizaciones")}>Volver</Button>
        {canAct &&
          quote.estado === "borrador" &&
          confirm("Enviar", sendQuote, "Cotización enviada", { primary: true })}
        {canAct &&
          quote.estado === "enviado" &&
          confirm("Aprobar", approveQuote, "Cotización aprobada", { primary: true })}
        {canAct &&
          quote.estado === "enviado" &&
          confirm("Rechazar", rejectQuote, "Cotización rechazada", { danger: true })}
        {canAct &&
          quote.estado === "aprobado" &&
          confirm("Entregar", deliverQuote, "Cotización entregada", { primary: true })}
        {canAct && quote.estado === "borrador" && (
          <Button onClick={() => navigate(`/cotizaciones/${quoteId}/editar`)} disabled={busy}>
            Editar
          </Button>
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
        />
      )}

      <Card>
        <Steps
          size="small"
          current={stepIdx === -1 ? 1 : stepIdx}
          status={failed ? "error" : quote.estado === "entregado" ? "finish" : "process"}
          items={[{ title: "Borrador" }, { title: "Enviado" }, { title: "Aprobado" }, { title: "Entregado" }]}
        />
      </Card>

      <Card title={quote.numero} extra={<StatusTag estado={quote.estado} />}>
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
          <div style={{ display: "flex", gap: 32 }}>
            <Statistic title="Subtotal" value={money(quote.subtotal)} />
            <Statistic title="Descuento" value={money(quote.descuento_total)} />
            <Statistic title="Impuesto" value={money(quote.impuesto_total)} />
            <Statistic title="Total" value={money(quote.total)} valueStyle={{ fontWeight: 700 }} />
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
            { title: "SKU", dataIndex: "sku" },
            { title: "Nombre", dataIndex: "nombre" },
            { title: "Cant.", dataIndex: "cantidad", align: "right" },
            { title: "Precio unit.", dataIndex: "precio_unitario", align: "right", render: money },
            { title: "Desc. %", dataIndex: "descuento_pct", align: "right" },
            { title: "Imp. %", dataIndex: "impuesto_pct", align: "right" },
            { title: "Total línea", dataIndex: "total_linea", align: "right", render: money },
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
