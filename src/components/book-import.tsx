"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOOKS_BUCKET, bookPagePath, importPlan, newBookId, type Book } from "@/lib/books";

// Ширина страницы в пикселях: читается на экране, файл остаётся небольшим.
const PAGE_WIDTH = 1400;
const NEW = "__new__";

type State =
  | { kind: "idle" }
  | { kind: "busy"; done: number; total: number; note: string }
  | { kind: "done"; uploaded: number; skipped: number; failed: number; reason: string }
  | { kind: "error"; message: string };

// Загрузка учебника: браузер сам режет PDF на страницы и кладёт их в закрытое хранилище.
export function BookImport({ books }: { books: Book[] }) {
  const router = useRouter();
  const [target, setTarget] = useState(books[0]?.id ?? NEW);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = state.kind === "busy";

  async function run() {
    if (!file) return;
    try {
      setState({ kind: "busy", done: 0, total: 0, note: "Открываю PDF…" });
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      const doc = await task.promise;
      const supabase = createClient();

      let book = books.find((b) => b.id === target) ?? null;
      if (!book) {
        const name = title.trim() || file.name.replace(/\.pdf$/i, "");
        const fresh = { id: newBookId(), title: name, pages: doc.numPages, contents_page: 1, pdf_offset: 0 };
        const { error } = await supabase.from("books").insert(fresh);
        if (error) throw new Error(`Учебник не создан: ${error.message}`);
        book = fresh;
      }

      const plan = importPlan(doc.numPages, book.pdf_offset, book.pages);
      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      let reason = "";
      for (const [i, step] of plan.entries()) {
        setState({ kind: "busy", done: i, total: plan.length, note: `Страница ${step.page} из ${book.pages}` });
        const page = await doc.getPage(step.pdf);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Браузер не умеет рисовать страницы. Попробуйте Chrome.");
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();
        const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.75));
        if (!blob) {
          failed++;
          continue;
        }
        const { error } = await supabase.storage
          .from(BOOKS_BUCKET)
          .upload(bookPagePath(book.id, step.page), blob, { contentType: "image/jpeg", upsert: false });
        // Уже загруженные страницы пропускаем: загрузку можно повторить, если она прервалась.
        if (!error) uploaded++;
        else if (/exists|duplicate/i.test(error.message)) skipped++;
        else {
          failed++;
          reason ||= error.message;
        }
      }
      await task.destroy();
      setState({ kind: "done", uploaded, skipped, failed, reason });
      router.refresh();
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="panel book-import">
      <h3>Загрузить учебник</h3>
      <p className="muted small">
        Выберите PDF учебника. Сайт сам разрежет его на страницы и загрузит их. Ученики увидят только те
        страницы, которые вы добавите в их задания. Не закрывайте вкладку, пока идёт загрузка.
      </p>
      <label>
        Куда загрузить
        <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} id="book-target">
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
          <option value={NEW}>Новый учебник</option>
        </select>
      </label>
      {target === NEW ? (
        <label>
          Название
          <input
            type="text"
            id="book-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="English File Pre-Intermediate. Workbook"
            disabled={busy}
          />
        </label>
      ) : null}
      <label>
        Файл PDF
        <input
          type="file"
          id="book-file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </label>
      <button className="btn primary" type="button" onClick={run} disabled={!file || busy}>
        {busy ? "Загружаю…" : "Загрузить"}
      </button>
      {state.kind === "busy" ? (
        <div className="import-progress" role="status">
          <progress value={state.done} max={state.total || 1} />
          <span className="small">{state.note}</span>
        </div>
      ) : null}
      {state.kind === "done" ? (
        <p className={state.failed ? "upload-error small" : "small"} role="status">
          Готово: загружено {state.uploaded}
          {state.skipped ? `, уже были ${state.skipped}` : ""}
          {state.failed
            ? `, не удалось ${state.failed} (${state.reason || "без ответа"}). Нажмите «Загрузить» ещё раз, готовые страницы пропустятся.`
            : "."}
        </p>
      ) : null}
      {state.kind === "error" ? <p className="upload-error small">{state.message}</p> : null}
    </div>
  );
}
