import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Popover, Tooltip } from "antd";
import { DeleteOutlined, StarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import {
  FMT_FECHA,
  descripcionRango,
  type PeriodoRango,
  type RangoFechas,
} from "@/hooks/useDateRange";

interface Favorito {
  id: string;
  label: string;
  desde: string;
  hasta: string;
}

interface Props {
  range: RangoFechas | null;
  periodo: PeriodoRango | null;
  onChange: (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void;
  size?: "small" | "middle" | "large";
}

const LIMITE = 8;

/** Preferencia local por usuario, igual que el tema o la densidad. */
function clave(userId?: number) {
  return `ui-period-favorites:${userId ?? "anon"}`;
}

function leer(key: string): Favorito[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Favorito =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Favorito).id === "string" &&
          typeof (item as Favorito).label === "string" &&
          typeof (item as Favorito).desde === "string" &&
          typeof (item as Favorito).hasta === "string"
      )
      .slice(0, LIMITE);
  } catch {
    return [];
  }
}

/**
 * Rangos favoritos del selector de periodo. Guarda las fechas exactas en
 * `localStorage` por usuario: sobreviven a la recarga y no dependen de una
 * cuenta en el servidor. Aplicar un favorito vuelve a un rango personalizado.
 */
export default function PeriodFavorites({ range, periodo, onChange, size = "middle" }: Props) {
  const { user } = useAuth();
  const { message } = App.useApp();
  const storeKey = useMemo(() => clave(user?.id), [user?.id]);
  const [favoritos, setFavoritos] = useState<Favorito[]>(() => leer(storeKey));
  const [open, setOpen] = useState(false);
  const claveActual = useRef(storeKey);

  // Al cambiar de usuario se relee su conjunto y se evita escribir el anterior
  // sobre la clave nueva. En el mismo usuario, cada cambio se persiste.
  useEffect(() => {
    if (claveActual.current !== storeKey) {
      claveActual.current = storeKey;
      setFavoritos(leer(storeKey));
      return;
    }
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(favoritos));
    } catch {
      /* sin acceso a localStorage: el favorito dura la sesión */
    }
  }, [storeKey, favoritos]);

  const guardar = () => {
    if (!range) return;
    const desde = range[0].format(FMT_FECHA);
    const hasta = range[1].format(FMT_FECHA);
    if (favoritos.some((f) => f.desde === desde && f.hasta === hasta)) {
      message.info("Ese rango ya está en favoritos");
      return;
    }
    const siguiente: Favorito = {
      id: `${desde}_${hasta}`,
      label: descripcionRango(periodo, range),
      desde,
      hasta,
    };
    setFavoritos([siguiente, ...favoritos].slice(0, LIMITE));
    message.success("Rango guardado en favoritos");
  };

  const aplicar = (favorito: Favorito) => {
    onChange([dayjs(favorito.desde), dayjs(favorito.hasta)]);
    setOpen(false);
  };

  const quitar = (id: string) => {
    setFavoritos((prev) => prev.filter((f) => f.id !== id));
  };

  const contenido = (
    <div className="ui-favorites">
      {favoritos.length === 0 ? (
        <p className="ui-favorites__empty">
          Guarda el rango actual para volver a él con un clic. Se conserva en este navegador.
        </p>
      ) : (
        <ul className="ui-favorites__list">
          {favoritos.map((favorito) => (
            <li key={favorito.id} className="ui-favorites__row">
              <button
                type="button"
                className="ui-favorites__apply"
                onClick={() => aplicar(favorito)}
              >
                {favorito.label}
              </button>
              <Tooltip title="Quitar de favoritos">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`Quitar ${favorito.label} de favoritos`}
                  onClick={() => quitar(favorito.id)}
                />
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      <Button
        block
        size="small"
        icon={<StarOutlined />}
        onClick={guardar}
        disabled={!range}
      >
        Guardar rango actual
      </Button>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      title="Rangos favoritos"
      content={contenido}
    >
      <Tooltip title="Rangos favoritos">
        <Button size={size} icon={<StarOutlined />} aria-label="Rangos favoritos" />
      </Tooltip>
    </Popover>
  );
}
