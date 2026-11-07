import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert, Button, Form, Grid, Input, Switch, Tooltip, Typography, theme } from "antd";
import { InboxOutlined, LockOutlined, MailOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function LoginPage() {
  const { user, signIn } = useAuth();
  const { mode, toggle } = useThemeMode();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    sessionStorage.getItem("session-expired") ? "Tu sesión expiró. Inicia sesión de nuevo." : null
  );
  useDocumentTitle("Iniciar sesión");

  useEffect(() => {
    sessionStorage.removeItem("session-expired");
  }, []);

  if (user) return <Navigate to="/" replace />;

  const onFinish = async (values: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      await signIn(values.email, values.password); // al guardarse la sesión, el <Navigate> de arriba redirige
    } catch (err) {
      setError(
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "No se pudo iniciar sesión"
      );
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: screens.lg ? "1fr 1fr" : "1fr" }}>
      {screens.lg && (
        <div
          style={{
            background: "linear-gradient(135deg, #0f3d38 0%, #0d9488 100%)",
            color: "#fff",
            padding: 64,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Typography.Title level={3} style={{ color: "#fff", margin: 0 }}>
            <InboxOutlined /> Inventario
          </Typography.Title>
          <div>
            <Typography.Title style={{ color: "#fff", marginTop: 0 }}>
              Tu stock y tus presupuestos, en un solo lugar.
            </Typography.Title>
            <Typography.Paragraph style={{ color: "rgba(255,255,255,.8)", fontSize: 16 }}>
              Registra movimientos, controla el stock mínimo y genera presupuestos listos para imprimir.
            </Typography.Paragraph>
          </div>
          <Typography.Text style={{ color: "rgba(255,255,255,.6)" }}>
            © {new Date().getFullYear()} Inventario
          </Typography.Text>
        </div>
      )}

      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: token.colorBgContainer,
        }}
      >
        <div style={{ position: "absolute", top: 16, right: 16 }}>
          <Tooltip title="Cambiar entre tema claro y oscuro">
            <Switch
              checked={mode === "dark"}
              onChange={toggle}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              aria-label="Cambiar entre tema claro y oscuro"
            />
          </Tooltip>
        </div>

        <div style={{ width: "100%", maxWidth: 380 }}>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Bienvenido
          </Typography.Title>
          <Typography.Paragraph type="secondary">Ingresa con tu cuenta para continuar.</Typography.Paragraph>

          {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

          <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
            <Form.Item
              label="Correo"
              name="email"
              tooltip="Usa el correo con el que te dieron acceso al sistema."
              rules={[
                { required: true, message: "Ingresa tu correo" },
                { type: "email", message: "Correo no válido" },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                autoFocus
              />
            </Form.Item>
            <Form.Item
              label="Contraseña"
              name="password"
              tooltip="Si no la recuerdas, pide a un administrador que la restablezca."
              rules={[{ required: true, message: "Ingresa tu contraseña" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Entrar
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
