// Страницы учебника: разбор ввода преподавателя и пути в хранилище.

export const BOOKS_BUCKET = "books";
export const MAX_PAGES_AT_ONCE = 10;

export type Book = { id: string; title: string; pages: number; contents_page: number };
export type AssignmentPage = { assignment_id: string; book_id: string; page: number };

export function bookPagePath(bookId: string, page: number): string {
  return `${bookId}/${page}.jpg`;
}

// «14-15, 18» → [14, 15, 18]. Возвращает ошибку текстом, если ввод не понят.
export function parsePages(input: string, max: number): { pages: number[] } | { error: string } {
  const pages = new Set<number>();
  const parts = input.split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return { error: "Укажите номера страниц, например 14-15." };
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:[-–—](\d+))?$/);
    if (!m) return { error: `Не понял «${part}». Пишите номера через запятую или дефис: 14-15, 18.` };
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from) return { error: `Неверный диапазон «${part}».` };
    if (to > max) return { error: `В учебнике всего ${max} страниц.` };
    if (to - from + 1 > MAX_PAGES_AT_ONCE) return { error: `За раз можно добавить не больше ${MAX_PAGES_AT_ONCE} страниц.` };
    for (let p = from; p <= to; p++) pages.add(p);
  }
  if (pages.size > MAX_PAGES_AT_ONCE) return { error: `За раз можно добавить не больше ${MAX_PAGES_AT_ONCE} страниц.` };
  return { pages: [...pages].sort((a, b) => a - b) };
}

// [14, 15, 18] → «с. 14–15, 18»
export function pagesLabel(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return parts.length ? `с. ${parts.join(", ")}` : "";
}
