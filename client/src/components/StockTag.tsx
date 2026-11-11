import { Tag } from "antd";

interface Props {
  stockActual?: number;
  stockMinimo?: number;
  /** Cantidad de la línea. Si se omite (p. ej. en compras) no se evalúa faltante. */
  solicitado?: number;
}

/**
 * Indicador de stock de una línea de documento.
 *
 * - Rojo: la cantidad solicitada supera el stock disponible.
 * - Naranja: el producto está en o por debajo de su mínimo.
 * - Verde: hay stock suficiente.
 *
 * Se muestra siempre que el stock ya se conozca, para que la línea no quede
 * "a ciegas" aunque el select esté colapsado o se haya autocompletado.
 */
export default function StockTag({ stockActual, stockMinimo, solicitado }: Props) {
  if (stockActual === undefined) return null;

  if (solicitado !== undefined && solicitado > stockActual) {
    return (
      <Tag color="red">
        Stock insuficiente · disponible {stockActual}, solicitado {solicitado}
      </Tag>
    );
  }

  if (stockMinimo !== undefined && stockActual <= stockMinimo) {
    return (
      <Tag color="orange">
        Stock bajo · {stockActual} / mín. {stockMinimo}
      </Tag>
    );
  }

  return <Tag color="green">Stock disponible · {stockActual}</Tag>;
}
