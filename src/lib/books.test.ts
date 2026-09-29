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
