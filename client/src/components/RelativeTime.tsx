import { Tooltip } from "antd";
import { useNow } from "@/hooks/useNow";
import { formatDateDisplay, formatDateTime, formatRelativeTime } from "@/utils/dates";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface Props {
  value: string | Date | null | undefined;
  /** Muestra la fecha exacta al pasar el cursor. */
  tooltip?: boolean;
  /** Texto cuando no hay valor. */
  fallback?: string;
  className?: string;
  /** Para columnas DATE (`AAAA-MM-DD`): muestra `ayer`/`hace 2 días` en vez de `dd/mm/aaaa`. */
  dateOnlyRelative?: boolean;
}

/**
 * Fecha con tiempo relativo: `hace 30 segundos`, `hace 4 minutos`, `ayer`.
 *
 * El texto se actualiza solo cada 30 segundos y el tooltip conserva la fecha
 * exacta para cuando haga falta el dato preciso. Las fechas sin hora se
 * muestran como fecha absoluta salvo que se pida `dateOnlyRelative`.
 */
export default function RelativeTime({
  value,
  tooltip = true,
  fallback = "—",
  className,
  dateOnlyRelative = false,
}: Props) {
  const now = useNow();

  if (!value) return <span className={className}>{fallback}</span>;

  const absolute =
    typeof value === "string" && DATE_ONLY.test(value)
      ? formatDateDisplay(value)
      : formatDateTime(value);

  const text = formatRelativeTime(value, now, dateOnlyRelative) || fallback;

  if (!tooltip) return <span className={className}>{text}</span>;

  return (
    <Tooltip title={absolute}>
      <span className={className} style={{ cursor: "help" }}>
        {text}
      </span>
    </Tooltip>
  );
}
