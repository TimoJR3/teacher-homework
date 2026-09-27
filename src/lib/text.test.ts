import { test } from "node:test";
import assert from "node:assert/strict";
import { countTopics, isValidRange, overlaps, segment, tokenize } from "./text.ts";

test("tokenize keeps positions and whitespace", () => {
  const body = "I have  been\nthere.";
  const tokens = tokenize(body);
  assert.equal(tokens.map((t) => t.text).join(""), body);
  const words = tokens.filter((t) => t.isWord);
  assert.deepEqual(
    words.map((w) => [w.text, w.start, w.end]),
    [
      ["I", 0, 1],
      ["have", 2, 6],
      ["been", 8, 12],
      ["there.", 13, 19],
    ],
  );
  for (const w of words) assert.equal(body.slice(w.start, w.end), w.text);
});

test("isValidRange rejects empty, whitespace-only and out-of-bounds ranges", () => {
  const body = "a b";
  assert.equal(isValidRange(body, { start: 0, end: 1 }), true);
  assert.equal(isValidRange(body, { start: 1, end: 1 }), false);
  assert.equal(isValidRange(body, { start: 1, end: 2 }), false);
  assert.equal(isValidRange(body, { start: 2, end: 4 }), false);
  assert.equal(isValidRange(body, { start: -1, end: 1 }), false);
});

test("overlaps treats touching ranges as separate", () => {
  assert.equal(overlaps({ start: 0, end: 3 }, { start: 3, end: 5 }), false);
  assert.equal(overlaps({ start: 0, end: 4 }, { start: 3, end: 5 }), true);
});

test("segment splits text around marks and keeps original mark index", () => {
  const body = "I have been to Spain";
  const marks = [
    { start: 15, end: 20, id: "b" },
    { start: 2, end: 11, id: "a" },
  ];
  const segs = segment(body, marks);
  assert.equal(segs.map((s) => s.text).join(""), body);
  const marked = segs.filter((s) => s.kind === "mark");
  assert.deepEqual(
    marked.map((s) => (s.kind === "mark" ? [s.text, s.index] : null)),
    [
      ["have been", 1],
      ["Spain", 0],
    ],
  );
});

test("segment skips overlapping and invalid marks", () => {
  const body = "one two three";
  const segs = segment(body, [
    { start: 0, end: 7 },
    { start: 4, end: 13 },
    { start: 20, end: 25 },
  ]);
  assert.equal(segs.map((s) => s.text).join(""), body);
  assert.equal(segs.filter((s) => s.kind === "mark").length, 1);
});

test("countTopics sorts by frequency", () => {
  const res = countTopics([{ topic_id: "a" }, { topic_id: "b" }, { topic_id: "b" }]);
  assert.deepEqual(res, [
    { topicId: "b", count: 2 },
    { topicId: "a", count: 1 },
  ]);
});
