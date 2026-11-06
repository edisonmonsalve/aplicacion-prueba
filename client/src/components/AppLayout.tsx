// import { Button, Layout, Menu, Space, Switch, Typography, message, theme } from "antd";
import { Avatar, Dropdown, Layout, Menu, Space, Switch, Typography, message, theme } from "antd";
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
  KeyOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useThemeMode } from "@/context/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { roleLabel } from "@/utils/roles";

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
    { key: "/cotizaciones", icon: <FileTextOutlined />, label: "Cotizaciones" },
    ...(user?.rol === "admin" ? [{ key: "/users", icon: <TeamOutlined />, label: "Usuarios" }] : []),
    { key: "/perfil", icon: <UserOutlined />, label: "Mi perfil" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        breakpoint="lg"
        collapsedWidth={0}
        style={{ position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", overflow: "auto" }}
      >
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
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Space size="middle">
            <Switch
              checked={mode === "dark"}
              onChange={toggle}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
            />
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "password",
                    icon: <KeyOutlined />,
                    label: "Cambiar contraseña",
                    onClick: () => setPasswordOpen(true),
                  },
                  { type: "divider" },
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: "Cerrar sesión",
                    danger: true,
                    onClick: signOut,
                  },
                ],
              }}
            >
              <Space style={{ cursor: "pointer" }}>
                <Avatar style={{ background: token.colorPrimary }}>{user?.nombre?.[0]?.toUpperCase()}</Avatar>
                <div style={{ lineHeight: 1.2 }}>
                  <div>{user?.nombre}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {user ? roleLabel(user.rol) : ""}
                  </Typography.Text>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: 24 }}>
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
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
