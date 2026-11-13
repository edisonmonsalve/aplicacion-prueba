import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { App, Button, Card, Col, Row, Space, Statistic, Table, Tag, Tooltip, Typography, DatePicker, Alert, List, Segmented } from "antd";
const { RangePicker } = DatePicker;
import {
  DeleteOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { deleteFinanceAccount, getFinanceSummary, getFinanceAccounts, getSuggestions } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { canWriteFinance } from "@/utils/roles";
import { getErrorMessage } from "@/utils/errors";
import { money } from "./FinanceUtils";
import type { FinanceAccount, FinanceCategoryTipo, FinanceSummary, Suggestion } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import PageHeader from "@/components/PageHeader";
import AccountFormModal from "./AccountFormModal";

const TIPO_LABEL: Record<FinanceCategoryTipo, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  activo: "Activo",
  pasivo: "Pasivo",
};

type Periodo = "dia" | "semana" | "mes" | "anio";

const PERIODOS: Array<{ label: string; value: Periodo }> = [
  { label: "Día", value: "dia" },
  { label: "Semana", value: "semana" },
  { label: "Mes", value: "mes" },
  { label: "Año", value: "anio" },
];

/**
 * Rango calendario de un periodo. La semana empieza en lunes (convención
 * colombiana), no en domingo como el `startOf("week")` de dayjs.
 */
function rangoDePeriodo(periodo: Periodo, base: dayjs.Dayjs): [dayjs.Dayjs, dayjs.Dayjs] {
  const dia = base.startOf("day");
  if (periodo === "dia") return [dia, dia];
  if (periodo === "semana") {
    const lunes = dia.subtract((dia.day() + 6) % 7, "day");
    return [lunes, lunes.add(6, "day")];
  }
  if (periodo === "mes") return [dia.startOf("month"), dia.endOf("month")];
  return [dia.startOf("year"), dia.endOf("year")];
}

const UNIDAD_PERIODO: Record<Periodo, dayjs.ManipulateType> = {
  dia: "day",
  semana: "week",
  mes: "month",
  anio: "year",
};

function etiquetaPeriodo(periodo: Periodo, range: [dayjs.Dayjs, dayjs.Dayjs]) {
  const [desde, hasta] = range;
  if (periodo === "dia") return desde.format("DD/MM/YYYY");
  if (periodo === "semana") {
    return `${desde.format("DD/MM")} – ${hasta.format("DD/MM/YYYY")}`;
  }
  if (periodo === "mes") return desde.format("MMMM [de] YYYY");
  return desde.format("YYYY");
}

