import { Button, Layout, Menu, Space, Typography, theme } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const { Sider, Header, Content } = Layout;

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { token } = theme.useToken();

  // El menú se arma según el rol: el operador no ve "Usuarios"
  const items = [
    { key: "/", label: "Inicio" },
    { key: "/products", label: "Productos" },
    { key: "/movements", label: "Movimientos" },
    { key: "/categories", label: "Categorías" },
    ...(user?.rol === "admin" ? [{ key: "/users", label: "Usuarios" }] : []),
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ color: "#fff", padding: 16, fontWeight: 600 }}>Inventario</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
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
            <Typography.Text>
              {user?.nombre} ({user?.rol})
            </Typography.Text>
            <Button onClick={signOut}>Cerrar sesión</Button>
          </Space>
        </Header>

        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}