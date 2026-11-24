import { Tooltip } from "antd";

export interface TotalRow {
  label: string;
  /** Importe ya formateado (incluye signo si es un descuento). */
  value: string;
  hint?: string;
}

interface Props {
  rows: TotalRow[];
  totalLabel: string;
  totalValue: string;
  totalHint?: string;
  net?: { label: string; value: string };
}

/** Resumen de importes compartido por cotización y factura. */
export default function DocumentTotals({ rows, totalLabel, totalValue, totalHint, net }: Props) {
  return (
    <div className="ui-doc-totals" role="group" aria-label="Resumen de totales">
      {rows.map((row) => (
        <div className="ui-doc-totals__row" key={row.label}>
          {row.hint ? (
            <Tooltip title={row.hint}>
              <span className="ui-doc-totals__hint" tabIndex={0} aria-label={`${row.label}: ${row.hint}`}>
                {row.label}
              </span>
            </Tooltip>
          ) : (
            <span>{row.label}</span>
          )}
          <span className="num">{row.value}</span>
        </div>
      ))}
      <div className="ui-doc-totals__final">
        {totalHint ? (
          <Tooltip title={totalHint}>
            <span className="ui-doc-totals__hint" tabIndex={0} aria-label={`${totalLabel}: ${totalHint}`}>
              {totalLabel}
            </span>
          </Tooltip>
        ) : (
          <span>{totalLabel}</span>
        )}
        <span className="num">{totalValue}</span>
      </div>
      {net && (
        <div className="ui-doc-totals__net">
          <span>{net.label}</span>
          <span className="num">{net.value}</span>
        </div>
      )}
    </div>
  );
}
