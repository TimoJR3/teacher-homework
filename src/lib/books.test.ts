import { test } from "node:test";
import assert from "node:assert/strict";
import { bookPagePath, pagesLabel, parsePages } from "./books.ts";

test("parsePages: одиночные, диапазоны, повторы", () => {
  assert.deepEqual(parsePages("14-15, 18", 168), { pages: [14, 15, 18] });
  assert.deepEqual(parsePages("15 14 14", 168), { pages: [14, 15] });
  assert.deepEqual(parsePages("20–21", 168), { pages: [20, 21] });
});

test("parsePages: ошибки", () => {
  assert.ok("error" in parsePages("", 168));
  assert.ok("error" in parsePages("abc", 168));
  assert.ok("error" in parsePages("15-14", 168));
  assert.ok("error" in parsePages("0", 168));
  assert.match((parsePages("200", 168) as { error: string }).error, /168/);
  assert.ok("error" in parsePages("1-11", 168));
});

test("pagesLabel и путь страницы", () => {
  assert.equal(pagesLabel([15, 14, 18]), "с. 14–15, 18");
  assert.equal(pagesLabel([]), "");
  assert.equal(bookPagePath("ef-pre-sb", 14), "ef-pre-sb/14.jpg");
});

test("importPlan: сдвиг нумерации и предел книги", async () => {
  const { importPlan, newBookId } = await import("./books.ts");
  assert.deepEqual(importPlan(4, 1, 168), [
    { pdf: 2, page: 1 },
    { pdf: 3, page: 2 },
    { pdf: 4, page: 3 },
  ]);
  assert.deepEqual(importPlan(5, 0, 2), [
    { pdf: 1, page: 1 },
    { pdf: 2, page: 2 },
  ]);
  assert.match(newBookId(0), /^book-[a-z0-9]+$/);
});
