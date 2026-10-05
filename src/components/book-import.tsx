"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOOKS_BUCKET, bookPagePath, importPlan, newBookId, pagesInFolder, type Book } from "@/lib/books";
import { withRetry } from "@/lib/pool";

// Ширина страницы в пикселях: читается на экране, файл остаётся небольшим.
const PAGE_WIDTH = 1400;
// Сколько страниц отправляется одновременно. Пока одни уходят в сеть, браузер рисует следующие.
const PARALLEL_UPLOADS = 4;
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

      // Уже загруженные страницы не рисуем и не отправляем заново: повтор после обрыва докачивает только недостающие.
      const { data: files } = await supabase.storage.from(BOOKS_BUCKET).list(book.id, { limit: 1000 });
      const have = pagesInFolder((files ?? []).map((f) => f.name));
      const all = importPlan(doc.numPages, book.pdf_offset, book.pages);
      const plan = all.filter((s) => !have.has(s.page));
      const skipped = all.length - plan.length;
      let uploaded = 0;
      let failed = 0;
      let reason = "";
      const progress = () =>
        setState({
          kind: "busy",
          done: uploaded + failed,
          total: plan.length,
          note: `Загружено ${uploaded} из ${plan.length}`,
        });

      async function send(page: number, blob: Blob) {
        const { error } = await withRetry(() =>
          supabase.storage
            .from(BOOKS_BUCKET)
            .upload(bookPagePath(book!.id, page), blob, { contentType: "image/jpeg", upsert: false })
            .then((r) => {
              // Сетевой сбой повторяем, а «уже есть» — нет: страница на месте.
              if (r.error && !/exists|duplicate/i.test(r.error.message)) throw r.error;
              return r;
            }),
        ).catch((error: Error) => ({ error }));
        if (!error || /exists|duplicate/i.test(error.message)) uploaded++;
        else {
          failed++;
          reason ||= error.message;
        }
        progress();
      }

      progress();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Браузер не умеет рисовать страницы. Попробуйте Chrome.");
      const sending = new Set<Promise<void>>();
      for (const step of plan) {
        const page = await doc.getPage(step.pdf);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();
        const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.75));
        if (!blob) {
          failed++;
          progress();
          continue;
        }
        const job: Promise<void> = send(step.page, blob).finally(() => sending.delete(job));
        sending.add(job);
        if (sending.size >= PARALLEL_UPLOADS) await Promise.race(sending);
      }
      await Promise.all(sending);
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
