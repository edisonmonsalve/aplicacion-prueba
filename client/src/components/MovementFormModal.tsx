import { useState, useEffect } from "react";
import { Form, Input, InputNumber, Modal, Radio, Typography, message, Alert } from "antd";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import { createMovement, type MovementInput } from "@/services/movementsService";
import { getAvailability, listBudgets } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { canEditCosts } from "@/utils/roles";
import type { BudgetAvailability, BudgetListItem, Product } from "@/types";

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
  const [confirmedExceed, setConfirmedExceed] = useState(false);
  const tipo = Form.useWatch("tipo", form);
  const puedeFijarCosto = canEditCosts(user?.rol);

  useEffect(() => {
    let ignore = false;
    getAvailability(product.id)
      .then((a) => { if (!ignore) setAvailability(a); })
      .catch(() => {});
    listBudgets({ page: 1, pageSize: 100, estado: "cerrado" })
      .then((r) => {
        if (ignore) return;
        const hoy = dayjs().format("YYYY-MM-DD");
        setClosedPeriod(r.data.find((b) => b.fecha_inicio <= hoy && b.fecha_fin >= hoy));
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [product.id]);

  useEffect(() => {
    setConfirmedExceed(false);
  }, [tipo]);

  const handleOk = async () => {
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
      !confirmedExceed
    ) {
      if (user?.rol !== "admin") {
        messageApi.error(
          "Esta compra supera el disponible del presupuesto y solo un administrador puede confirmarla"
        );
        return;
      }
      Modal.confirm({
        title: "Presupuesto excedido",
        content: `Esta compra (${gasto.toLocaleString("es-CO")}) supera el disponible (${availability.disponible.toLocaleString("es-CO")}) de la línea "${availability.budget_nombre}". ¿Deseas continuar?`,
        okText: "Continuar",
        cancelText: "Cancelar",
        onOk: () => {
          setConfirmedExceed(true);
          handleOk();
        },
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

  return (
    <Modal
      open
      title="Registrar movimiento"
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
        Stock actual: <b>{product.stock_actual}</b>
      </Typography.Paragraph>

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
          type="info"
          message={`Presupuesto activo: ${availability.budget_nombre}. Disponible: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(availability.disponible)}. Planeado: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(availability.planeado)}.`}
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
          <InputNumber min={1} precision={0} style={{ width: "100%" }} />
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
            <InputNumber min={0} step={100} style={{ width: "100%" }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}