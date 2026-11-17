import { signal } from "@/styles/signal";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Divider, Form, Input, Row, Space, Typography, message } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useCompany } from "@/context/CompanyContext";
import { updateCompany } from "@/services/companyService";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getErrorMessage } from "@/utils/errors";
import type { CompanyPayload } from "@/services/companyService";
import type { CompanySettings } from "@/types";

const MAX_LENGTH = {
  nombre: 150,
  eslogan: 150,
  nit: 40,
  regimen: 60,
  direccion: 200,
  telefono: 40,
  celular: 40,
  email: 120,
  web: 120,
  logo_url: 500,
} as const;

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const { company, reload } = useCompany();
  const [form] = Form.useForm<CompanyPayload>();
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const isAdmin = user?.rol === "admin";

  useDocumentTitle("Empresa");

  useEffect(() => {
    form.setFieldsValue(company);
  }, [company, form]);

  const watched = Form.useWatch([], form) as Partial<CompanySettings> | undefined;
  const preview: CompanySettings = { ...company, ...watched };
  const logoUrl = preview.logo_url?.trim();

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const onFinish = async (values: CompanyPayload) => {
    const payload: CompanyPayload = {
      nombre: values.nombre.trim(),
      eslogan: values.eslogan?.trim() || null,
      nit: values.nit?.trim() || null,
      regimen: values.regimen?.trim() || null,
      direccion: values.direccion?.trim() || null,
      telefono: values.telefono?.trim() || null,
      celular: values.celular?.trim() || null,
      email: values.email?.trim() || null,
      web: values.web?.trim() || null,
      logo_url: values.logo_url?.trim() || null,
    };

    setSaving(true);
    try {
      await updateCompany(payload);
      await reload();
      messageApi.success("Datos de la empresa actualizados");
    } catch (err) {
      messageApi.error(getErrorMessage(err, "No se pudieron guardar los datos"));
    } finally {
      setSaving(false);
    }
  };

  const previewLines = [
    [preview.nit, preview.regimen].filter(Boolean).join(" · "),
    preview.direccion,
    [preview.telefono, preview.celular].filter(Boolean).join(" · "),
    [preview.email, preview.web].filter(Boolean).join(" · "),
  ].filter(Boolean);

  return (
    <div>
      {contextHolder}
      <PageHeader
        title="Empresa"
        description="Datos del emisor que aparecen en las cotizaciones y facturas impresas."
      />

      {!isAdmin && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Solo un administrador puede modificar estos datos"
          description="Puedes consultarlos, pero los cambios los guarda un administrador."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Datos del emisor">
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              disabled={!isAdmin}
              requiredMark={false}
            >
              <Form.Item
                name="nombre"
                label="Razón social"
                rules={[
                  { required: true, message: "Escribe la razón social" },
                  { min: 2, message: "Mínimo 2 caracteres" },
                ]}
              >
                <Input maxLength={MAX_LENGTH.nombre} showCount placeholder="Mi empresa S.A.S." />
              </Form.Item>

              <Form.Item name="eslogan" label="Eslogan o actividad">
                <Input maxLength={MAX_LENGTH.eslogan} showCount placeholder="Gestión de inventario y finanzas" />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="nit" label="NIT / Identificación">
                    <Input maxLength={MAX_LENGTH.nit} placeholder="NIT 900.000.000-0" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="regimen" label="Régimen tributario">
                    <Input maxLength={MAX_LENGTH.regimen} placeholder="Régimen común" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="direccion" label="Dirección">
                <Input maxLength={MAX_LENGTH.direccion} showCount placeholder="Calle 1 # 2-3, Ciudad" />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="telefono" label="Teléfono">
                    <Input maxLength={MAX_LENGTH.telefono} placeholder="+57 601 000 0000" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="celular" label="Celular">
                    <Input maxLength={MAX_LENGTH.celular} placeholder="+57 300 000 0000" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="Correo"
                    rules={[{ type: "email", message: "Correo electrónico no válido" }]}
                  >
                    <Input maxLength={MAX_LENGTH.email} placeholder="facturacion@miempresa.co" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="web" label="Sitio web">
                    <Input maxLength={MAX_LENGTH.web} placeholder="www.miempresa.co" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="logo_url"
                label="Logo (opcional)"
                extra="URL http(s) o ruta interna de una imagen. Si se deja vacío se usa la marca de la aplicación."
                rules={[
                  {
                    validator: (_rule, value: string | null | undefined) => {
                      if (!value || /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:image/")) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Usa una URL http(s) o una ruta interna"));
                    },
                  },
                ]}
              >
                <Input maxLength={MAX_LENGTH.logo_url} placeholder="https://miempresa.co/logo.png" />
              </Form.Item>

              <Divider style={{ margin: "8px 0 16px" }} />

              <Space wrap>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={!isAdmin}>
                  Guardar cambios
                </Button>
                <Button onClick={() => form.setFieldsValue(company)} disabled={saving}>
                  Descartar cambios
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="Vista previa en la impresión">
            <div
              style={{
                border: "1px solid rgba(0,0,0,.12)",
                borderRadius: 8,
                padding: 16,
                background: signal.onBrand,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {logoUrl && !logoError ? (
                  <img
                    src={logoUrl}
                    alt={`Logotipo de ${preview.nombre}`}
                    onError={() => setLogoError(true)}
                    style={{ width: 46, height: 46, objectFit: "contain", borderRadius: 6, flex: "0 0 auto" }}
                  />
                ) : (
                  <svg width={46} height={46} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: "0 0 auto" }}>
                    <circle cx="24" cy="24" r="23" fill={signal.brandStrong} />
                    <path d="M24 11.5 36 17.4v13.2L24 36.5l-12-5.9V17.4z" fill={signal.onBrand} />
                    <path
                      d="M12 17.4 24 23.3l12-5.9M24 23.3v13.2"
                      stroke={signal.brandStrong}
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                )}
                <div style={{ minWidth: 0 }}>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {preview.nombre || "Nombre de la empresa"}
                  </Typography.Text>
                  {preview.eslogan && (
                    <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: signal.brandStrong }}>
                      {preview.eslogan}
                    </div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 11.5, color: signal.muted, lineHeight: 1.5 }}>
                    {previewLines.length > 0 ? (
                      previewLines.map((line) => <div key={line}>{line}</div>)
                    ) : (
                      <div>Sin datos de contacto</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
              La cabecera de cotizaciones y facturas usa estos datos. Guarda los cambios para verlos en
              los documentos ya emitidos al volver a imprimirlos.
            </Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
