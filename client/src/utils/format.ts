// Ajusta "COP" y "es-CO" si tu proyecto usa otra moneda o formato
const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value: number) => currency.format(value);