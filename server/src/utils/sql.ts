// Los nombres de columna vienen de nuestro código, nunca del usuario: es seguro.
// Los valores siempre viajan como parámetros (?).
export function buildSet(fields: Record<string, string | number | undefined>) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  return {
    sql: entries.map(([column]) => `${column} = ?`).join(", "),
    params: entries.map(([, value]) => value as string | number),
  };
}