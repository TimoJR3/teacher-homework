const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Moscow",
});

export function formatDate(iso: string | null): string {
  if (!iso) return "без срока";
  return dateFmt.format(new Date(iso));
}

export function displayName(p: { full_name: string; email: string } | null | undefined): string {
  if (!p) return "Неизвестный ученик";
  return p.full_name.trim() || p.email;
}
