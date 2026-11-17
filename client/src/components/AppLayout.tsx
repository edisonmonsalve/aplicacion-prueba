import { signal } from "@/styles/signal";
import {
  Avatar,
  Button,
  Dropdown,
  Input,
  Layout,
  Menu,
  Space,
  Switch,
  Tooltip,
  Typography,
  message,
  theme,
  type MenuProps,
} from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef, useState } from "react";
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
  ShopOutlined,
  MoonOutlined,
  SunOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useThemeMode } from "@/context/ThemeContext";
import { CompanyProvider } from "@/context/CompanyContext";
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
  { prefix: "/finanzas/conciliaciones", key: "/finanzas/conciliaciones" },
  { prefix: "/finanzas/cierres", key: "/finanzas/cierres" },
  { prefix: "/finanzas/resultados", key: "/finanzas/resultados" },
  { prefix: "/finanzas/flujo-caja", key: "/finanzas/flujo-caja" },
  { prefix: "/finanzas/balance", key: "/finanzas/balance" },
  { prefix: "/finanzas/rentabilidad", key: "/finanzas/rentabilidad" },
  { prefix: "/finanzas/inventario", key: "/finanzas/inventario" },
  { prefix: "/finanzas/embudo", key: "/finanzas/embudo" },
  { prefix: "/finanzas/tendencias", key: "/finanzas/tendencias" },
  { prefix: "/finanzas/auditoria", key: "/finanzas/auditoria" },
  { prefix: "/finanzas/salud", key: "/finanzas/salud" },
  { prefix: "/finanzas", key: "/finanzas" },
  { prefix: "/cotizaciones", key: "/cotizaciones" },
  { prefix: "/facturas", key: "/facturas" },
  { prefix: "/terceros", key: "/terceros" },
  { prefix: "/products", key: "/products" },
  { prefix: "/movements", key: "/movements" },
  { prefix: "/categories", key: "/categories" },
  { prefix: "/users", key: "/users" },
  { prefix: "/perfil", key: "/perfil" },
  { prefix: "/empresa", key: "/empresa" },
];

const navLabel = (index: string, text: string) => (
  <span className="ui-nav-label">
    <span className="ui-nav-index">{index}</span> / {text}
  </span>
);

type NavItem = NonNullable<NonNullable<MenuProps["items"]>[number]>;

// Texto de búsqueda por clave. Incluye sinónimos ("stock", "facturación",
// "clientes"…) para que encontrar una sección no dependa de recordar su nombre
// exacto en el menú.
const NAV_SEARCH: Record<string, string> = {
  "group-01": "operación inicio productos movimientos categorías cotizaciones facturas terceros",
  "/": "inicio dashboard panel principal",
  "/products": "productos inventario stock bodega",
  "/movements": "movimientos entradas salidas inventario",
  "/categories": "categorías clasificación",
  "/cotizaciones": "cotizaciones propuestas venta",
  "/facturas": "facturas facturación comprobantes",
  "/terceros": "terceros clientes proveedores",
  "group-02": "finanzas análisis reportes gestión",
  "finanzas": "módulo financiero finanzas análisis reportes gestión",
  "fin-panel": "panel resumen salud datos",
  "fin-reportes": "reportes estados financieros análisis",
  "fin-gestion": "gestión operación financiera",
  "/finanzas": "resumen financiero finanzas dashboard",
  "/finanzas/cartera": "cartera por cobrar recaudación",
  "/finanzas/conciliaciones": "conciliación bancos cuentas",
  "/finanzas/cierres": "cierres periodos contables",
  "/finanzas/resultados": "resultados utilidades pérdidas estado",
  "/finanzas/flujo-caja": "flujo de caja efectivo liquidez",
  "/finanzas/balance": "balance activos pasivos patrimonio",
  "/finanzas/rentabilidad": "rentabilidad margen utilidad",
  "/finanzas/inventario": "rotación inventario stock productos",
  "/finanzas/embudo": "embudo conversiones ventas",
  "/finanzas/tendencias": "tendencias evolución gráficas",
  "/finanzas/auditoria": "auditoría trazabilidad eventos",
  "/finanzas/salud": "salud de datos calidad integridad",
  "/finanzas/presupuestos": "presupuestos metas planificación",
  "/finanzas/transacciones": "transacciones movimientos contables",
  "group-03": "sistema configuración usuarios perfil empresa",
  "/empresa": "empresa configuración compañía datos",
  "/users": "usuarios accesos permisos roles",
  "/perfil": "mi perfil cuenta contraseña",
};

// Sin tildes: "operacion" encuentra "Operación" y "auditoria" a "Auditoría".
const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

