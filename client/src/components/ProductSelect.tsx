import type { CSSProperties } from "react";
import { Select } from "antd";
import { productOptionLabel, type ProductOption } from "@/utils/productLookup";

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
}

/** Select de producto con búsqueda remota por nombre o SKU. */
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
}: Props) {
  const ids = [...new Set([...resultIds, ...(value ? [value] : [])])];
  const options = ids
    .map((id) => products[id])
    .filter((p): p is ProductOption => Boolean(p))
    .map((p) => {
      const taken = takenIds?.has(p.id) ?? false;
      return {
        value: p.id,
        label: taken ? `${productOptionLabel(p)} · ya agregado` : productOptionLabel(p),
        disabled: taken,
      };
    });

  return (
    <Select
      showSearch
      filterOption={false}
      onSearch={onSearch}
      onChange={onChange}
      value={value}
      loading={loading}
      placeholder={placeholder}
      notFoundContent={loading ? "Buscando..." : "Sin resultados"}
      options={options}
      style={style}
      disabled={disabled}
    />
  );
}
