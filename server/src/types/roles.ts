export const ROLES = ["admin", "contador", "operador", "consulta"] as const;
export type Rol = (typeof ROLES)[number];

export const canSeeCosts = (rol: Rol) => rol !== "operador";
