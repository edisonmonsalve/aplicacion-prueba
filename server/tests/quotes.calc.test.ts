import { describe, expect, it } from "vitest";
import { calcLine, calcTotals } from "../src/modules/quotes/quotes.calc.js";

const line = (o: Partial<Parameters<typeof calcLine>[0]> = {}) => ({
  cantidad: 1,
  precioUnitario: 1000,
  descuentoPct: 0,
  impuestoPct: 0,
  ...o,
});

describe("Cálculo de presupuestos", () => {
  it("línea simple sin descuento ni impuesto", () => {
    expect(calcLine(line({ cantidad: 3 })).total).toBe(3000);
  });

  it("aplica el descuento sobre el valor bruto", () => {
    const r = calcLine(line({ cantidad: 2, precioUnitario: 1500, descuentoPct: 10 }));
    expect(r).toEqual({ bruto: 3000, descuento: 300, impuesto: 0, total: 2700 });
  });

  it("el impuesto se calcula sobre el valor ya descontado", () => {
    const r = calcLine(line({ descuentoPct: 10, impuestoPct: 19 }));
    expect(r).toEqual({ bruto: 1000, descuento: 100, impuesto: 171, total: 1071 });
  });

  it("evita el error de coma flotante", () => {
    expect(0.1 * 3).not.toBe(0.3); // el problema con decimales de JavaScript
    expect(calcLine(line({ cantidad: 3, precioUnitario: 0.1 })).total).toBe(0.3);
  });

  it("redondea la mitad hacia arriba", () => {
    // 5 centavos con 10 % de descuento: 0,5 centavos se redondea a 1
    const r = calcLine(line({ precioUnitario: 0.05, descuentoPct: 10 }));
    expect(r.descuento).toBe(0.01);
    expect(r.total).toBe(0.04);
  });

  it("un descuento del 100 % deja el total en cero", () => {
    const r = calcLine(line({ descuentoPct: 100, impuestoPct: 19 }));
    expect(r.total).toBe(0);
    expect(r.impuesto).toBe(0);
  });

  it("los totales son la suma exacta de las líneas", () => {
    const t = calcTotals([
      line({ cantidad: 2, precioUnitario: 1500, descuentoPct: 10 }),
      line({ descuentoPct: 10, impuestoPct: 19 }),
    ]);
    expect(t).toEqual({
      subtotal: 4000,
      descuentoTotal: 400,
      impuestoTotal: 171,
      total: 3771,
    });
    expect(t.total).toBe(t.subtotal - t.descuentoTotal + t.impuestoTotal);
  });
});