const filterNavItems = (nodes: NavItem[], term: string): NavItem[] => {
  const query = normalizeSearch(term.trim());
  if (!query) return nodes;

  return nodes.flatMap((node) => {
    const matches = normalizeSearch(NAV_SEARCH[String(node.key)] ?? "").includes(query);
    const children =
      "children" in node && node.children ? filterNavItems(node.children as NavItem[], query) : [];

    if (node.type === "group") {
      const groupChildren = matches ? ((node.children as NavItem[] | undefined) ?? []) : children;
      return groupChildren.length ? [{ ...node, children: groupChildren } as NavItem] : [];
    }
    if (matches) return [node];
    return children.length ? [{ ...node, children } as NavItem] : [];
  });
};

// Con el buscador activo, todas las ramas con resultados deben estar abiertas.
const collectBranchKeys = (nodes: NavItem[]): string[] =>
  nodes.flatMap((node) => {
    if (node.type === "group" || !("children" in node) || !node.children?.length) return [];
    return [String(node.key), ...collectBranchKeys(node.children as NavItem[])];
  });

const subItem = (key: string, label: string) => ({
  key,
  label: (
    <span className="ui-nav-subitem">
      <span className="ui-nav-pip" aria-hidden="true" />
      {label}
    </span>
  ),
});

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
  const [clock, setClock] = useState(() => new Date());
  const [navQuery, setNavQuery] = useState("");
  const siderScrollRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

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

  // Finanzas tiene 15 entradas: al navegar, deja el item activo a la vista
  // dentro del sider. No mueve el scroll de la página y no anima el salto.
  useEffect(() => {
    const container = siderScrollRef.current;
    if (!container || collapsed) return;
    const active = container.querySelector<HTMLElement>(".ant-menu-item-selected");
    if (!active) return;

    const box = container.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top >= box.top && item.bottom <= box.bottom) return;

    const top = item.top - box.top + container.scrollTop;
    container.scrollTop = Math.max(0, top - container.clientHeight / 2 + item.height / 2);
  }, [pathname, openKeys, collapsed]);

  // "/" enfoca el buscador del menú y Escape lo limpia, como en cualquier
  // paleta de comandos. No interrumpe la escritura en otros campos.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchBoxRef.current?.querySelector("input")?.focus();
      } else if (event.key === "Escape" && document.activeElement === searchBoxRef.current?.querySelector("input")) {
        setNavQuery("");
        searchBoxRef.current?.querySelector("input")?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // El reloj del header refuerza que el panel está vivo sin recargar nada.
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // El menú móvil se cierra también con Escape, además de al tocar el overlay.
  useEffect(() => {
    if (!isMobile || collapsed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCollapsed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile, collapsed]);

  const items: MenuProps["items"] = [
    {
      type: "group",
      key: "group-01",
      label: navLabel("01", "Operación"),
      children: [
        { key: "/", icon: <DashboardOutlined />, label: "Inicio" },
        { key: "/products", icon: <ShoppingOutlined />, label: "Productos" },
        { key: "/movements", icon: <SwapOutlined />, label: "Movimientos" },
        { key: "/categories", icon: <TagsOutlined />, label: "Categorías" },
        { key: "/cotizaciones", icon: <FileTextOutlined />, label: "Cotizaciones" },
        { key: "/facturas", icon: <FileDoneOutlined />, label: "Facturas" },
        { key: "/terceros", icon: <ContactsOutlined />, label: "Terceros" },
      ],
    },
    ...(canAccessFinance(user?.rol)
      ? [
          {
            type: "group" as const,
            key: "group-02",
            label: navLabel("02", "Finanzas"),
            children: [
              {
                key: "finanzas",
                icon: <DollarOutlined />,
                label: (
                  <span className="ui-nav-parent">
                    Módulo financiero <span className="ui-nav-count">15</span>
                  </span>
                ),
                children: [
                  {
                    type: "group" as const,
                    key: "fin-panel",
                    label: <span className="ui-nav-sublabel">Panel</span>,
                    children: [
                      subItem("/finanzas", "Resumen"),
                      subItem("/finanzas/salud", "Salud de datos"),
                    ],
                  },
                  {
                    type: "group" as const,
                    key: "fin-reportes",
                    label: <span className="ui-nav-sublabel">Reportes</span>,
                    children: [
                      subItem("/finanzas/resultados", "Resultados"),
                      subItem("/finanzas/balance", "Balance"),
                      subItem("/finanzas/flujo-caja", "Flujo de caja"),
                      subItem("/finanzas/rentabilidad", "Rentabilidad"),
                      subItem("/finanzas/tendencias", "Tendencias"),
                      subItem("/finanzas/embudo", "Embudo"),
                      subItem("/finanzas/inventario", "Rotación"),
                    ],
                  },
                  {
                    type: "group" as const,
                    key: "fin-gestion",
                    label: <span className="ui-nav-sublabel">Gestión</span>,
                    children: [
                      subItem("/finanzas/transacciones", "Transacciones"),
                      subItem("/finanzas/presupuestos", "Presupuestos"),
                      subItem("/finanzas/conciliaciones", "Conciliación"),
                      subItem("/finanzas/cierres", "Cierres"),
                      subItem("/finanzas/cartera", "Cartera"),
                      subItem("/finanzas/auditoria", "Auditoría"),
                    ],
                  },
                ],
              },
            ],
          },
        ]
      : []),
    {
      type: "group",
      key: "group-03",
      label: navLabel("03", "Sistema"),
      children: [
        ...(user?.rol === "admin"
          ? [
              { key: "/empresa", icon: <ShopOutlined />, label: "Empresa" },
              { key: "/users", icon: <TeamOutlined />, label: "Usuarios" },
            ]
          : []),
        { key: "/perfil", icon: <UserOutlined />, label: "Mi perfil" },
      ],
    },
  ];

  const filteredItems = filterNavItems((items ?? []) as NavItem[], navQuery);
  const effectiveOpenKeys = navQuery.trim() ? collectBranchKeys(filteredItems) : openKeys;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <a className="ui-skip-link" href="#main-content">
        Saltar al contenido
      </a>

      {isMobile && !collapsed && (
        <div
          role="presentation"
          aria-label="Cerrar menú de navegación"
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6, 14, 13, 0.62)",
            backdropFilter: "blur(2px)",
            zIndex: 19,
          }}
        />
      )}

      <Sider
        breakpoint="lg"
        width={228}
        collapsedWidth={isMobile ? 0 : 72}
        collapsed={collapsed}
        onBreakpoint={(broken) => {
          setIsMobile(broken);
          setCollapsed(broken);
        }}
        trigger={null}
        className="ui-grid-bg ui-app-sider"
        style={{
          position: isMobile ? "fixed" : "sticky",
          top: 0,
          left: 0,
          alignSelf: "flex-start",
          height: "100vh",
          overflow: "hidden",
          zIndex: isMobile ? 20 : undefined,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div className="ui-sider-scroll" ref={siderScrollRef}>
          <div
            className="ui-sider-brand"
            style={{ display: "flex", flexDirection: "column", minHeight: 60, padding: "12px 14px 8px" }}
          >
            <div style={{ color: signal.onBrand }}>
              <AppLogo size={26} tone="light" showText={!collapsed} textSize={17} />
            </div>
            {!collapsed && (
              <span className="ui-nav-label" style={{ marginTop: 6, paddingLeft: 2 }}>
                Control de operaciones
              </span>
            )}
          </div>
          {!collapsed && (
            <div className="ui-sider-search" ref={searchBoxRef}>
              <Input
                allowClear
                size="small"
                prefix={<SearchOutlined />}
                suffix={!navQuery ? <kbd className="ui-nav-kbd">/</kbd> : undefined}
                placeholder="Buscar en el menú"
                value={navQuery}
                onChange={(event) => setNavQuery(event.target.value)}
                aria-label="Buscar en la navegación"
              />
            </div>
          )}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selected]}
            openKeys={effectiveOpenKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            items={filteredItems}
            aria-label="Navegación principal"
            // Sin la animación de colapso de AntD el submenú no "crece" al abrirse.
            motion={{ motionName: "" }}
            inlineIndent={16}
            subMenuOpenDelay={0}
            subMenuCloseDelay={0}
            onClick={({ key }) => {
              if (typeof key === "string" && key.startsWith("/")) {
                setNavQuery("");
                navigate(key);
                if (isMobile) setCollapsed(true);
              }
            }}
          />
          {navQuery.trim() && filteredItems.length === 0 && (
            <p className="ui-nav-empty">Sin secciones para «{navQuery}»</p>
          )}
        </div>
        {!collapsed && (
          <div className="ui-sider-foot" aria-hidden="true">
            <span className="ui-nav-label">Signal · Control</span>
            <span className="ui-nav-index">OPS</span>
          </div>
        )}
      </Sider>

      <Layout>
        <Header
          className="ui-app-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: isMobile ? "0 12px" : "0 24px",
          }}
        >
          <Space size="middle">
            <Tooltip title={collapsed ? "Mostrar el menú" : "Ocultar el menú"}>
              <Button
                type="text"
                className="ui-nav-toggle"
                icon={<MenuOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                aria-label="Mostrar u ocultar el menú"
              />
            </Tooltip>
            {!isMobile && (
              <Tooltip title="Sistema operativo · hora local">
                <div className="ui-status">
                  <span className="ui-signal" aria-hidden="true" />
                  <span className="ui-status__text">
                    En vivo · {clock.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </Tooltip>
            )}
          </Space>

          <Space className="ui-header-actions" size={isMobile ? "small" : "middle"}>
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
                <Avatar className="ui-avatar" style={{ background: token.colorPrimary }}>
                  {user?.nombre?.[0]?.toUpperCase()}
                </Avatar>
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

        <Content
          id="main-content"
          tabIndex={-1}
          style={{ margin: isMobile ? 12 : 24, minWidth: 0, outline: "none" }}
        >
          <CompanyProvider>
            <RouteBreadcrumb pathname={pathname} />
            <ErrorBoundary key={pathname}>
              <div className="ui-page-enter" key={pathname}>
                <Outlet />
              </div>
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
          </CompanyProvider>
        </Content>
      </Layout>
    </Layout>
  );
}
