const TZ = "Europe/Zagreb";

export function formatKickoff(d: Date): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Croatian plural for "sklek": 1 sklek, 2–4 skleka, 5+ sklekova. */
export function sklekova(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} sklek`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} skleka`;
  return `${n} sklekova`;
}
