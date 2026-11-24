// Los nombres de columna vienen de nuestro código, nunca del usuario: es seguro.
// Los valores siempre viajan como parámetros (?).
export function buildSet(fields: Record<string, string | number | undefined>) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  return {
    sql: entries.map(([column]) => `${column} = ?`).join(", "),
    params: entries.map(([, value]) => value as string | number),
  };
}

/**
 * Escapa `%`, `_` y `\` para que un término buscado por `LIKE` se trate como
 * texto literal. Se usa junto con `LIKE ? ESCAPE '\\'`.
 */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}