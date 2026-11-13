import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App, Button, Card, Col, Row, Space, Statistic, Table, Tag, Tooltip, Typography, Alert, List } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { deleteFinanceAccount, getFinanceSummary, getFinanceAccounts, getSuggestions } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { canWriteFinance } from "@/utils/roles";
import { getErrorMessage } from "@/utils/errors";
import { money } from "./FinanceUtils";
import type { FinanceAccount, FinanceCategoryTipo, FinanceSummary, Suggestion } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import PageHeader from "@/components/PageHeader";
import PeriodRangePicker from "@/components/PeriodRangePicker";
import { useDateRange } from "@/hooks/useDateRange";
import AccountFormModal from "./AccountFormModal";

const TIPO_LABEL: Record<FinanceCategoryTipo, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  activo: "Activo",
  pasivo: "Pasivo",
};

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
  const canWrite = canWriteFinance(user?.rol);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // El rango vive en la URL: sobrevive a recargas y se puede compartir.
  const {
    range,
    periodo,
    desde,
    hasta,
    previousRange,
    query: reportQuery,
    changeRange,
    selectPeriodo,
    shiftPeriodo,
    enPeriodoActual,
  } = useDateRange();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | undefined>();

  useDocumentTitle("Finanzas");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prevDesde, prevHasta] = previousRange ?? [range[0], range[1]];
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
        <PeriodRangePicker
          range={range}
          periodo={periodo}
          onChange={changeRange}
          onSelectPeriodo={selectPeriodo}
          onShift={shiftPeriodo}
          enPeriodoActual={enPeriodoActual}
          footer={
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
          }
        />
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
