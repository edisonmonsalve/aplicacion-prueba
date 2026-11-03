// "en-CA" es el formato regional que escribe la fecha como AAAA-MM-DD, el mismo que usa MariaDB
export const today = () => new Date().toLocaleDateString("en-CA");

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`); // a mediodía: evita saltos por cambios de horario
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}