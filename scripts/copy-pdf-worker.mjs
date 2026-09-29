// Кладёт обработчик PDF из pdfjs-dist в public/, чтобы браузер загрузил его с сайта.
// Файл копируется при каждой сборке, поэтому его версия всегда совпадает с библиотекой.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
