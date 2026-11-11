import { Avatar, Button, Dropdown, Layout, Menu, Space, Switch, Tooltip, Typography, message, theme } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import {
  DashboardOutlined,
  ShoppingOutlined,
  SwapOutlined,
  TagsOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  ContactsOutlined,
  TeamOutlined,
  DollarOutlined,
  MoonOutlined,
  SunOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useThemeMode } from "@/context/ThemeContext";
import { canAccessFinance } from "@/utils/roles";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteBreadcrumb from "@/components/RouteBreadcrumb";
import AppLogo from "@/components/AppLogo";
import { roleLabel } from "@/utils/roles";

const { Sider, Header, Content } = Layout;

// Módulo al que pertenece cada ruta. El orden importa: las rutas más
// específicas (Finanzas → Presupuestos) deben evaluarse antes que su prefijo.
const MODULE_ROUTES: Array<{ prefix: string; key: string }> = [
  { prefix: "/finanzas/transacciones", key: "/finanzas/transacciones" },
  { prefix: "/finanzas/presupuestos", key: "/finanzas/presupuestos" },
  { prefix: "/finanzas/cartera", key: "/finanzas/cartera" },
  { prefix: "/finanzas/cierres", key: "/finanzas/cierres" },
  { prefix: "/finanzas/resultados", key: "/finanzas/resultados" },
  { prefix: "/finanzas/flujo-caja", key: "/finanzas/flujo-caja" },
  { prefix: "/finanzas/balance", key: "/finanzas/balance" },
  { prefix: "/finanzas/rentabilidad", key: "/finanzas/rentabilidad" },
  { prefix: "/finanzas/inventario", key: "/finanzas/inventario" },
  { prefix: "/finanzas/embudo", key: "/finanzas/embudo" },
  { prefix: "/finanzas/tendencias", key: "/finanzas/tendencias" },
  { prefix: "/finanzas", key: "/finanzas" },
  { prefix: "/cotizaciones", key: "/cotizaciones" },
  { prefix: "/facturas", key: "/facturas" },
  { prefix: "/terceros", key: "/terceros" },
  { prefix: "/products", key: "/products" },
  { prefix: "/movements", key: "/movements" },
  { prefix: "/categories", key: "/categories" },
  { prefix: "/users", key: "/users" },
  { prefix: "/perfil", key: "/perfil" },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    pathname.startsWith("/finanzas") ? ["finanzas"] : []
  );

  // El menú se arma según el rol: el operador no ve "Usuarios"
  const { mode, toggle } = useThemeMode();
  const selected =
    MODULE_ROUTES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.key ??
    "/";

  // Al entrar en Finanzas desde otro módulo, el submenú se abre solo.
  useEffect(() => {
    if (!pathname.startsWith("/finanzas")) return;
    setOpenKeys((prev) => (prev.includes("finanzas") ? prev : [...prev, "finanzas"]));
  }, [pathname]);

  const items = [
    { key: "/", icon: <DashboardOutlined />, label: "Inicio" },
    { key: "/products", icon: <ShoppingOutlined />, label: "Productos" },
    { key: "/movements", icon: <SwapOutlined />, label: "Movimientos" },
    { key: "/categories", icon: <TagsOutlined />, label: "Categorías" },
    { key: "/cotizaciones", icon: <FileTextOutlined />, label: "Cotizaciones" },
    { key: "/facturas", icon: <FileDoneOutlined />, label: "Facturas" },
    { key: "/terceros", icon: <ContactsOutlined />, label: "Terceros" },
    ...(canAccessFinance(user?.rol)
      ? [
          {
            key: "finanzas",
            icon: <DollarOutlined />,
            label: "Finanzas",
            children: [
              { key: "/finanzas", label: "Resumen" },
              { key: "/finanzas/cartera", label: "Cartera" },
              { key: "/finanzas/cierres", label: "Cierres" },
              { key: "/finanzas/resultados", label: "Resultados" },
              { key: "/finanzas/flujo-caja", label: "Flujo de caja" },
              { key: "/finanzas/balance", label: "Balance" },
              { key: "/finanzas/rentabilidad", label: "Rentabilidad" },
              { key: "/finanzas/inventario", label: "Rotación" },
              { key: "/finanzas/embudo", label: "Embudo" },
              { key: "/finanzas/tendencias", label: "Tendencias" },
              { key: "/finanzas/presupuestos", label: "Presupuestos" },
              { key: "/finanzas/transacciones", label: "Transacciones" },
            ],
          },
        ]
      : []),
    ...(user?.rol === "admin" ? [{ key: "/users", icon: <TeamOutlined />, label: "Usuarios" }] : []),
    { key: "/perfil", icon: <UserOutlined />, label: "Mi perfil" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 19 }}
        />
      )}
      <Sider
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        collapsed={collapsed}
        onBreakpoint={(broken) => {
          setIsMobile(broken);
          setCollapsed(broken);
        }}
        trigger={null}
        style={{
          position: isMobile ? "fixed" : "sticky",
          top: 0,
          left: 0,
          alignSelf: "flex-start",
          height: "100vh",
          overflow: "auto",
          zIndex: isMobile ? 20 : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", minHeight: 64, padding: "0 16px", color: "#fff" }}>
          <AppLogo size={26} tone="light" showText={!collapsed} textSize={17} />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          items={items}
          aria-label="Navegación principal"
          onClick={({ key }) => {
            if (typeof key === "string" && key.startsWith("/")) {
              navigate(key);
              if (isMobile) setCollapsed(true);
            }
          }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: token.colorBgContainer,
            padding: isMobile ? "0 12px" : "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Tooltip title={collapsed ? "Mostrar el menú" : "Ocultar el menú"}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Mostrar u ocultar el menú"
            />
          </Tooltip>
          <Space size={isMobile ? "small" : "middle"}>
            <Tooltip title="Cambiar entre tema claro y oscuro">
              <Switch
                checked={mode === "dark"}
                onChange={toggle}
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
                aria-label="Cambiar entre tema claro y oscuro"
              />
            </Tooltip>
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
                {!isMobile && (
                  <div style={{ lineHeight: 1.2 }}>
                    <div>{user?.nombre}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {user ? roleLabel(user.rol) : ""}
                    </Typography.Text>
                  </div>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: isMobile ? 12 : 24, minWidth: 0 }}>
          <RouteBreadcrumb pathname={pathname} />
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
