import { test } from "node:test";
import assert from "node:assert/strict";
import { addPoint, clampPage, hits, isStroke, pathD, sameSheet, sheetKey, type Point } from "./board.ts";

test("sheetKey различает страницы учебника и чистые листы", () => {
  assert.equal(sheetKey({ bookId: "ef-pre-sb", page: 14 }), "ef-pre-sb/14");
  assert.equal(sheetKey({ bookId: null, page: 2 }), "blank/2");
  assert.equal(sheetKey({ book_id: "ef-pre-sb", page: 3 }), "ef-pre-sb/3");
  assert.equal(sheetKey({ book_id: null, page: 3 }), "blank/3");
  assert.ok(sameSheet({ bookId: null, page: 1 }, { bookId: null, page: 1 }));
  assert.ok(!sameSheet({ bookId: "a", page: 1 }, { bookId: null, page: 1 }));
});

test("addPoint пропускает слишком близкие точки и округляет", () => {
  let pts: Point[] = [];
  pts = addPoint(pts, [10.123, 20.456]);
  pts = addPoint(pts, [10.5, 20.5]);
  pts = addPoint(pts, [15, 20]);
  assert.deepEqual(pts, [
    [10.1, 20.5],
    [15, 20],
  ]);
});

test("pathD строит линию из одной и нескольких точек", () => {
  assert.equal(pathD([]), "");
  assert.equal(pathD([[1, 2]]), "M1 2l0.1 0");
  assert.equal(pathD([[0, 0], [10, 0]]), "M0 0L10 0");
  assert.equal(pathD([[0, 0], [10, 0], [10, 10]]), "M0 0Q10 0 10 5L10 10");
});

test("ластик задевает линию рядом и не задевает далёкую", () => {
  const line = { tool: "pen" as const, size: 4, body: "", points: [[0, 0], [100, 0]] as Point[] };
  assert.ok(hits(line, [50, 6]));
  assert.ok(!hits(line, [50, 30]));
  const text = { tool: "text" as const, size: 20, body: "went", points: [[100, 100]] as Point[] };
  assert.ok(hits(text, [120, 110]));
  assert.ok(!hits(text, [300, 110]));
});

test("isStroke отсекает испорченные данные", () => {
  const ok = { id: "a", author_id: "b", tool: "pen", color: "#c8342c", size: 4, page: 1, book_id: null, body: "", points: [[1, 2]] };
  assert.ok(isStroke(ok));
  assert.ok(!isStroke({ ...ok, color: "red" }));
  assert.ok(!isStroke({ ...ok, tool: "image" }));
  assert.ok(!isStroke({ ...ok, points: [["1", 2]] }));
  assert.ok(!isStroke({ ...ok, size: 500 }));
  assert.ok(!isStroke(null));
});

test("clampPage держит номер в границах", () => {
  assert.equal(clampPage(0, 10), 1);
  assert.equal(clampPage(11, 10), 10);
  assert.equal(clampPage(NaN, 10), 1);
  assert.equal(clampPage(4.6, 10), 5);
});
