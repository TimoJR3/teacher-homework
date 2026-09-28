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

// Срок хранится как конец выбранного дня по московскому времени.
export function dueAtFromInput(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:00+03:00` : null;
}

// Обратное преобразование для <input type="date">.
export function dueInputValue(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date(iso));
}
