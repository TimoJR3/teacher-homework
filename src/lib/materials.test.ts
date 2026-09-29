import { test } from "node:test";
import assert from "node:assert/strict";
import { fileSize, materialPath, materialProblem } from "./materials.ts";

test("materialPath: папка задания и латинское имя", () => {
  assert.equal(materialPath("a1", "image/jpeg", "f1"), "a1/f1.jpg");
  assert.equal(materialPath("a1", "application/pdf", "f2"), "a1/f2.pdf");
});

test("materialProblem: тип, размер, пустой файл", () => {
  assert.equal(materialProblem({ name: "p.jpg", size: 1000, type: "image/jpeg" }), null);
  assert.match(materialProblem({ name: "a.docx", size: 1000, type: "application/msword" }) ?? "", /PDF/);
  assert.match(materialProblem({ name: "big.pdf", size: 21 * 1024 * 1024, type: "application/pdf" }) ?? "", /20 МБ/);
  assert.match(materialProblem({ name: "e.png", size: 0, type: "image/png" }) ?? "", /пустой/);
});

test("fileSize: байты, килобайты, мегабайты", () => {
  assert.equal(fileSize(500), "500 Б");
  assert.equal(fileSize(2048), "2 КБ");
  assert.equal(fileSize(3.5 * 1024 * 1024), "3,5 МБ");
});
