import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Checkbox,
  Col,
  Dropdown,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { MenuProps, TableProps } from "antd";
import { DownloadOutlined, MoreOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import ProductFormModal from "@/components/ProductFormModal";
import CategoriesPanel from "@/components/CategoriesPanel";
import RelativeTime from "@/components/RelativeTime";
import StatCard from "@/components/StatCard";
import FilterBar, { FilterField } from "@/components/FilterBar";
import { useAuth } from "@/context/AuthContext";
import { getCategories } from "@/services/categoriesService";
import { getProducts, setProductActivo, type ProductsQuery } from "@/services/productsService";
import { getErrorMessage } from "@/utils/errors";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "@/utils/format";
import { getMargin, marginColor, marginLabel } from "@/utils/margin";
import { canSeeCosts } from "@/utils/roles";
import { downloadCsv, fetchAllPages, type CsvColumn } from "@/utils/csv";
import type { Category, Product } from "@/types";
import { useNavigate } from "react-router-dom";
import TableSkeleton from "@/components/TableSkeleton";
import PageHeader from "@/components/PageHeader";
import MovementFormModal from "@/components/MovementFormModal";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const SORT_KEYS = ["sku", "nombre", "precio", "stock", "costo", "margen"] as const;
type SortKey = (typeof SORT_KEYS)[number];

// AntD entrega el `field` de la columna; el servidor usa nombres compactos.
const SORT_BY_FIELD: Record<string, SortKey> = {
  sku: "sku",
  nombre: "nombre",
  precio: "precio",
  stock_actual: "stock",
  costo: "costo",
  margen: "margen",
};

export default function ProductsPage() {
  const { user, canOperate } = useAuth();
  const isAdmin = user?.rol === "admin";
  const verCosto = canSeeCosts(user?.rol);
  const { message: messageApi, modal } = App.useApp();
  const navigate = useNavigate();
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const { get, getNumber, getPositiveInt, update } = useUrlFilters();
  const view = get("view") === "categorias" ? "categorias" : "productos";
  const q = get("q") ?? "";
  const categoryId = getNumber("category_id");
  const activo = (get("activo") as ProductsQuery["activo"]) ?? undefined;
  const bajoStock = get("bajoStock") === "1" ? "1" : undefined;
  const rawSort = get("sort");
  const sort = SORT_KEYS.includes(rawSort as SortKey) ? (rawSort as SortKey) : undefined;
  const rawOrder = get("order");
  // El costo y el margen solo se pueden ordenar si el rol puede verlos.
  const effectiveSort = (sort === "costo" || sort === "margen") && !verCosto ? undefined : sort;
  const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : undefined;
  const page = getPositiveInt("page", 1);
  const pageSize = getPositiveInt("pageSize", 10);
  const query = useMemo<ProductsQuery>(
    () => ({
      page,
      pageSize,
      q: q || undefined,
      category_id: categoryId,
      activo,
      bajoStock,
      sort: effectiveSort,
      order: effectiveSort ? order : undefined,
    }),
    [page, pageSize, q, categoryId, activo, bajoStock, effectiveSort, order]
  );
  const [searchText, setSearchText] = useState(q);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ unidades: 0, valor: 0, bajos: 0, margen: null as number | null });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useDocumentTitle("Productos");

  const sortOrderFor = (key: SortKey): "ascend" | "descend" | null =>
    effectiveSort === key ? (order === "desc" ? "descend" : "ascend") : null;

  // Si la URL cambia (atrás/adelante), el buscador refleja el texto activo.
  useEffect(() => {
    setSearchText(q);
  }, [q]);

  // Las categorías alimentan el filtro y el formulario; se recargan al crear,
  // editar o eliminar desde la pestaña de categorías.
  const reloadCategories = () => {
    getCategories()
      .then(setCategories)
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudieron cargar las categorías")));
  };
  useEffect(reloadCategories, [messageApi]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getProducts(query)
      .then((res) => {
        if (ignore) return;
        setProducts(res.data);
        setTotal(res.total);
        setSummary(res.summary);
      })
      .catch((err) => messageApi.error(getErrorMessage(err, "No se pudieron cargar los productos")))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [query, reloadKey, messageApi]);

  const updateFilters = (changes: Partial<ProductsQuery>) =>
    update({ ...changes, page: undefined });

  const hasFilters = Boolean(query.q || query.category_id || query.activo || query.bajoStock);

  const clearFilters = () => {
    setSearchText("");
    update({ q: undefined, category_id: undefined, activo: undefined, bajoStock: undefined, page: undefined });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages<Product>((p) =>
        getProducts({ ...query, page: p, pageSize: 100 })
      );
      const columns: CsvColumn<Product>[] = [
        { header: "SKU", value: (p) => p.sku },
        { header: "Nombre", value: (p) => p.nombre },
        { header: "Categoría", value: (p) => p.categoria },
        { header: "Precio", value: (p) => p.precio },
        ...(verCosto
          ? [
              { header: "Costo", value: (p: Product) => p.costo ?? "" },
              {
                header: "Utilidad unitaria",
                value: (p: Product) => getMargin(p.precio, p.costo).utility ?? "",
              },
              {
                header: "Margen %",
                value: (p: Product) => {
                  const m = getMargin(p.precio, p.costo).marginPct;
                  return m === null ? "" : m.toFixed(1);
                },
              },
            ]
          : []),
        { header: "Stock actual", value: (p) => p.stock_actual },
        { header: "Stock mínimo", value: (p) => p.stock_minimo },
        { header: "Valor del stock", value: (p) => p.precio * p.stock_actual },
        { header: "Estado", value: (p) => (p.activo ? "Activo" : "Inactivo") },
        { header: "Creado", value: (p) => dayjs(p.created_at).format("DD/MM/YYYY HH:mm") },
      ];
      downloadCsv(`productos-${dayjs().format("YYYY-MM-DD")}.csv`, columns, all);
      messageApi.success(`${all.length} producto(s) exportado(s)`);
    } catch (err) {
      messageApi.error(getErrorMessage(err, "No se pudo exportar"));
    } finally {
      setExporting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    messageApi.success(editing ? "Producto actualizado" : "Producto creado");
    if (!editing) update({ page: undefined });
    setReloadKey((k) => k + 1);
  };

  const toggleActivo = async (p: Product) => {
    try {
      await setProductActivo(p.id, !p.activo);
      messageApi.success(p.activo ? "Producto desactivado" : "Producto activado");
      setReloadKey((k) => k + 1);
    } catch (err) {
      messageApi.error(getErrorMessage(err));
    }
  };
  const handleMovementSaved = (newStock: number) => {
    setMovementProduct(null);
    messageApi.success(`Movimiento registrado. Nuevo stock: ${formatNumber(newStock)}`);
    setReloadKey((k) => k + 1);
  };

  const confirmToggle = (p: Product) => {
    modal.confirm({
      title: p.activo ? `¿Desactivar «${p.nombre}»?` : `¿Activar «${p.nombre}»?`,
      content: p.activo
        ? "Dejará de estar disponible para nuevas facturas y cotizaciones. El historial y los movimientos se conservan."
        : "Volverá a estar disponible para facturar y para registrar movimientos de stock.",
      okText: p.activo ? "Desactivar" : "Activar",
      cancelText: "Cancelar",
      okButtonProps: { danger: !!p.activo },
      onOk: () => toggleActivo(p),
    });
  };

  const rowMenu = (p: Product): MenuProps["items"] => [
    { key: "history", label: "Historial" },
    ...(canOperate ? [{ key: "edit", label: "Editar" }] : []),
    ...(isAdmin
      ? [
          { type: "divider" as const },
          { key: "toggle", danger: !!p.activo, label: p.activo ? "Desactivar" : "Activar" },
        ]
      : []),
  ];

  const handleRowAction = (key: string, p: Product) => {
    if (key === "history") navigate(`/movements?product_id=${p.id}`);
    else if (key === "edit") openEdit(p);
    else if (key === "toggle") confirmToggle(p);
  };

  const columns: TableProps<Product>["columns"] = [
    {
      title: "SKU",
      dataIndex: "sku",
      sorter: true,
      sortOrder: sortOrderFor("sku"),
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: "Nombre",
      dataIndex: "nombre",
      sorter: true,
      sortOrder: sortOrderFor("nombre"),
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: "Categoría",
      dataIndex: "categoria",
      responsive: ["md"],
      render: (value: string) => <Typography.Text type="secondary">{value}</Typography.Text>,
    },
    {
      title: "Precio",
      dataIndex: "precio",
      align: "right",
      sorter: true,
      sortOrder: sortOrderFor("precio"),
      render: (value: number) => <span className="num">{formatCurrency(value)}</span>,
    },
    ...(verCosto
      ? ([
          {
            title: <Tooltip title="Costo del producto (solo roles con permiso)">Costo</Tooltip>,
            dataIndex: "costo",
            align: "right",
            sorter: true,
            sortOrder: sortOrderFor("costo"),
            render: (value: number | null) =>
              value === null ? (
                <Typography.Text type="secondary">—</Typography.Text>
              ) : (
                <span className="num">{formatCurrency(value)}</span>
              ),
          },
          {
            title: (
              <Tooltip title="Margen sobre el precio = (precio − costo) / precio">
                Margen
              </Tooltip>
            ),
            dataIndex: "margen",
            align: "right",
            sorter: true,
            sortOrder: sortOrderFor("margen"),
            render: (_: unknown, p: Product) => {
              const m = getMargin(p.precio, p.costo);
              if (m.marginPct === null) {
                return <Typography.Text type="secondary">—</Typography.Text>;
              }
              return (
                <Tooltip
                  title={`${marginLabel(m.level)} · Utilidad ${formatCurrency(
                    m.utility
                  )} · Markup ${formatPercent(m.markupPct)}`}
                >
                  <Tag color={marginColor(m.level)} style={{ marginInlineEnd: 0 }}>
                    {formatPercent(m.marginPct)}
                  </Tag>
                </Tooltip>
              );
            },
          },
        ] as NonNullable<TableProps<Product>["columns"]>)
      : []),
    {
      title: <Tooltip title="Stock actual del producto">Stock</Tooltip>,
      dataIndex: "stock_actual",
      align: "right",
      sorter: true,
      sortOrder: sortOrderFor("stock"),
      render: (stock: number, p) =>
        // RF-11: alerta visual de stock por debajo del mínimo
        stock < p.stock_minimo ? (
          <Tooltip title={`Por debajo del mínimo (${formatNumber(p.stock_minimo)})`}>
            <Tag color="red" style={{ marginInlineEnd: 0 }}>
              {formatNumber(stock)} · Bajo
            </Tag>
          </Tooltip>
        ) : (
          <span className="num">{formatNumber(stock)}</span>
        ),
    },
    {
      title: <Tooltip title="Stock mínimo para generar alerta">Mínimo</Tooltip>,
      dataIndex: "stock_minimo",
      align: "right",
      responsive: ["md"],
      render: (value: number) => <span className="num">{formatNumber(value)}</span>,
    },
    {
      title: "Estado",
      dataIndex: "activo",
      render: (activo: number) =>
        activo ? <Tag color="green">Activo</Tag> : <Tag color="red">Inactivo</Tag>,
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      responsive: ["lg"],
      render: (value: string) => <RelativeTime value={value} />,
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 140,
      fixed: "right" as const,
      render: (_, p) => (
        <Space size={4}>
          {canOperate && (
            <Tooltip title="Registrar una entrada o salida de stock">
              <Button size="small" type="primary" disabled={!p.activo} onClick={() => setMovementProduct(p)}>
                Movimiento
              </Button>
            </Tooltip>
          )}
          <Dropdown
            trigger={["click"]}
            menu={{ items: rowMenu(p), onClick: ({ key }) => handleRowAction(key, p) }}
          >
            <Button size="small" icon={<MoreOutlined />} aria-label={`Más acciones de ${p.nombre}`} title="Más acciones" />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const firstLoad = loading && products.length === 0;

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Gestiona el catálogo, precios, costos y stock."
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportCsv}>
              Exportar CSV
            </Button>
            {canOperate && (
              <Button type="primary" onClick={openCreate}>
                Nuevo producto
              </Button>
            )}
          </Space>
        }
      />

      <Tabs
        activeKey={view}
        onChange={(key) => update({ view: key === "categorias" ? "categorias" : undefined })}
        items={[
          {
            key: "productos",
            label: "Productos",
            children: (
              <div>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={12} md={6}>
                    <StatCard
                      label="Productos"
            value={formatNumber(total)}
            hint={hasFilters ? "con los filtros actuales" : "en el catálogo"}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="Unidades en stock"
            value={formatNumber(summary.unidades)}
            hint="suma del filtro actual"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="Valor del stock"
            value={formatCurrencyCompact(summary.valor)}
            hint={
              verCosto && summary.margen !== null
                ? `${formatCurrency(summary.valor)} · margen ${formatPercent(summary.margen)}`
                : formatCurrency(summary.valor)
            }
            tone="primary"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="Stock bajo"
            value={formatNumber(summary.bajos)}
            hint={summary.bajos > 0 ? "productos bajo el mínimo" : "todo en orden"}
            tone={summary.bajos > 0 ? "danger" : "success"}
            onClick={() => updateFilters({ bajoStock: bajoStock ? undefined : "1" })}
          />
        </Col>
      </Row>

      <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
        <FilterField label="Buscar" width={280}>
          <Input.Search
            placeholder="Nombre o SKU"
            allowClear
            aria-label="Buscar productos"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => updateFilters({ q: value || undefined })}
            style={{ width: "100%" }}
          />
        </FilterField>
        <FilterField label="Categoría" width={180}>
          <Select
            placeholder="Todas"
            allowClear
            style={{ width: "100%" }}
            value={query.category_id}
            options={categories.map((c) => ({ value: c.id, label: c.nombre }))}
            onChange={(category_id) => updateFilters({ category_id })}
          />
        </FilterField>
        <FilterField label="Estado" width={140}>
          <Select
            placeholder="Todos"
            allowClear
            style={{ width: "100%" }}
            value={query.activo}
            options={[
              { value: "1", label: "Activos" },
              { value: "0", label: "Inactivos" },
            ]}
            onChange={(value) => updateFilters({ activo: value })}
          />
        </FilterField>
        <Checkbox
          style={{ paddingBottom: 7 }}
          checked={query.bajoStock === "1"}
          onChange={(e) => updateFilters({ bajoStock: e.target.checked ? "1" : undefined })}
        >
          Solo stock bajo
        </Checkbox>
      </FilterBar>

      {hasFilters && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          {q && (
            <Tag
              closable
              onClose={() => {
                setSearchText("");
                updateFilters({ q: undefined });
              }}
            >
              Buscar: {q}
            </Tag>
          )}
          {categoryId && (
            <Tag closable onClose={() => updateFilters({ category_id: undefined })}>
              Categoría: {categories.find((c) => c.id === categoryId)?.nombre ?? `#${categoryId}`}
            </Tag>
          )}
          {activo && (
            <Tag closable onClose={() => updateFilters({ activo: undefined })}>
              Estado: {activo === "1" ? "Activos" : "Inactivos"}
            </Tag>
          )}
          {bajoStock && (
            <Tag closable onClose={() => updateFilters({ bajoStock: undefined })}>
              Solo stock bajo
            </Tag>
          )}
          <Button type="link" size="small" onClick={clearFilters} style={{ paddingInline: 0 }}>
            Limpiar todo
          </Button>
        </div>
      )}

      {firstLoad ? (
        <TableSkeleton />
      ) : (
        <Table<Product>
          rowKey="id"
          columns={columns}
          dataSource={products}
          loading={loading}
          size="middle"
          sticky
          scroll={{ x: "max-content" }}
          rowClassName={(p) => (p.stock_actual < p.stock_minimo ? "row-low-stock" : "")}
          locale={{
            emptyText: (
              <Empty
                description={
                  hasFilters ? "No hay productos que coincidan con los filtros" : "Aún no hay productos"
                }
              >
                {hasFilters ? (
                  <Button onClick={clearFilters}>Limpiar filtros</Button>
                ) : (
                  canOperate && (
                    <Button type="primary" onClick={openCreate}>
                      Crear el primero
                    </Button>
                  )
                )}
              </Empty>
            ),
          }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `${formatNumber(count)} producto(s)`,
          }}
          onChange={(pagination, _filters, sorter, extra) => {
            if (extra.action === "sort") {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              const nextSort = s?.order ? SORT_BY_FIELD[String(s.field)] : undefined;
              // Al cambiar el orden se vuelve a la primera página.
              update({
                page: 1,
                pageSize: pagination.pageSize ?? query.pageSize,
                sort: nextSort,
                order: nextSort
                  ? s?.order === "descend"
                    ? "desc"
                    : "asc"
                  : undefined,
              });
              return;
            }
            // Paginar conserva el orden vigente.
            update({
              page: pagination.current ?? 1,
              pageSize: pagination.pageSize ?? query.pageSize,
            });
          }}
        />
      )}

      {!firstLoad && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <Typography.Text type="secondary">
            {formatNumber(total)} producto(s) con los filtros actuales
          </Typography.Text>
          <Typography.Text type="secondary">
            Stock total: <strong>{formatNumber(summary.unidades)}</strong> unidades · Valor del stock:{" "}
            <strong>{formatCurrency(summary.valor)}</strong>
            {verCosto && summary.margen !== null && (
              <>
                {" "}
                · Margen del stock: <strong>{formatPercent(summary.margen)}</strong>
              </>
            )}
          </Typography.Text>
        </div>
      )}
              </div>
            ),
          },
          {
            key: "categorias",
            label: "Categorías",
            children: <CategoriesPanel onSaved={reloadCategories} />,
          },
        ]}
      />

      {modalOpen && (
        <ProductFormModal
          product={editing}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
      {movementProduct && (
        <MovementFormModal
          product={movementProduct}
          onClose={() => setMovementProduct(null)}
          onSaved={handleMovementSaved}
        />
      )}
    </div>
  );
}
