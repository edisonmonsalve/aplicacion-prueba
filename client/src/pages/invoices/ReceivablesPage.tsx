import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { getFinanceAccounts } from "@/services/financeService";
import { getCarteraAging, listReceivables } from "@/services/invoicesService";
import { getErrorMessage } from "@/utils/errors";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import TableSkeleton from "@/components/TableSkeleton";
import type {
  CarteraAging,
  CarteraEstado,
  FinanceAccount,
  InvoiceReceivable,
  InvoiceTipo,
  PaginatedReceivables,
} from "@/types";
import { InvoiceTipoTag, fmtDate, money } from "./InvoiceUtils";

const FMT = "YYYY-MM-DD";
const DEFAULT_PAGE_SIZE = 20;

const ESTADO_META: Record<CarteraEstado, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "blue" },
  parcial: { label: "Parcial", color: "gold" },
  pagada: { label: "Pagada", color: "green" },
  vencida: { label: "Vencida", color: "red" },
  no_aplica: { label: "No aplica", color: "default" },
};

const ESTADO_OPTIONS = (Object.keys(ESTADO_META) as CarteraEstado[])
  .filter((e) => e !== "no_aplica")
  .map((value) => ({ value, label: ESTADO_META[value].label }));

export default function ReceivablesPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { user } = useAuth();
  const { get, getPositiveInt, update } = useUrlFilters();

  const q = get("q") ?? "";
  const tipo = (get("tipo") as InvoiceTipo | undefined) ?? undefined;
  const estado = (get("estado") as CarteraEstado | undefined) ?? undefined;
  const desde = get("desde");
  const hasta = get("hasta");
  const page = getPositiveInt("page", 1);
  const pageSize = getPositiveInt("pageSize", DEFAULT_PAGE_SIZE);

  const [data, setData] = useState<PaginatedReceivables>({
    data: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    resumen: { por_cobrar: 0, por_pagar: 0, vencido: 0 },
  });
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [aging, setAging] = useState<CarteraAging | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState(q);

  useDocumentTitle("Cartera");

  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== q) update({ q: text.trim() || undefined }, { resetPage: true });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReceivables({
      page,
      pageSize,
      q: q || undefined,
      tipo,
      estado,
      desde,
      hasta,
    })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((err) => message.error(getErrorMessage(err, "No se pudo cargar la cartera")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getCarteraAging({ desde, hasta })
      .then((a) => {
        if (!cancelled) setAging(a);
      })
      .catch(() => {
        // El aging es complementario: la lista sigue funcionando sin él.
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, q, tipo, estado, desde, hasta, message]);

  // Solo se usa para el acceso rápido al detalle; no se muestra aquí.
  useEffect(() => {
    getFinanceAccounts().then(setAccounts).catch(() => {});
  }, []);

  const hasFilters = !!(q || tipo || estado || desde || hasta);
  const firstLoad = loading && data.data.length === 0;
  const cobrar = data.resumen.por_cobrar;
  const pagar = data.resumen.por_pagar;
  const neto = cobrar - pagar;

  return (
    <>
      <PageHeader
        title="Cartera"
        description="Cuentas por cobrar y por pagar de facturas a crédito, con su vencimiento y saldo pendiente."
        extra={
          <Button onClick={() => navigate("/facturas")}>Ir a facturas</Button>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Por cobrar"
              value={cobrar}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Por pagar"
              value={pagar}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#d46b08" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Neto"
              value={neto}
              precision={2}
              prefix="$"
              valueStyle={{ color: neto >= 0 ? "#389e0d" : "#cf1322" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Tooltip title="Saldo vencido de facturas por cobrar y por pagar.">
              <Statistic
                title="Vencido"
                value={data.resumen.vencido}
                precision={2}
                prefix="$"
                valueStyle={{ color: data.resumen.vencido > 0 ? "#cf1322" : undefined }}
              />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      {aging && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={14}>
              <Card
                size="small"
                title="Antigüedad por cobrar"
                extra={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Al {fmtDate(aging.as_of)}
                  </Typography.Text>
                }
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                  {[
                    { label: "Corriente", value: aging.aging.venta.corriente, color: "#389e0d" },
                    { label: "1-30 días", value: aging.aging.venta.d1_30, color: "#d48806" },
                    { label: "31-60 días", value: aging.aging.venta.d31_60, color: "#d46b08" },
                    { label: "61-90 días", value: aging.aging.venta.d61_90, color: "#cf1322" },
                    { label: "+90 días", value: aging.aging.venta.d90_mas, color: "#a8071a" },
                  ].map((b) => (
                    <div key={b.label} style={{ minWidth: 130 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {b.label}
                      </Typography.Text>
                      <div style={{ fontWeight: 600, color: b.value > 0 ? b.color : undefined }}>
                        {money(b.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card size="small" title="Indicadores de cobro">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                  <Statistic
                    title={<Tooltip title="Días de ventas a crédito que representa la cartera por cobrar actual.">DSO</Tooltip>}
                    value={aging.dso === null ? "—" : aging.dso}
                    precision={aging.dso === null ? undefined : 1}
                    suffix={aging.dso === null ? undefined : "días"}
                  />
                  <Statistic
                    title="Vencido por cobrar"
                    value={aging.totales.vencido_cobrar}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: aging.totales.vencido_cobrar > 0 ? "#cf1322" : undefined }}
                  />
                  <Statistic
                    title="Por vencer (7 días)"
                    value={aging.totales.por_vencer_7d}
                    precision={2}
                    prefix="$"
                  />
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Ventas a crédito del periodo: {money(aging.ventas_credito)} ·{" "}
                  {aging.facturas_credito} factura(s)
                </Typography.Text>
              </Card>
            </Col>
          </Row>

          {aging.totales.facturas_vencidas > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${aging.totales.facturas_vencidas} factura(s) vencida(s)`}
              description={`Saldo vencido por cobrar: ${money(
                aging.totales.vencido_cobrar
              )}. Revisa los cobros pendientes y prioriza los tramos de mayor mora.`}
            />
          )}

          {aging.top_deudores.length > 0 && (
            <Card
              size="small"
              title="Principales deudores"
              style={{ marginBottom: 16 }}
              extra={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Ordenados por saldo vencido
                </Typography.Text>
              }
            >
              <Table
                rowKey={(r) => `${r.party_id ?? r.contraparte}`}
                size="small"
                pagination={false}
                scroll={{ x: "max-content" }}
                dataSource={aging.top_deudores}
                columns={[
                  { title: "Cliente", dataIndex: "contraparte" },
                  {
                    title: "Saldo",
                    dataIndex: "saldo",
                    align: "right",
                    render: (v: number) => money(v),
                  },
                  {
                    title: "Vencido",
                    dataIndex: "vencido",
                    align: "right",
                    render: (v: number) => (
                      <Typography.Text type={v > 0 ? "danger" : undefined}>{money(v)}</Typography.Text>
                    ),
                  },
                  {
                    title: "Mora máxima",
                    dataIndex: "max_dias",
                    align: "right",
                    render: (d: number) => (d > 0 ? `${d} días` : "—"),
                  },
                ]}
              />
            </Card>
          )}
        </>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Buscar
          </Typography.Text>
          <Input.Search
            allowClear
            placeholder="Número o contraparte"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: 240 }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Tipo
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 140 }}
            value={tipo}
            options={[
              { value: "venta", label: "Por cobrar" },
              { value: "compra", label: "Por pagar" },
            ]}
            onChange={(v) => update({ tipo: v }, { resetPage: true })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Estado
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: 150 }}
            value={estado}
            options={ESTADO_OPTIONS}
            onChange={(v) => update({ estado: v }, { resetPage: true })}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
            Fecha de factura
          </Typography.Text>
          <DatePicker.RangePicker
            format={FMT}
            value={desde && hasta ? [dayjs(desde), dayjs(hasta)] : null}
            onChange={(v) =>
              update(
                { desde: v?.[0]?.format(FMT), hasta: v?.[1]?.format(FMT) },
                { resetPage: true }
              )
            }
          />
        </div>
        {hasFilters && (
          <Button
            onClick={() => {
              setText("");
              update({ q: undefined, tipo: undefined, estado: undefined, desde: undefined, hasta: undefined }, { resetPage: true });
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {accounts.length === 0 && user?.rol !== "consulta" && data.data.some((r) => r.saldo_pendiente > 0) && (
        <Typography.Text type="warning" style={{ display: "block", marginBottom: 12 }}>
          No hay cuentas de caja o banco activas. Crea una en Finanzas para poder registrar cobros y pagos.
        </Typography.Text>
      )}

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<InvoiceReceivable>
          rowKey="id"
          loading={loading}
          dataSource={data.data}
          scroll={{ x: "max-content" }}
          onRow={(r) => ({
            onClick: () => navigate(`/facturas/${r.id}`),
            style: { cursor: "pointer" },
          })}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters
                    ? "Ninguna factura coincide con los filtros"
                    : "No hay cartera pendiente. Las facturas a crédito aparecen aquí al confirmarse."
                }
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            showTotal: (t) => `${t} facturas`,
            onChange: (p, ps) =>
              update({ page: p, pageSize: ps }, { resetPage: false }),
          }}
          columns={[
            { title: "Número", dataIndex: "numero" },
            {
              title: "Tipo",
              dataIndex: "tipo",
              render: (t: InvoiceTipo) => <InvoiceTipoTag tipo={t} />,
            },
            { title: "Contraparte", dataIndex: "contraparte" },
            {
              title: "Fecha",
              dataIndex: "fecha",
              render: (v: string) => fmtDate(v),
            },
            {
              title: "Vencimiento",
              dataIndex: "fecha_vencimiento",
              render: (v: string | null) => (v ? fmtDate(v) : "—"),
            },
            {
              title: "Estado",
              dataIndex: "estado_cartera",
              render: (e: CarteraEstado) => (
                <Tag color={ESTADO_META[e]?.color}>{ESTADO_META[e]?.label ?? e}</Tag>
              ),
            },
            {
              title: <Tooltip title="Días transcurridos desde el vencimiento">Mora</Tooltip>,
              dataIndex: "dias_vencido",
              align: "right",
              render: (d: number, r) =>
                r.estado_cartera === "vencida" && d > 0 ? (
                  <Typography.Text type="danger">{d} d</Typography.Text>
                ) : (
                  "—"
                ),
            },
            {
              title: "Total neto",
              dataIndex: "total_neto",
              align: "right",
              render: (v: number) => money(v),
            },
            {
              title: "Pagado",
              dataIndex: "pagado",
              align: "right",
              render: (v: number) => money(v),
            },
            {
              title: "Saldo",
              dataIndex: "saldo_pendiente",
              align: "right",
              render: (v: number) => <strong>{money(v)}</strong>,
            },
          ]}
        />
      )}
    </>
  );
}
