// Prefijo COT- para cotizaciones. Se acepta el histórico PRE- al buscar para
// no romper enlaces o búsquedas existentes.
export const formatQuoteNumber = (id: number) => `COT-${String(id).padStart(6, "0")}`;

// Acepta "COT-000123", "cot123", "PRE-000123", "pre123" o "123"
export function parseQuoteNumber(text: string): number | null {
  const match = text.trim().match(/^(?:(?:cot|pre)-?)?0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}