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

const MOSCOW = "Europe/Moscow";
const DAY = 24 * 60 * 60 * 1000;

export function plural(n: number, one: string, few: string, many: string): string {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return one;
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
  return many;
}

// «вторник, 29 сентября» по московскому времени.
export function todayLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: MOSCOW }).format(now);
}

export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: MOSCOW }).format(now));
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

// Сколько осталось до срока, считая по календарным дням в Москве.
export function dueLabel(iso: string, now = new Date()): { text: string; late: boolean } {
  const day = (d: Date) => Date.parse(`${dueInputValue(d.toISOString())}T00:00:00Z`);
  const days = Math.round((day(new Date(iso)) - day(now)) / DAY);
  if (days < 0) return { text: "срок прошёл", late: true };
  if (days === 0) return { text: "сегодня", late: false };
  if (days === 1) return { text: "завтра", late: false };
  return { text: `через ${days} ${plural(days, "день", "дня", "дней")}`, late: false };
}

// Дата «YYYY-MM-DD» по московскому календарю.
export function moscowDay(d = new Date()): string {
  return dueInputValue(d.toISOString());
}

// Сдвиг даты «YYYY-MM-DD» на n дней.
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

// «пн», «вт»… для даты «YYYY-MM-DD».
export function weekdayShort(day: string): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}
