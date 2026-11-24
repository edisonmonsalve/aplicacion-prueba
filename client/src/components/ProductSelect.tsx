import { useEffect, useState, type CSSProperties } from "react";
import { Select, Tag, Tooltip } from "antd";
import { StarFilled, StarOutlined, WarningOutlined } from "@ant-design/icons";
import { productOptionLabel, type ProductOption } from "@/utils/productLookup";
import { formatCurrency as money } from "@/utils/format";

const RECENTS_KEY = "signal-product-recents";
const FAVORITES_KEY = "signal-product-favorites";

function readIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: number[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(0, 8)));
  } catch {
    // El catálogo sigue funcionando aunque el navegador bloquee localStorage.
  }
}

interface Props {
  products: Record<number, ProductOption>;
  /** Ids devueltos por la última búsqueda; el selected se añade siempre. */
  resultIds: number[];
  value?: number;
  onChange?: (value?: number) => void;
  onSearch: (q: string) => void;
  loading?: boolean;
  /** Productos ya elegidos en otras líneas: se muestran deshabilitados. */
  takenIds?: Set<number>;
  placeholder?: string;
  style?: CSSProperties;
  disabled?: boolean;
  /** `borderless` lo integra en una tabla o documento editable. */
  variant?: "outlined" | "borderless";
}

/** Select de producto con búsqueda remota, recientes, favoritos y stock. */
export default function ProductSelect({
  products,
  resultIds,
  value,
  onChange,
  onSearch,
  loading,
  takenIds,
  placeholder = "Buscar por nombre o SKU",
  style,
  disabled,
  variant = "outlined",
}: Props) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<number[]>(() => readIds(RECENTS_KEY));
  const [favorites, setFavorites] = useState<number[]>(() => readIds(FAVORITES_KEY));

  useEffect(() => {
    if (!value) return;
    setRecents((prev) => {
      const next = [value, ...prev.filter((id) => id !== value)].slice(0, 8);
      saveIds(RECENTS_KEY, next);
      return next;
    });
  }, [value]);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 8);
      saveIds(FAVORITES_KEY, next);
      return next;
    });
  };

  // La opción desplegable muestra la ficha completa (favorito, precio y stock).
  // El valor elegido usa la etiqueta plana: en la fila y en la factura solo va
  // el nombre y el SKU, sin repetir precio ni existencias.
  const renderOption = (p: ProductOption) => {
    const taken = takenIds?.has(p.id) ?? false;
    return {
      value: p.id,
      disabled: taken,
      label: productOptionLabel(p),
    };
  };

  const renderOptionContent = (p: ProductOption) => {
    const taken = takenIds?.has(p.id) ?? false;
    const favorite = favorites.includes(p.id);
    const stock = p.stock_actual;
    const low = stock !== undefined && p.stock_minimo !== undefined && stock <= p.stock_minimo;
    return (
      <span className="ui-product-option">
        <Tooltip title={taken ? "Ya agregado en otra línea" : favorite ? "Quitar de favoritos" : "Marcar como favorito"}>
          <button
            type="button"
            className="ui-product-option__star"
            aria-label={favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            aria-pressed={favorite}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(p.id);
            }}
          >
            {favorite ? <StarFilled /> : <StarOutlined />}
          </button>
        </Tooltip>
        <span className="ui-product-option__name">
          {productOptionLabel(p)}
          {taken && (
            <Tag color="orange" icon={<WarningOutlined />} className="ui-product-option__taken">
              Ya agregado
            </Tag>
          )}
        </span>
        <span className="ui-product-option__meta num">
          {money(p.precio)}
          {stock !== undefined && (
            <small className={low ? "is-low" : undefined}> · {stock} und.</small>
          )}
        </span>
      </span>
    );
  };

  const searched = [...new Set([...resultIds, ...(value ? [value] : [])])]
    .map((id) => products[id])
    .filter((p): p is ProductOption => Boolean(p));

  const groups: Array<{ label: string; options: ReturnType<typeof renderOption>[] }> = [];
  // Un producto puede estar en favoritos, recientes y resultados: el selector
  // no debe mostrar la misma opción tres veces ni duplicar claves de React.
  const seen = new Set<number>();
  const addGroup = (label: string, ids: number[]) => {
    const options = [...new Set(ids)]
      .filter((id) => !seen.has(id))
      .map((id) => products[id])
      .filter((p): p is ProductOption => Boolean(p))
      .map((p) => {
        seen.add(p.id);
        return renderOption(p);
      });
    if (options.length > 0) groups.push({ label, options });
  };

  if (!query.trim()) {
    addGroup("Favoritos", favorites);
    addGroup("Recientes", recents);
    addGroup("Catálogo", resultIds);
  } else {
    addGroup("Resultados", searched.map((p) => p.id));
  }

  return (
    <Select
      showSearch
      filterOption={false}
      onSearch={(q) => {
        setQuery(q);
        onSearch(q);
      }}
      onChange={(pid) => onChange?.(pid)}
      value={value}
      loading={loading}
      placeholder={placeholder}
      notFoundContent={loading ? "Buscando..." : "Sin resultados"}
      options={groups}
      optionRender={(option) => {
        const product = products[Number(option.value)];
        return product ? renderOptionContent(product) : option.label;
      }}
      style={style}
      disabled={disabled}
      variant={variant}
    />
  );
}
