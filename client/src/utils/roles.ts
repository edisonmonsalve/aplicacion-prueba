import type { Rol } from "@/types";

export const ROLES: { value: Rol; label: string; color: string; desc: string }[] = [
  { value: "admin", label: "Admin", color: "blue", desc: "Gestiona usuarios y todo el sistema" },
  {
    value: "contador",
    label: "Contador",
    color: "purple",
    desc: "Ve todo y gestiona finanzas, presupuestos, reportes y cierres; no opera inventario ni cotizaciones",
  },
  {
    value: "operador",
    label: "Operador",
    color: "default",
    desc: "Registra movimientos de stock y cotizaciones",
  },
  { value: "consulta", label: "Consulta", color: "cyan", desc: "Solo lectura, con costos y márgenes" },
];

export const roleLabel = (r: Rol) => ROLES.find((x) => x.value === r)?.label ?? r;
export const roleColor = (r: Rol) => ROLES.find((x) => x.value === r)?.color ?? "default";

// El operador no ve costos ni márgenes; el resto de roles sí (solo lectura salvo admin)
export const canSeeCosts = (r: Rol | undefined) => !!r && r !== "operador";
export const canEditCosts = (r: Rol | undefined) => r === "admin";
