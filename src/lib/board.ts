// Доска для занятия: штрихи, координаты и проверка попадания ластиком.
// Координаты — в точках листа шириной BOARD_WIDTH, высота зависит от страницы.

export const BOARD_WIDTH = 1000;
// Чистый лист в клетку — пропорции А4.
export const BLANK_HEIGHT = 1414;
export const MAX_SHEET = 2000;
export const MAX_TEXT = 1000;
export const MAX_POINTS = 1500;

export type Tool = "pen" | "marker" | "text";
export type Point = [number, number];
// Что открыто на доске: страница учебника или чистый лист (bookId = null).
export type Sheet = { bookId: string | null; page: number };

export type Stroke = {
  id: string;
  board_id: string;
  book_id: string | null;
  page: number;
  author_id: string;
  tool: Tool;
  color: string;
  size: number;
  points: Point[];
  body: string;
  created_at?: string;
};

export type Board = {
  id: string;
  title: string;
  teacher_id: string;
  student_id: string;
  book_id: string | null;
  page: number;
  created_at: string;
  updated_at: string;
};

export const COLORS = [
  { value: "#c8342c", label: "Красная ручка" },
  { value: "#1f3a8a", label: "Синяя ручка" },
  { value: "#2f6b3a", label: "Зелёная ручка" },
  { value: "#2a2622", label: "Карандаш" },
] as const;
export const MARKER_COLORS = [
  { value: "#f5d90a", label: "Жёлтый маркер" },
  { value: "#7fd36b", label: "Зелёный маркер" },
  { value: "#f59ab0", label: "Розовый маркер" },
] as const;

export const TOOL_SIZE: Record<Tool, number> = { pen: 3.5, marker: 22, text: 26 };

export function sheetKey(s: { bookId?: string | null; book_id?: string | null; page: number }): string {
  const book = s.bookId !== undefined ? s.bookId : (s.book_id ?? null);
  return book ? `${book}/${s.page}` : `blank/${s.page}`;
}

export function sameSheet(a: Sheet, b: Sheet): boolean {
  return a.bookId === b.bookId && a.page === b.page;
}

// Точки ровнее и короче: соседние точки ближе minDist выбрасываются, координаты округляются до 0,1.
export function addPoint(points: Point[], p: Point, minDist = 1.5): Point[] {
  const q: Point = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  const last = points[points.length - 1];
  if (last && Math.hypot(last[0] - q[0], last[1] - q[1]) < minDist) return points;
  if (points.length >= MAX_POINTS) return points;
  return [...points, q];
}

// Плавная линия через середины отрезков (квадратичные кривые).
export function pathD(points: Point[]): string {
  if (!points.length) return "";
  const f = (n: number) => Math.round(n * 10) / 10;
  const [x0, y0] = points[0];
  if (points.length === 1) return `M${f(x0)} ${f(y0)}l0.1 0`;
  let d = `M${f(x0)} ${f(y0)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return d + `L${f(lx)} ${f(ly)}`;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Примерная рамка надписи: ширина символа около 0,55 высоты шрифта.
export function textBox(s: Pick<Stroke, "points" | "size" | "body">): { x: number; y: number; w: number; h: number } {
  const [x, y] = s.points[0] ?? [0, 0];
  return { x, y, w: Math.max(s.body.length, 1) * s.size * 0.55, h: s.size * 1.25 };
}

// Задевает ли ластик в точке p этот штрих.
export function hits(s: Pick<Stroke, "tool" | "points" | "size" | "body">, p: Point, radius = 8): boolean {
  if (s.tool === "text") {
    const b = textBox(s);
    return p[0] >= b.x - radius && p[0] <= b.x + b.w + radius && p[1] >= b.y - radius && p[1] <= b.y + b.h + radius;
  }
  const reach = s.size / 2 + radius;
  if (s.points.length === 1) return Math.hypot(p[0] - s.points[0][0], p[1] - s.points[0][1]) <= reach;
  for (let i = 1; i < s.points.length; i++) {
    if (distToSegment(p, s.points[i - 1], s.points[i]) <= reach) return true;
  }
  return false;
}

// Проверка штриха, пришедшего от другого участника: в рисунок не должно попасть ничего лишнего.
export function isStroke(v: unknown): v is Stroke {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.author_id === "string" &&
    (s.tool === "pen" || s.tool === "marker" || s.tool === "text") &&
    typeof s.color === "string" &&
    /^#[0-9a-f]{6}$/.test(s.color) &&
    typeof s.size === "number" &&
    s.size > 0 &&
    s.size <= 80 &&
    typeof s.page === "number" &&
    (s.book_id === null || typeof s.book_id === "string") &&
    typeof s.body === "string" &&
    s.body.length <= MAX_TEXT &&
    Array.isArray(s.points) &&
    s.points.length <= MAX_POINTS &&
    s.points.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n)))
  );
}

export function clampPage(page: number, max: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.round(page), 1), max);
}
