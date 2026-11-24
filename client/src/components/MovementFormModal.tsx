import { useCallback, useEffect, useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Radio, Typography, message, Alert } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import { createMovement, type MovementInput } from "@/services/movementsService";
import { getAvailability, listBudgets } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { canAccessFinance, canEditCosts } from "@/utils/roles";
import { formatCurrency, currencyInputProps, integerInputProps, formatNumber } from "@/utils/format";
import type { BudgetAvailability, BudgetListItem, Product } from "@/types";
import ModalHeading from "@/components/ModalHeading";

interface Props {
  product: Product;
  onClose: () => void;
  onSaved: (newStock: number) => void;
}

type FormValues = Omit<MovementInput, "product_id">;

export default function MovementFormModal({ product, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<BudgetAvailability | null>(null);
  const [closedPeriod, setClosedPeriod] = useState<BudgetListItem | undefined>();
  const [avisosError, setAvisosError] = useState(false);
  const tipo = Form.useWatch("tipo", form);
  const cantidadWatch = Form.useWatch("cantidad", form);
  const costoWatch = Form.useWatch("costo_unitario", form);
  const puedeFijarCosto = canEditCosts(user?.rol);
  // El operador no pertenece al módulo financiero: no se le consultan importes
  // ni cierres, y se le avisa de que las validaciones se aplican al guardar.
  const puedeVerFinanzas = canAccessFinance(user?.rol);

  const costoEfectivo =
    puedeFijarCosto && tipo === "entrada" && costoWatch !== undefined
      ? costoWatch
      : (product.costo ?? 0);
  const costoTotal = tipo === "entrada" ? costoEfectivo * (cantidadWatch ?? 0) : 0;
  const excedeDisponible =
    !!availability && costoTotal > 0 && costoTotal > availability.disponible;

  const loadAvisos = useCallback(() => {
    if (!puedeVerFinanzas) {
      setAvailability(null);
      setClosedPeriod(undefined);
      setAvisosError(false);
      return;
    }
    let ignore = false;
    setAvisosError(false);
    Promise.all([
      getAvailability(product.id),
      listBudgets({ page: 1, pageSize: 100, estado: "cerrado" }),
    ])
      .then(([a, r]) => {
        if (ignore) return;
        setAvailability(a);
        const hoy = dayjs().format("YYYY-MM-DD");
        setClosedPeriod(r.data.find((b) => b.fecha_inicio <= hoy && b.fecha_fin >= hoy));
      })
      .catch(() => {
        if (!ignore) setAvisosError(true);
      });
    return () => {
      ignore = true;
    };
  }, [product.id, puedeVerFinanzas]);

  useEffect(() => loadAvisos(), [loadAvisos]);

  // El flag y el monto confirmado viajan como argumentos: usar el state del
  // render anterior reabría el confirm, porque `onOk` veía `false` en su closure.
  const submit = async (confirmed: boolean, confirmedGasto?: number) => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    const costoUnitario =
      puedeFijarCosto && values.tipo === "entrada" && values.costo_unitario !== undefined
        ? values.costo_unitario
        : values.tipo === "entrada"
          ? product.costo ?? 0
          : 0;
    const gasto = values.tipo === "entrada" ? costoUnitario * values.cantidad : 0;

    if (closedPeriod && values.tipo === "entrada" && gasto > 0) {
      messageApi.error(
        `El periodo "${closedPeriod.nombre}" está cerrado y no admite el egreso automático de esta entrada`
      );
      return;
    }

    if (
      availability &&
      values.tipo === "entrada" &&
      gasto > 0 &&
      gasto > availability.disponible &&
      (!confirmed || gasto !== confirmedGasto)
    ) {
      if (user?.rol !== "admin") {
        messageApi.error(
          "Esta compra supera el disponible del presupuesto y solo un administrador puede confirmarla"
        );
        return;
      }
      Modal.confirm({
        title: "Presupuesto excedido",
        content: `Esta compra (${formatCurrency(gasto)}) supera el disponible (${formatCurrency(availability.disponible)}) de la línea "${availability.budget_nombre}". ¿Deseas continuar?`,
        okText: "Continuar",
        cancelText: "Cancelar",
        onOk: () => void submit(true, gasto),
      });
      return;
    }

    setSaving(true);
    try {
      const result = await createMovement({
        product_id: product.id,
        tipo: values.tipo,
        cantidad: values.cantidad,
        ...(puedeFijarCosto && values.tipo === "entrada" && values.costo_unitario !== undefined
          ? { costo_unitario: values.costo_unitario }
          : {}),
        motivo: values.motivo || undefined,
      });
      onSaved(result.stock_actual);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // RN-02: el servidor es la autoridad, aunque el formulario ya avise antes
        form.setFields([{ name: "cantidad", errors: [getErrorMessage(err)] }]);
      } else {
        messageApi.error(getErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOk = () => void submit(false);

  return (
    <Modal
      open
      width={560}
      className="ui-form-modal"
      title={
        <ModalHeading
          eyebrow="Inventario"
          title="Registrar movimiento"
          description="La entrada suma stock y la salida lo descuenta; ambas quedan registradas."
        />
      }
      okText="Registrar"
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
    >
      {contextHolder}
      <Typography.Paragraph>
        <b>{product.sku}</b> · {product.nombre}
        <br />
        Stock actual: <b>{formatNumber(product.stock_actual)}</b>
      </Typography.Paragraph>

      {!puedeVerFinanzas && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Las validaciones financieras se aplican al guardar"
          description="Tu rol no consulta presupuestos ni cierres contables. Si la entrada genera un egreso en un periodo cerrado, el registro se rechazará con el motivo."
        />
      )}

      {puedeVerFinanzas && avisosError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="No se pudieron consultar los avisos financieros"
          description="El presupuesto y el periodo se seguirán validando al guardar."
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => loadAvisos()}>
              Reintentar
            </Button>
          }
        />
      )}

      {closedPeriod && tipo === "entrada" && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Hoy está dentro del periodo cerrado "${closedPeriod.nombre}"`}
          description="Las entradas con costo generan un egreso automático y no se podrán registrar hasta que el periodo se reabra o se cree uno nuevo."
        />
      )}

      {availability && tipo !== "salida" && (
        <Alert
          showIcon
          type="info"
          message={`Presupuesto activo: ${availability.budget_nombre}`}
          description={`Disponible ${formatCurrency(availability.disponible)} de ${formatCurrency(availability.planeado)} planeados.`}
          style={{ marginBottom: 12 }}
        />
      )}

      {excedeDisponible && (
        <Alert
          showIcon
          type="warning"
          message="Esta entrada supera el disponible del presupuesto"
          description={`El costo de la entrada es ${formatCurrency(costoTotal)} y el disponible es ${formatCurrency(availability!.disponible)}. Solo un administrador puede confirmarla.`}
          style={{ marginBottom: 12 }}
        />
      )}
      <Form form={form} layout="vertical" initialValues={{ tipo: "entrada" }}>
        <Form.Item label="Tipo" name="tipo" tooltip="Entrada suma stock, salida lo descuenta.">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: "entrada", label: "Entrada" },
              { value: "salida", label: "Salida" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="Cantidad"
          name="cantidad"
          tooltip="Unidades a registrar en el movimiento."
          dependencies={["tipo"]} // revalida al cambiar entre entrada y salida
          rules={[
            { required: true, message: "Ingresa la cantidad" },
            { type: "number", min: 1, message: "Debe ser mayor que cero" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (getFieldValue("tipo") === "salida" && value > product.stock_actual) {
                  return Promise.reject(
                    new Error(`Stock insuficiente: disponible ${product.stock_actual}`)
                  );
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber {...integerInputProps} min={1} />
        </Form.Item>

        <Form.Item label="Motivo (opcional)" name="motivo" rules={[{ max: 255 }]} tooltip="Motivo del movimiento de stock.">
          <Input.TextArea rows={2} />
        </Form.Item>

        {puedeFijarCosto && tipo !== "salida" && (
          <Form.Item
            label="Costo unitario (opcional)"
            name="costo_unitario"
            tooltip="Costo por unidad de esta entrada (solo admin)."
            rules={[{ type: "number", min: 0, message: "No puede ser negativo" }]}
            extra="Si lo dejas vacío se usa el costo del producto."
          >
            <InputNumber {...currencyInputProps} />
          </Form.Item>
        )}

        {tipo !== "salida" && costoTotal > 0 && (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Esta entrada generará un egreso automático de <b>{formatCurrency(costoTotal)}</b> por el costo del
            stock.
          </Typography.Paragraph>
        )}
      </Form>
    </Modal>
  );
}