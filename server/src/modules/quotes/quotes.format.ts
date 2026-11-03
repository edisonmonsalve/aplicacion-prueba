export const formatQuoteNumber = (id: number) => `PRE-${String(id).padStart(6, "0")}`;

// Acepta "PRE-000123", "pre123" o "123"
export function parseQuoteNumber(text: string): number | null {
  const match = text.trim().match(/^(?:pre-?)?0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}