/** Variación porcentual contra el periodo inmediatamente anterior. */
function variacion(actual: number | undefined, anterior: number | undefined | null) {
  if (actual === undefined || anterior === undefined || anterior === null) return null;
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

function Variacion({
  actual,
  anterior,
  inverso = false,
}: {
  actual: number | undefined;
  anterior: number | undefined | null;
  /** En egresos/compras, subir no es buena noticia. */
  inverso?: boolean;
}) {
  const pct = variacion(actual, anterior);
  if (pct === null) {
    return anterior === 0 ? (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Sin base de comparación
      </Typography.Text>
    ) : null;
  }
  const sube = pct >= 0;
  const bueno = inverso ? !sube : sube;
  return (
    <Tooltip title={`Periodo anterior: ${money(Number(anterior))}`}>
      <Typography.Text style={{ fontSize: 12, color: bueno ? "#389e0d" : "#cf1322" }}>
        {sube ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs. periodo anterior
      </Typography.Text>
    </Tooltip>
  );
}

export default function FinanceOverviewPage() {
  const { message, modal } = App.useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { get, update } = useUrlFilters();
  const canWrite = canWriteFinance(user?.rol);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // El rango vive en la URL: sobrevive a recargas y se puede compartir.
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => {
    const inicial = get("desde");
    const final = get("hasta");
    return [
      inicial && dayjs(inicial).isValid() ? dayjs(inicial) : dayjs().startOf("month"),
      final && dayjs(final).isValid() ? dayjs(final) : dayjs(),
    ];
  });
  // "personalizado" desactiva los atajos y deja mandar al RangePicker.
  const [periodo, setPeriodo] = useState<Periodo | "personalizado">(() => {
    const guardado = get("periodo");
    if (guardado === "dia" || guardado === "semana" || guardado === "mes" || guardado === "anio") {
      return guardado;
    }
    return get("desde") || get("hasta") ? "personalizado" : "mes";
  });
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | undefined>();

  const commitRange = (next: [dayjs.Dayjs, dayjs.Dayjs], nextPeriodo: Periodo | "personalizado") => {
    setRange(next);
    setPeriodo(nextPeriodo);
    update({
      desde: next[0].format("YYYY-MM-DD"),
      hasta: next[1].format("YYYY-MM-DD"),
      periodo: nextPeriodo === "personalizado" ? undefined : nextPeriodo,
    });
  };

  const changeRange = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!value || !value[0] || !value[1]) return;
    commitRange([value[0], value[1]], "personalizado");
  };

  const selectPeriodo = (next: Periodo) => {
    commitRange(rangoDePeriodo(next, dayjs()), next);
  };

  /** Mueve el rango un periodo completo hacia atrás o adelante. */
  const shiftPeriodo = (direccion: -1 | 1) => {
    if (periodo === "personalizado") return;
    const base = range[0].add(direccion, UNIDAD_PERIODO[periodo]);
    commitRange(rangoDePeriodo(periodo, base), periodo);
  };

  const enPeriodoActual =
    periodo !== "personalizado" &&
    range[0].isSame(rangoDePeriodo(periodo, dayjs())[0], "day") &&
    range[1].isSame(rangoDePeriodo(periodo, dayjs())[1], "day");

  useDocumentTitle("Finanzas");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const desde = range[0].format("YYYY-MM-DD");
      const hasta = range[1].format("YYYY-MM-DD");
      // Comparación: para los presets se usa el periodo calendario anterior
      // (mes anterior, año anterior); para un rango libre, un bloque de igual
      // duración inmediatamente anterior.
      let prevDesde: dayjs.Dayjs;
      let prevHasta: dayjs.Dayjs;
      if (periodo === "personalizado") {
        const dias = range[1].startOf("day").diff(range[0].startOf("day"), "day");
        prevHasta = range[0].subtract(1, "day");
        prevDesde = prevHasta.subtract(dias, "day");
      } else {
        [prevDesde, prevHasta] = rangoDePeriodo(
          periodo,
          range[0].subtract(1, UNIDAD_PERIODO[periodo])
        );
      }
      const [s, a, sg, prev] = await Promise.all([
        getFinanceSummary({ desde, hasta }),
        getFinanceAccounts(),
        getSuggestions(),
        getFinanceSummary({
          desde: prevDesde.format("YYYY-MM-DD"),
          hasta: prevHasta.format("YYYY-MM-DD"),
        }).catch(() => null),
      ]);
      setSummary(s);
      setAccounts(a);
      setSuggestions(sg);
      setPreviousSummary(prev);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar el resumen financiero"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, periodo]);

  const reportQuery = `desde=${range[0].format("YYYY-MM-DD")}&hasta=${range[1].format("YYYY-MM-DD")}`;

  const openNewAccount = () => {
    setEditingAccount(undefined);
    setAccountModalOpen(true);
  };

  const openEditAccount = (account: FinanceAccount) => {
    setEditingAccount(account);
    setAccountModalOpen(true);
  };

  const doDeleteAccount = (account: FinanceAccount) => {
    modal.confirm({
      title: `Eliminar cuenta "${account.nombre}"`,
      content:
        "Solo se puede eliminar una cuenta sin transacciones. Si tiene movimientos, desactívala para conservar el histórico.",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteFinanceAccount(account.id);
          message.success("Cuenta eliminada");
          await load();
        } catch (err) {
          message.error(getErrorMessage(err));
        }
      },
    });
  };

  const s = summary;

  const totalesCuentas = accounts.reduce(
    (acc, a) => ({
      saldo_inicial: acc.saldo_inicial + Number(a.saldo_inicial),
      ingresos: acc.ingresos + Number(a.ingresos),
      egresos: acc.egresos + Number(a.egresos),
      saldo_actual: acc.saldo_actual + Number(a.saldo_actual),
    }),
    { saldo_inicial: 0, ingresos: 0, egresos: 0, saldo_actual: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Resumen financiero"
        description="Consulta ingresos, egresos, utilidad y capital por día, semana, mes o año, con comparación contra el periodo anterior."
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Space wrap align="center" style={{ justifyContent: "space-between", width: "100%" }}>
            <Space wrap>
              <Segmented<Periodo>
                options={PERIODOS}
                value={periodo === "personalizado" ? undefined : periodo}
                onChange={selectPeriodo}
              />
              {periodo !== "personalizado" && (
                <Space.Compact>
                  <Tooltip title={`${periodo} anterior`}>
                    <Button
                      icon={<LeftOutlined />}
                      onClick={() => shiftPeriodo(-1)}
                      aria-label={`${periodo} anterior`}
                    />
                  </Tooltip>
                  <Button onClick={() => selectPeriodo(periodo)} disabled={enPeriodoActual}>
                    Actual
                  </Button>
                  <Tooltip title={`${periodo} siguiente`}>
                    <Button
                      icon={<RightOutlined />}
                      onClick={() => shiftPeriodo(1)}
                      aria-label={`${periodo} siguiente`}
                    />
                  </Tooltip>
                </Space.Compact>
              )}
            </Space>
            <Space wrap>
              <Typography.Text type="secondary">Rango personalizado:</Typography.Text>
              <RangePicker
                value={range}
                onChange={changeRange}
                format="DD/MM/YYYY"
                allowClear={false}
              />
            </Space>
          </Space>
          <Space wrap size={8} style={{ justifyContent: "space-between", width: "100%" }}>
            <Typography.Text type="secondary">
              {periodo === "personalizado" ? (
                <>
                  Rango personalizado:{" "}
                  <strong>
                    {range[0].format("DD/MM/YYYY")} – {range[1].format("DD/MM/YYYY")}
                  </strong>
                </>
              ) : (
                <>
                  Periodo: <strong>{etiquetaPeriodo(periodo, range)}</strong> ·{" "}
                  {range[0].format("DD/MM/YYYY")} – {range[1].format("DD/MM/YYYY")}
                </>
              )}
            </Typography.Text>
            <Space wrap size={4}>
              <Typography.Text type="secondary">Ver en:</Typography.Text>
              <Button size="small" type="link" onClick={() => navigate(`/finanzas/resultados?${reportQuery}`)}>
                Resultados
              </Button>
              <Button size="small" type="link" onClick={() => navigate(`/finanzas/flujo-caja?${reportQuery}`)}>
                Flujo de caja
              </Button>
              <Button size="small" type="link" onClick={() => navigate(`/finanzas/tendencias?${reportQuery}`)}>
                Tendencias
              </Button>
              <Button size="small" type="link" onClick={() => navigate(`/finanzas/transacciones?${reportQuery}`)}>
                Transacciones
              </Button>
            </Space>
          </Space>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Caja vs. contabilidad"
        description="La compra de inventario es salida de caja y se registra como activo: no reduce la utilidad. El costo de ventas reduce la utilidad y el margen, pero no mueve caja. El capital disponible y los egresos de caja solo consideran asientos que afectan caja o bancos."
      />

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="No se pudo cargar el resumen financiero"
          description={error}
          action={
            <Button size="small" onClick={load}>
              Reintentar
            </Button>
          }
        />
      )}

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Caja y bancos
      </Typography.Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Ingresos que entran a caja o bancos en el periodo">Ingresos</Tooltip>} value={s?.ingresos ?? 0} formatter={(v) => money(Number(v))} valueStyle={{ color: "#52c41a" }} />
            <Variacion actual={s?.ingresos} anterior={previousSummary?.ingresos} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Salidas reales de caja o bancos: gastos de operación y compras de inventario. No incluye asientos informativos como el costo de ventas.">Egresos de caja</Tooltip>} value={s?.egresos ?? 0} formatter={(v) => money(Number(v))} valueStyle={{ color: "#ff4d4f" }} />
            <Variacion actual={s?.egresos} anterior={previousSummary?.egresos} inverso />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Saldo acumulado de caja y bancos hasta la fecha final: saldo inicial + ingresos de caja - egresos de caja. No incluye costo de ventas ni IVA.">Capital disponible</Tooltip>} value={s?.capital_disponible ?? 0} formatter={(v) => money(Number(v))} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Acumulado a la fecha final
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Compras de inventario del periodo: salen de caja y quedan como activo. No reducen la utilidad.">Compras de inventario</Tooltip>} value={s?.compras_inventario ?? 0} formatter={(v) => money(Number(v))} valueStyle={{ color: "#fa8c16" }} />
            <Variacion actual={s?.compras_inventario} anterior={previousSummary?.compras_inventario} inverso />
          </Card>
        </Col>
      </Row>

      <Typography.Title level={5}>Resultado</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Ingresos menos todos los gastos, incluido el costo de ventas">Utilidad</Tooltip>} value={s?.utilidad ?? 0} formatter={(v) => money(Number(v))} />
            <Variacion actual={s?.utilidad} anterior={previousSummary?.utilidad} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Costo de los productos vendidos. Asiento informativo: reduce utilidad y margen, no afecta caja.">Costo de ventas</Tooltip>} value={s?.costo_ventas ?? 0} formatter={(v) => money(Number(v))} />
            <Variacion actual={s?.costo_ventas} anterior={previousSummary?.costo_ventas} inverso />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Ingresos menos costo de ventas">Margen bruto</Tooltip>} value={s?.margen_bruto ?? 0} formatter={(v) => money(Number(v))} />
            <Variacion actual={s?.margen_bruto} anterior={previousSummary?.margen_bruto} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="Margen bruto como porcentaje de los ingresos">Margen bruto %</Tooltip>} value={s?.margen_bruto_pct ?? 0} suffix="%" precision={0} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Sobre ingresos del periodo
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Typography.Title level={5}>Impuestos</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="IVA generado en ventas (pasivo). No es dinero disponible.">IVA por pagar</Tooltip>} value={s?.iva_por_pagar ?? 0} formatter={(v) => money(Number(v))} valueStyle={{ color: "#722ed1" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic title={<Tooltip title="IVA pagado en compras (activo). No es dinero disponible.">IVA descontable</Tooltip>} value={s?.iva_descontable ?? 0} formatter={(v) => money(Number(v))} valueStyle={{ color: "#1677ff" }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={<Tooltip title="IVA por pagar menos IVA descontable del periodo. Un valor negativo es saldo a favor.">IVA neto</Tooltip>}
              value={s?.iva_neto ?? 0}
              formatter={(v) => money(Number(v))}
              valueStyle={{ color: (s?.iva_neto ?? 0) > 0 ? "#fa8c16" : "#52c41a" }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {(s?.iva_neto ?? 0) < 0 ? "Saldo a favor" : "A cargo del periodo"}
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      {suggestions.length > 0 && (
        <Card
          title={
            <Tooltip title="Recomendaciones generadas a partir de la ejecución del presupuesto activo">
              <span>Sugerencias</span>
            </Tooltip>
          }
          style={{ marginBottom: 16 }}
        >
          <List
            dataSource={suggestions}
            renderItem={(s) => (
              <List.Item>
                <Alert
                  type={s.severidad === "danger" ? "error" : s.severidad === "warning" ? "warning" : "info"}
                  message={s.mensaje}
                  showIcon
                  style={{ width: "100%" }}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
      <Card
        title={
          <Tooltip title="Saldos y movimientos acumulados de cada cuenta">
            <span>Cuentas</span>
          </Tooltip>
        }
        extra={
          canWrite && (
            <Button icon={<PlusOutlined />} onClick={openNewAccount}>
              Nueva cuenta
            </Button>
          )
        }
        style={{ marginBottom: 16 }}
      >
        <Table<FinanceAccount>
          rowKey="id"
          dataSource={accounts}
          loading={loading}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "Aún no hay cuentas financieras" }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <strong>Totales</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} align="right">
                <strong>{money(totalesCuentas.saldo_inicial)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <strong>{money(totalesCuentas.ingresos)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <strong>{money(totalesCuentas.egresos)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <strong>{money(totalesCuentas.saldo_actual)}</strong>
              </Table.Summary.Cell>
              {canWrite && <Table.Summary.Cell index={6} />}
            </Table.Summary.Row>
          )}
          columns={[
            {
              title: <Tooltip title="Nombre de la cuenta">Cuenta</Tooltip>,
              dataIndex: "nombre",
              sorter: (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
              render: (v: string, a) => (
                <Space>
                  {v}
                  {a.activo !== 1 && <Tag>Inactiva</Tag>}
                </Space>
              ),
            },
            {
              title: <Tooltip title="Tipo de cuenta">Tipo</Tooltip>,
              dataIndex: "tipo",
              sorter: (a, b) => a.tipo.localeCompare(b.tipo),
              render: (v: string) => (v === "banco" ? "Banco" : "Caja"),
            },
            { title: <Tooltip title="Saldo inicial de la cuenta">Saldo inicial</Tooltip>, dataIndex: "saldo_inicial", align: "right", sorter: (a, b) => a.saldo_inicial - b.saldo_inicial, render: (v: number) => money(v) },
            { title: <Tooltip title="Ingresos que entran a la cuenta">Ingresos</Tooltip>, dataIndex: "ingresos", align: "right", sorter: (a, b) => a.ingresos - b.ingresos, render: (v: number) => money(v) },
            { title: <Tooltip title="Egresos que salen de la cuenta. No incluye asientos informativos como el costo de ventas.">Egresos de caja</Tooltip>, dataIndex: "egresos", align: "right", sorter: (a, b) => a.egresos - b.egresos, render: (v: number) => money(v) },
            { title: <Tooltip title="Saldo inicial + ingresos - egresos de caja de la cuenta">Saldo actual</Tooltip>, dataIndex: "saldo_actual", align: "right", sorter: (a, b) => a.saldo_actual - b.saldo_actual, render: (v: number) => money(v) },
            ...(canWrite
              ? [
                  {
                    title: <Tooltip title="Acciones">Acciones</Tooltip>,
                    key: "actions",
                    width: 96,
                    fixed: "right" as const,
                    render: (_: unknown, a: FinanceAccount) => (
                      <Space>
                        <Tooltip title="Editar nombre, tipo, saldo inicial o estado">
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            aria-label={`Editar cuenta ${a.nombre}`}
                            onClick={() => openEditAccount(a)}
                          />
                        </Tooltip>
                        <Tooltip title="Eliminar (solo si no tiene transacciones)">
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label={`Eliminar cuenta ${a.nombre}`}
                            onClick={() => doDeleteAccount(a)}
                          />
                        </Tooltip>
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Card
        title={
          <Tooltip title="Totales del periodo agrupados por categoría financiera">
            <span>Por categoría</span>
          </Tooltip>
        }
      >
        <Table
          rowKey="id"
          dataSource={s?.por_categoria ?? []}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "No hay movimientos en el periodo seleccionado" }}
          columns={[
            {
              title: <Tooltip title="Categoría financiera">Categoría</Tooltip>,
              dataIndex: "nombre",
              render: (v: string, c: FinanceSummary["por_categoria"][number]) => (
                <Space size={4} wrap>
                  {v}
                  {c.afecta_caja === 0 && (
                    <Tooltip title="Asiento informativo: afecta utilidad/margen, pero no mueve caja.">
                      <Tag>No afecta caja</Tag>
                    </Tooltip>
                  )}
                </Space>
              ),
            },
            {
              title: <Tooltip title="Tipo de categoría">Tipo</Tooltip>,
              dataIndex: "tipo",
              render: (t: FinanceCategoryTipo) => {
                const color = t === "ingreso" ? "green" : t === "gasto" ? "red" : t === "activo" ? "blue" : "purple";
                return <Tag color={color}>{TIPO_LABEL[t]}</Tag>;
              },
            },
            { title: <Tooltip title="Total del periodo">Total</Tooltip>, dataIndex: "total", align: "right", render: (v: number) => money(v) },
          ]}
        />
      </Card>

      <AccountFormModal
        open={accountModalOpen}
        account={editingAccount}
        onClose={() => setAccountModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
