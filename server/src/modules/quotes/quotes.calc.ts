export interface LineInput {
  cantidad: number;
  precioUnitario: number;
  descuentoPct: number;
  impuestoPct: number;
}

const toCents = (value: number) => Math.round(value * 100);
const toBasisPoints = (pct: number) => Math.round(pct * 100); // 19 % -> 1900
const toMoney = (cents: number) => cents / 100;

interface Cents {
  bruto: number;
  descuento: number;
  impuesto: number;
  total: number;
}

// Redondeo: mitad hacia arriba, aplicado en cada línea
function lineCents(l: LineInput): Cents {
  const bruto = l.cantidad * toCents(l.precioUnitario);
  const descuento = Math.round((bruto * toBasisPoints(l.descuentoPct)) / 10000);
  const base = bruto - descuento;
  const impuesto = Math.round((base * toBasisPoints(l.impuestoPct)) / 10000);
  return { bruto, descuento, impuesto, total: base + impuesto };
}

export function calcLine(l: LineInput) {
  const c = lineCents(l);
  return {
    bruto: toMoney(c.bruto),
    descuento: toMoney(c.descuento),
    impuesto: toMoney(c.impuesto),
    total: toMoney(c.total),
  };
}

// Los totales suman centavos de cada línea: el total siempre es la suma exacta de las líneas
export function calcTotals(lines: LineInput[]) {
  const sum = lines.map(lineCents).reduce(
    (acc, c) => ({
      bruto: acc.bruto + c.bruto,
      descuento: acc.descuento + c.descuento,
      impuesto: acc.impuesto + c.impuesto,
      total: acc.total + c.total,
    }),
    { bruto: 0, descuento: 0, impuesto: 0, total: 0 }
  );

  return {
    subtotal: toMoney(sum.bruto),
    descuentoTotal: toMoney(sum.descuento),
    impuestoTotal: toMoney(sum.impuesto),
    total: toMoney(sum.total),
  };
}