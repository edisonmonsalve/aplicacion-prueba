import type { CSSProperties, ReactNode } from "react";
import { Button } from "antd";

interface Props {
  children: ReactNode;
  /** Muestra el botón de limpieza cuando hay filtros activos. */
  hasFilters?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  style?: CSSProperties;
}

/** Barra de filtros compartida: mismo ritmo visual en todos los listados. */
export default function FilterBar({
  children,
  hasFilters,
  onClear,
  clearLabel = "Limpiar filtros",
  style,
}: Props) {
  return (
    <div className="ui-filterbar" style={style}>
      <div className="ui-filterbar__fields">{children}</div>
      {hasFilters && onClear && (
        <Button type="text" size="small" onClick={onClear}>
          {clearLabel}
        </Button>
      )}
    </div>
  );
}

/** Campo de filtro con micro-label y control alineado. */
export function FilterField({
  label,
  children,
  width,
}: {
  label: ReactNode;
  children: ReactNode;
  width?: number | string;
}) {
  return (
    <div className="ui-filterfield" style={{ width }}>
      <span className="ui-eyebrow ui-filterfield__label">{label}</span>
      {children}
    </div>
  );
}
