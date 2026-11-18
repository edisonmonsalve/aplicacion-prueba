import type { CSSProperties, ReactNode } from "react";
import dayjs from "dayjs";
import { Button, DatePicker, Segmented, Space, Tooltip, Typography } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type {
  PeriodoCalendario,
  PeriodoRango,
  RangoFechas,
} from "@/hooks/useDateRange";
import { PERIODOS, descripcionRango } from "@/hooks/useDateRange";

const { RangePicker } = DatePicker;

/** Opciones del atajo. «Todo» solo aparece cuando el listado permite limpiar. */
const PERIODOS_CON_TODO = [
  { label: "Todo", value: "todo" as const },
  ...PERIODOS,
];

/** Valor del `Segmented`. «personalizado» no existe como opción: sirve para
 *  dejar el control sin atajo activo cuando el rango lo eligió el usuario. */
type PeriodoSeleccion = PeriodoCalendario | "todo" | "personalizado";

interface Props {
  range: RangoFechas | null;
  periodo: PeriodoRango | null;
  onChange: (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void;
  onSelectPeriodo: (periodo: PeriodoCalendario) => void;
  onShift: (direction: -1 | 1) => void;
  enPeriodoActual?: boolean;
  /** Muestra el botón para limpiar el rango (listados). */
  allowClear?: boolean;
  /** Oculta la línea con el periodo activo. */
  showLabel?: boolean;
  /** Contenido a la derecha de la etiqueta (por ejemplo enlaces a reportes). */
  footer?: ReactNode;
  /** Controles extra junto al selector. */
  extra?: ReactNode;
  size?: "small" | "middle" | "large";
  style?: CSSProperties;
}

/**
 * Selector común de periodo: atajos día/semana/mes/año, navegación
 * anterior/actual/siguiente y rango personalizado.
 *
 * No guarda estado: la página lo obtiene de `useDateRange`, que sincroniza la
 * selección con la URL.
 */
export default function PeriodRangePicker({
  range,
  periodo,
  onChange,
  onSelectPeriodo,
  onShift,
  enPeriodoActual = false,
  allowClear = false,
  showLabel = true,
  footer,
  extra,
  size = "middle",
  style,
}: Props) {
  const preset = periodo && periodo !== "personalizado" ? periodo : null;
  // Siempre controlado: sin rango y con limpieza disponible, «Todo»; con un
  // rango personalizado, ningún atajo. Antes, al quedar sin `value`, AntD
  // marcaba «Día» por defecto y el clic no disparaba cambio.
  const segmentValue: PeriodoSeleccion =
    preset ?? (allowClear && !range ? "todo" : "personalizado");

  const handleSegment = (next: PeriodoSeleccion) => {
    if (next === "todo") {
      onChange(null);
      return;
    }
    if (next !== "personalizado") onSelectPeriodo(next);
  };

  return (
    <Space direction="vertical" size={8} style={{ width: "100%", ...style }}>
      <Space wrap align="center">
        <Segmented<PeriodoSeleccion>
          size={size}
          options={allowClear ? PERIODOS_CON_TODO : PERIODOS}
          value={segmentValue}
          onChange={handleSegment}
        />
        {preset && (
          <Space.Compact size={size}>
            <Tooltip title="Periodo anterior">
              <Button
                icon={<LeftOutlined />}
                onClick={() => onShift(-1)}
                aria-label="Periodo anterior"
              />
            </Tooltip>
            <Button
              onClick={() => onSelectPeriodo(preset)}
              disabled={enPeriodoActual}
            >
              Actual
            </Button>
            <Tooltip title="Periodo siguiente">
              <Button
                icon={<RightOutlined />}
                onClick={() => onShift(1)}
                aria-label="Periodo siguiente"
              />
            </Tooltip>
          </Space.Compact>
        )}
        <RangePicker
          size={size}
          value={range}
          onChange={onChange}
          format="DD/MM/YYYY"
          allowClear={allowClear}
          placeholder={["Desde", "Hasta"]}
        />
        {extra}
      </Space>
      {showLabel && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {descripcionRango(periodo, range)}
          </Typography.Text>
          {footer}
        </div>
      )}
    </Space>
  );
}
