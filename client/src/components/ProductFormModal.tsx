import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Tag,
  Typography,
  message,
  theme,
} from "antd";
import { isAxiosError } from "axios";
import { createProduct, updateProduct, type ProductInput } from "@/services/productsService";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/utils/errors";
import { canEditCosts, canSeeCosts } from "@/utils/roles";
import { currencyInputProps, formatCurrency, formatPercent, formatSignedCurrency } from "@/utils/format";
import {
  getMargin,
  marginColor,
  marginLabel,
  priceFromMargin,
  priceFromMarkup,
} from "@/utils/margin";
import type { Category, Product } from "@/types";

interface Props {
  product: Product | null; // null = crear, Product = editar
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

type PlannerMode = "margen" | "markup";

const MAX_AMOUNT = 9_999_999_999;
const MAX_STOCK = 1_000_000;

export default function ProductFormModal({ product, categories, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { token } = theme.useToken();
  const [form] = Form.useForm<ProductInput>();
  const [messageApi, contextHolder] = message.useMessage();
  const [saving, setSaving] = useState(false);
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("margen");
  const [plannerPct, setPlannerPct] = useState<number | null>(40);

  const isEdit = product !== null;
  const verCosto = canSeeCosts(user?.rol);
  const editarCosto = canEditCosts(user?.rol);

  // Valores vivos del formulario para calcular el margen mientras se escribe.
  const precio = Form.useWatch("precio", form) as number | undefined;
  const costo = Form.useWatch("costo", form) as number | undefined;
  const margin = getMargin(precio, costo);

  const suggestedPrice =
    plannerMode === "margen"
      ? priceFromMargin(costo, plannerPct)
      : priceFromMarkup(costo, plannerPct);

  const canSuggest = !!suggestedPrice && suggestedPrice > 0 && suggestedPrice <= MAX_AMOUNT;

  const applySuggestedPrice = () => {
    if (!canSuggest) return;
    form.setFieldValue("precio", suggestedPrice);
    void form.validateFields(["precio"]).catch(() => undefined);
  };

  const handleOk = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;

    setSaving(true);
    try {
      if (product) await updateProduct(product.id, values);
      else await createProduct(values);
      onSaved();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // RN-01: SKU repetido, se muestra bajo el campo SKU
        form.setFields([{ name: "sku", errors: [getErrorMessage(err)] }]);
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
      width={640}
      title={isEdit ? "Editar producto" : "Nuevo producto"}
      okText={isEdit ? "Guardar cambios" : "Crear producto"}
      cancelText="Cancelar"
      confirmLoading={saving}
      onOk={handleOk}
      onCancel={onClose}
      maskClosable={false}
    >
      {contextHolder}
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        requiredMark="optional"
        initialValues={
          product
            ? {
                sku: product.sku,
                nombre: product.nombre,
                category_id: product.category_id,
                precio: product.precio,
                costo: product.costo ?? 0,
                stock_minimo: product.stock_minimo,
              }
            : { stock_minimo: 0, costo: 0 }
        }
      >
        <Row gutter={12}>
          <Col xs={24} sm={9}>
            <Form.Item
              label="SKU"
              name="sku"
              tooltip="Código único del producto (no se puede repetir)."
              rules={[
                { required: true, message: "Ingresa el SKU" },
                { max: 50, message: "Máximo 50 caracteres" },
              ]}
            >
              <Input placeholder="Ej. CAM-001" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={15}>
            <Form.Item
              label="Nombre"
              name="nombre"
              tooltip="Nombre descriptivo del producto."
              rules={[
                { required: true, message: "Ingresa el nombre" },
                { min: 2, message: "Mínimo 2 caracteres" },
                { max: 150, message: "Máximo 150 caracteres" },
              ]}
            >
              <Input placeholder="Ej. Camisa oversize algodón" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Categoría"
          name="category_id"
          tooltip="Categoría a la que pertenece el producto."
          rules={[{ required: true, message: "Selecciona una categoría" }]}
        >
          <Select
            placeholder="Selecciona"
            showSearch
            optionFilterProp="label"
            options={categories.map((c) => ({ value: c.id, label: c.nombre }))}
          />
        </Form.Item>

        <Divider style={{ margin: "4px 0 16px" }} />

        <Flex align="center" justify="space-between" gap={8} style={{ marginBottom: 12 }}>
          <Typography.Text strong>{verCosto ? "Precio y margen" : "Precio"}</Typography.Text>
          {verCosto && margin.marginPct !== null && (
            <Tag color={marginColor(margin.level)}>{formatPercent(margin.marginPct)} margen</Tag>
          )}
        </Flex>

        <Row gutter={12}>
          <Col xs={24} sm={verCosto ? 12 : 24}>
            <Form.Item
              label="Precio de venta"
              name="precio"
              tooltip="Precio al público, impuestos incluidos según tu operación."
              rules={[
                { required: true, message: "Ingresa el precio" },
                {
                  type: "number",
                  min: 1,
                  max: MAX_AMOUNT,
                  message: "Debe estar entre $ 1 y $ 9.999.999.999",
                },
              ]}
            >
              <InputNumber {...currencyInputProps} placeholder="$ 0" />
            </Form.Item>
          </Col>

          {verCosto && (
            <Col xs={24} sm={12}>
              <Form.Item
                label="Costo"
                name="costo"
                tooltip="Costo del producto (solo admin puede modificarlo)."
                rules={[
                  {
                    type: "number",
                    min: 0,
                    max: MAX_AMOUNT,
                    message: "Debe estar entre $ 0 y $ 9.999.999.999",
                  },
                ]}
                extra={
                  editarCosto
                    ? "Se usa para calcular margen y utilidad."
                    : "Solo lectura: tu rol no puede modificarlo."
                }
              >
                <InputNumber {...currencyInputProps} placeholder="$ 0" disabled={!editarCosto} />
              </Form.Item>
            </Col>
          )}
        </Row>

        {verCosto && (
          <>
            <Card size="small" style={{ background: token.colorFillQuaternary, marginBottom: 12 }}>
              <Flex vertical gap={8}>
                <Flex justify="space-between" gap={12}>
                  <Typography.Text type="secondary">Utilidad por unidad</Typography.Text>
                  <Typography.Text
                    strong
                    style={{
                      color:
                        margin.utility === null
                          ? undefined
                          : margin.utility < 0
                            ? token.colorError
                            : token.colorSuccess,
                    }}
                  >
                    {formatSignedCurrency(margin.utility)}
                  </Typography.Text>
                </Flex>
                <Flex justify="space-between" gap={12}>
                  <Typography.Text type="secondary">Margen sobre el precio</Typography.Text>
                  <Typography.Text strong>{formatPercent(margin.marginPct)}</Typography.Text>
                </Flex>
                <Flex justify="space-between" gap={12}>
                  <Typography.Text type="secondary">Markup sobre el costo</Typography.Text>
                  <Typography.Text strong>{formatPercent(margin.markupPct)}</Typography.Text>
                </Flex>
                {margin.marginPct !== null && (
                  <Progress
                    percent={Math.max(0, Math.min(100, margin.marginPct))}
                    showInfo={false}
                    size="small"
                    status={margin.marginPct < 0 ? "exception" : "normal"}
                    strokeColor={margin.marginPct < 20 ? token.colorWarning : token.colorSuccess}
                    aria-label={marginLabel(margin.level)}
                  />
                )}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {marginLabel(margin.level)}
                </Typography.Text>
              </Flex>
            </Card>

            {margin.marginPct !== null && margin.marginPct < 0 && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message="El precio está por debajo del costo"
                description="Cada venta generaría pérdida. Revisa el precio o el costo antes de guardar."
              />
            )}
            {margin.marginPct !== null && margin.marginPct >= 0 && margin.marginPct < 10 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Margen muy ajustado"
                description="Con menos de 10 % de margen, cualquier descuento o costo adicional puede volver la venta no rentable."
              />
            )}

            <Card size="small" title="Calcular el precio" style={{ marginBottom: 12 }}>
              <Flex vertical gap={10}>
                <Flex gap={8} wrap align="center">
                  <Segmented
                    size="small"
                    value={plannerMode}
                    onChange={(value) => setPlannerMode(value as PlannerMode)}
                    options={[
                      { label: "Margen %", value: "margen" },
                      { label: "Markup %", value: "markup" },
                    ]}
                  />
                  <InputNumber
                    size="small"
                    min={0}
                    max={plannerMode === "margen" ? 99 : 1_000}
                    step={1}
                    precision={1}
                    value={plannerPct}
                    onChange={setPlannerPct}
                    addonAfter="%"
                    style={{ width: 120 }}
                    aria-label="Porcentaje para calcular el precio"
                  />
                  <Button size="small" onClick={applySuggestedPrice} disabled={!canSuggest}>
                    {canSuggest ? `Usar ${formatCurrency(suggestedPrice)}` : "Sin precio"}
                  </Button>
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {plannerMode === "margen"
                    ? "Margen % se calcula sobre el precio de venta: precio = costo / (1 − margen)."
                    : "Markup % se calcula sobre el costo: precio = costo × (1 + markup)."}
                  {(!costo || costo <= 0) && " Registra un costo mayor que cero para usarlo."}
                </Typography.Text>
              </Flex>
            </Card>
          </>
        )}

        <Form.Item
          label="Stock mínimo"
          name="stock_minimo"
          tooltip="Umbral para marcar el producto con stock bajo."
          rules={[
            { required: true, message: "Ingresa el stock mínimo" },
            {
              type: "integer",
              min: 0,
              max: MAX_STOCK,
              message: "Debe ser un entero entre 0 y 1.000.000",
            },
          ]}
          extra="El stock actual solo cambia registrando movimientos."
        >
          <InputNumber min={0} max={MAX_STOCK} precision={0} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
