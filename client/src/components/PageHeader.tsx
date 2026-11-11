import type { CSSProperties, ReactNode } from "react";
import { Flex, Typography } from "antd";

interface Props {
  title: ReactNode;
  /** Texto corto de apoyo bajo el título. */
  description?: ReactNode;
  /** Acciones alineadas a la derecha (botones, selector de periodo…). */
  extra?: ReactNode;
  /** Contenido junto al título, por ejemplo una etiqueta de estado. */
  titleExtra?: ReactNode;
  style?: CSSProperties;
}

/**
 * Cabecera común de página: mismo orden, jerarquía y aire en todos los módulos.
 *
 * El espacio inferior deja respirar a los filtros y a la tabla que vienen
 * después; en pantallas pequeñas el bloque de acciones pasa a una línea nueva.
 */
export default function PageHeader({ title, description, extra, titleExtra, style }: Props) {
  return (
    <Flex
      justify="space-between"
      align="flex-start"
      gap={16}
      wrap
      style={{ marginBottom: 20, ...style }}
    >
      <div style={{ minWidth: 0 }}>
        <Flex gap={8} align="center" wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {titleExtra}
        </Flex>
        {description && (
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginTop: 4, maxWidth: 760 }}
          >
            {description}
          </Typography.Text>
        )}
      </div>
      {extra && <div>{extra}</div>}
    </Flex>
  );
}
