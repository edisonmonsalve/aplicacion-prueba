import { useCallback, useEffect, useState } from "react";
import { Button, Card, Descriptions, Popconfirm, Space, Table, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getQuote, sendQuote, approveQuote, rejectQuote, duplicateQuote } from "../../services/quotesService";
import type { QuoteDetail, QuoteHistory, QuoteLine } from "../../types";
import { StatusTag, money, fmtDate, fmtDateTime } from "./quoteUtils";
import { isAxiosError } from "axios";
import { Modal } from "antd"; // añadir Modal al import de antd
import type { StockFailure } from "../../types"; // añadir al import type
import { deliverQuote } from "../../services/quotesService"; // añadir al import

export default function QuoteDetailPage() {
  const { id } = useParams();
  const quoteId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setQuote(await getQuote(quoteId));
    } catch (e) {
      const s = isAxiosError(e) ? e.response?.status : undefined;
      message.error(
        s === 403
          ? "No tienes acceso a este presupuesto"
          : s === 404
            ? "Presupuesto no encontrado"
            : "Error al cargar el presupuesto"
      );
      navigate("/presupuestos", { replace: true });
    }
  }, [quoteId, navigate]);

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
        Modal.error({
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
      navigate(`/presupuestos/${newId}`);
    } catch {
      message.error("No se pudo duplicar");
    } finally {
      setBusy(false);
    }
  };

  if (!quote) return <Card loading />;

  const canAct = user?.rol === "admin" || quote.created_by === user?.id;

  const confirm = (label: string, fn: (id: number) => Promise<unknown>, ok: string, danger = false) => (
    <Popconfirm
      title={`¿${label} este presupuesto?`}
      okText="Sí"
      cancelText="No"
      onConfirm={() => run(fn, ok)}
    >
      <Button danger={danger} disabled={busy}>
        {label}
      </Button>
    </Popconfirm>
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space>
        <Button onClick={() => navigate("/presupuestos")}>Volver</Button>
        {canAct && quote.estado === "borrador" && confirm("Enviar", sendQuote, "Presupuesto enviado")}
        {canAct && quote.estado === "enviado" && confirm("Aprobar", approveQuote, "Presupuesto aprobado")}
        {canAct &&
          quote.estado === "enviado" &&
          confirm("Rechazar", rejectQuote, "Presupuesto rechazado", true)}
        {canAct && quote.estado === "aprobado" && confirm("Entregar", deliverQuote, "Presupuesto entregado")}
        {canAct && quote.estado === "borrador" && (
          <Button onClick={() => navigate(`/presupuestos/${quoteId}/editar`)} disabled={busy}>
            Editar
          </Button>
        )}
        <Button onClick={onDuplicate} disabled={busy}>
          Duplicar
        </Button>
        <Button onClick={() => navigate(`/presupuestos/${quoteId}/imprimir`)}>Imprimir</Button>
      </Space>

      <Card title={quote.numero} extra={<StatusTag estado={quote.estado} />}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Cliente">{quote.customer_nombre}</Descriptions.Item>
          <Descriptions.Item label="Email">{quote.customer_email ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Documento">{quote.customer_documento ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Válido hasta">{fmtDate(quote.fecha_validez)}</Descriptions.Item>
          <Descriptions.Item label="Creado por">{quote.creador}</Descriptions.Item>
          <Descriptions.Item label="Subtotal">{money(quote.subtotal)}</Descriptions.Item>
          <Descriptions.Item label="Descuento">{money(quote.descuento_total)}</Descriptions.Item>
          <Descriptions.Item label="Impuesto">{money(quote.impuesto_total)}</Descriptions.Item>
          <Descriptions.Item label="Total">
            <strong>{money(quote.total)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Notas" span={2}>
            {quote.notas ?? ""}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Líneas">
        <Table<QuoteLine>
          rowKey="id"
          pagination={false}
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
        <Table<QuoteHistory>
          rowKey={(h) => h.created_at + h.estado_nuevo}
          pagination={false}
          dataSource={quote.historial}
          columns={[
            {
              title: "Cambio",
              render: (_, h) => (
                <>
                  {h.estado_anterior ? <StatusTag estado={h.estado_anterior} /> : "—"} →{" "}
                  <StatusTag estado={h.estado_nuevo} />
                </>
              ),
            },
            { title: "Usuario", dataIndex: "usuario" },
            { title: "Fecha", dataIndex: "created_at", render: fmtDateTime },
          ]}
        />
      </Card>
    </Space>
  );
}
