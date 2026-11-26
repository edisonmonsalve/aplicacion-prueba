import "dotenv/config";
import { migrationStatus } from "../db/migrator.js";

try {
  const rows = await migrationStatus();
  const pending = rows.filter((row) => !row.applied);
  const modified = rows.filter((row) => row.modified);

  for (const row of rows) {
    const state = row.modified ? "MODIFICADA" : row.applied ? "aplicada" : "pendiente";
    console.log(`${state.padEnd(11)} V${String(row.version).padStart(3, "0")}  ${row.name}`);
  }

  console.log(
    `\n${rows.length - pending.length}/${rows.length} migraciones aplicadas · ${pending.length} pendientes`
  );

  if (modified.length > 0) {
    console.error(
      "\nHay migraciones aplicadas cuyo contenido cambió. Restaura el archivo original y crea una migración nueva."
    );
    process.exit(1);
  }
} catch (err) {
  console.error(
    `No se pudo leer el estado de las migraciones: ${err instanceof Error ? err.message : err}`
  );
  process.exit(1);
}
