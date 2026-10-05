// Страницы учебника: разбор ввода преподавателя и пути в хранилище.

export const BOOKS_BUCKET = "books";
export const MAX_PAGES_AT_ONCE = 10;

export type Book = { id: string; title: string; pages: number; contents_page: number; pdf_offset: number };
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

// Какие страницы PDF загружать и под какими номерами: страница книги N = страница PDF N + offset.
export function importPlan(pdfPages: number, offset: number, bookPages: number): { pdf: number; page: number }[] {
  const plan: { pdf: number; page: number }[] = [];
  for (let pdf = offset + 1; pdf <= pdfPages; pdf++) {
    const page = pdf - offset;
    if (page > bookPages) break;
    plan.push({ pdf, page });
  }
  return plan;
}

export function newBookId(now = Date.now()): string {
  return `book-${now.toString(36)}`;
}

// Номера уже загруженных страниц по именам файлов в папке книги: «14.jpg» → 14.
export function pagesInFolder(names: string[]): Set<number> {
  const pages = new Set<number>();
  for (const name of names) {
    const m = name.match(/^(\d+)\.jpg$/);
    if (m) pages.add(Number(m[1]));
  }
  return pages;
}
