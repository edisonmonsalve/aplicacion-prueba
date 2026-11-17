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
  /** Micro-label sobre el título: módulo, sección o contexto. */
  eyebrow?: ReactNode;
  style?: CSSProperties;
}

/**
 * Cabecera común de página: mismo orden, jerarquía y aire en todos los módulos.
 *
 * Signal añade un micro-label opcional y una barra de señal a la izquierda;
 * el título usa Space Grotesk para distinguirse del contenido.
 */
export default function PageHeader({ title, description, extra, titleExtra, eyebrow, style }: Props) {
  return (
    <Flex
      className="ui-page-header"
      justify="space-between"
      align="flex-start"
      gap={16}
      wrap
      style={{ marginBottom: 20, ...style }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <span className="ui-eyebrow" style={{ marginBottom: 4 }}>
            {eyebrow}
          </span>
        )}
        <Flex gap={8} align="center" wrap>
          <Typography.Title level={3} className="ui-page-title" style={{ margin: 0 }}>
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
