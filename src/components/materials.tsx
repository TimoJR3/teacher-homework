import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteMaterial, removeBookPage } from "@/app/actions";
import { BOOKS_BUCKET, bookPagePath, pagesLabel, type AssignmentPage, type Book } from "@/lib/books";
import { fileSize, isImage, MATERIALS_BUCKET } from "@/lib/materials";
import type { Material } from "@/lib/types";

export type MaterialLink = Material & { url: string | null };
export type PageLink = AssignmentPage & { url: string | null };
export type BookPages = { book: Book; pages: PageLink[] };

const HOUR = 60 * 60;

async function signed(supabase: SupabaseClient, bucket: string, paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, HOUR);
  return new Map((data ?? []).filter((s) => s.signedUrl).map((s) => [s.path ?? "", s.signedUrl]));
}

// Файлы и страницы учебника к заданию со ссылками на час.
// Хранилища закрытые: ссылку получает только тот, кому видно задание.
export async function loadMaterials(supabase: SupabaseClient, assignmentId: string) {
  const [files, pageRows, bookRows] = await Promise.all([
    supabase.from("materials").select("*").eq("assignment_id", assignmentId).order("created_at"),
    supabase.from("assignment_pages").select("assignment_id, book_id, page").eq("assignment_id", assignmentId).order("page"),
    supabase.from("books").select("*").order("title"),
  ]);
  const rows = (files.data ?? []) as Material[];
  const pages = (pageRows.data ?? []) as AssignmentPage[];
  const books = (bookRows.data ?? []) as Book[];

  const [fileUrls, pageUrls] = await Promise.all([
    signed(supabase, MATERIALS_BUCKET, rows.map((m) => m.path)),
    signed(supabase, BOOKS_BUCKET, pages.map((p) => bookPagePath(p.book_id, p.page))),
  ]);

  const byBook: BookPages[] = books
    .map((book) => ({
      book,
      pages: pages
        .filter((p) => p.book_id === book.id)
        .map((p) => ({ ...p, url: pageUrls.get(bookPagePath(p.book_id, p.page)) ?? null })),
    }))
    .filter((b) => b.pages.length);

  return {
    items: rows.map((m) => ({ ...m, url: fileUrls.get(m.path) ?? null })),
    bookPages: byBook,
    books,
    failed: !!files.error || !!pageRows.error,
  };
}

export function Materials({
  textbook,
  items,
  bookPages,
  assignmentId,
  editable = false,
}: {
  textbook: string;
  items: MaterialLink[];
  bookPages: BookPages[];
  assignmentId: string;
  editable?: boolean;
}) {
  const images = items.filter((m) => isImage(m.mime));
  const files = items.filter((m) => !isImage(m.mime));
  return (
    <div className="materials">
      {textbook ? (
        <p className="textbook">
          <span className="muted small">Учебник</span>
          {textbook}
        </p>
      ) : null}
      {bookPages.map(({ book, pages }) => (
        <div key={book.id} className="stack" style={{ gap: 10 }}>
          {textbook ? null : (
            <p className="textbook">
              <span className="muted small">Учебник</span>
              {book.title}, {pagesLabel(pages.map((p) => p.page))}
            </p>
          )}
          <ul className="pages">
            {pages.map((p) => (
              <li key={p.page}>
                <Thumb url={p.url} alt={`${book.title}, страница ${p.page}`} />
                <div className="cap">
                  <span className="small">страница {p.page}</span>
                  {editable ? (
                    <form action={removeBookPage.bind(null, assignmentId, book.id, p.page)}>
                      <button type="submit" className="link-btn small">
                        убрать
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {images.length ? (
        <ul className="pages">
          {images.map((m) => (
            <li key={m.id}>
              <Thumb url={m.url} alt={m.name} />
              <div className="cap">
                <span className="small">{m.name}</span>
                {editable ? <RemoveFile assignmentId={assignmentId} id={m.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {files.length ? (
        <ul className="files">
          {files.map((m) => (
            <li key={m.id}>
              <span className="ext">PDF</span>
              {m.url ? (
                <a href={m.url} target="_blank" rel="noreferrer">
                  {m.name}
                </a>
              ) : (
                <span>{m.name}</span>
              )}
              <small className="muted">{fileSize(m.size)}</small>
              {editable ? <RemoveFile assignmentId={assignmentId} id={m.id} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <span className="muted small">файл недоступен</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Открыть целиком">
      {/* eslint-disable-next-line @next/next/no-img-element -- временная ссылка на закрытый файл */}
      <img src={url} alt={alt} loading="lazy" />
    </a>
  );
}

function RemoveFile({ assignmentId, id }: { assignmentId: string; id: string }) {
  return (
    <form action={deleteMaterial.bind(null, assignmentId, id)}>
      <button type="submit" className="link-btn small" title="Убрать файл из задания">
        убрать
      </button>
    </form>
  );
}

// Форма преподавателя: добавить страницы учебника по номерам или открыть учебник и листать.
export function BookPagesForm({
  books,
  assignmentId,
  action,
}: {
  books: Book[];
  assignmentId: string;
  action: (form: FormData) => Promise<void>;
}) {
  if (!books.length) return null;
  return (
    <form action={action} className="book-pick">
      <label>
        Учебник
        <select name="book_id" id={`book-${assignmentId}`} defaultValue={books[0].id}>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Страницы
        <input type="text" name="pages" id={`pages-${assignmentId}`} placeholder="14-15" required inputMode="numeric" />
      </label>
      <button className="btn" type="submit">
        Добавить страницы
      </button>
      <span className="small">
        или{" "}
        {books.map((b, i) => (
          <span key={b.id}>
            {i ? ", " : null}
            <Link href={`/teacher/books/${b.id}?p=${b.contents_page}&a=${assignmentId}`}>листать учебник</Link>
          </span>
        ))}{" "}
        и выбрать страницы
      </span>
    </form>
  );
}
