import { Button, Layout, Menu, Space, Switch, Typography, message, theme } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import {
  DashboardOutlined,
  ShoppingOutlined,
  SwapOutlined,
  TagsOutlined,
  FileTextOutlined,
  TeamOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { useThemeMode } from "@/context/ThemeContext";

const { Sider, Header, Content } = Layout;

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();
  const [passwordOpen, setPasswordOpen] = useState(false);

  // El menú se arma según el rol: el operador no ve "Usuarios"
  const { mode, toggle } = useThemeMode();
  const selected = "/" + (pathname.split("/")[1] ?? "");

  const items = [
    { key: "/", icon: <DashboardOutlined />, label: "Inicio" },
    { key: "/products", icon: <ShoppingOutlined />, label: "Productos" },
    { key: "/movements", icon: <SwapOutlined />, label: "Movimientos" },
    { key: "/categories", icon: <TagsOutlined />, label: "Categorías" },
    { key: "/presupuestos", icon: <FileTextOutlined />, label: "Presupuestos" },
    ...(user?.rol === "admin" ? [{ key: "/users", icon: <TeamOutlined />, label: "Usuarios" }] : []),
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ color: "#fff", padding: 16, fontWeight: 600 }}>Inventario</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            background: token.colorBgContainer,
            padding: "0 24px",
          }}
        >
          <Space>
            <Switch
              checked={mode === "dark"}
              onChange={toggle}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
            />
            <Typography.Text>
              {user?.nombre} ({user?.rol})
            </Typography.Text>
            <Button onClick={() => setPasswordOpen(true)}>Cambiar contraseña</Button>
            <Button onClick={signOut}>Cerrar sesión</Button>
          </Space>
        </Header>

        <Content style={{ margin: 24 }}>
          <Outlet />
          {contextHolder}
          {passwordOpen && (
            <ChangePasswordModal
              onClose={() => setPasswordOpen(false)}
              onSaved={() => {
                setPasswordOpen(false);
                messageApi.success("Contraseña actualizada");
              }}
            />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
