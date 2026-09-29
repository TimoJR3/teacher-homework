import Link from "next/link";
import { notFound } from "next/navigation";
import { addBookPages } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { BOOKS_BUCKET, bookPagePath, type Book } from "@/lib/books";
import { ErrorBanner, Header } from "@/components/ui";

// Учебник для преподавателя: листать страницы и добавлять нужные в задание.
export default async function BookPage(props: PageProps<"/teacher/books/[id]">) {
  const { id } = await props.params;
  const { p, a, error } = await props.searchParams;
  const { profile, supabase } = await requireRole("teacher");

  const { data } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const book = data as Book;
  const page = Math.min(Math.max(Number(p) || book.contents_page, 1), book.pages);
  const assignmentId = typeof a === "string" ? a : null;

  const [{ data: signedUrl }, assignment, added] = await Promise.all([
    supabase.storage.from(BOOKS_BUCKET).createSignedUrl(bookPagePath(book.id, page), 60 * 60),
    assignmentId
      ? supabase.from("assignments").select("id, title").eq("id", assignmentId).maybeSingle()
      : Promise.resolve({ data: null }),
    assignmentId
      ? supabase.from("assignment_pages").select("page").eq("assignment_id", assignmentId).eq("book_id", book.id)
      : Promise.resolve({ data: [] }),
  ]);
  const task = assignment.data as { id: string; title: string } | null;
  const addedPages = new Set(((added.data ?? []) as { page: number }[]).map((r) => r.page));
  const here = (n: number) => `/teacher/books/${book.id}?p=${n}${task ? `&a=${task.id}` : ""}`;

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <main className="stack book-view">
        {task ? (
          <Link href={`/teacher/assignments/${task.id}`} className="small">
            ← К заданию «{task.title}»
          </Link>
        ) : (
          <Link href="/teacher" className="small">
            ← Все работы
          </Link>
        )}
        <div className="book-bar">
          <div>
            <p className="eyebrow">{book.title}</p>
            <h1>Страница {page}</h1>
          </div>
          <nav className="book-nav" aria-label="Страницы">
            {page > 1 ? (
              <Link className="btn" href={here(page - 1)} rel="prev">
                ← {page - 1}
              </Link>
            ) : null}
            <form className="book-jump">
              <input type="hidden" name="a" value={task?.id ?? ""} />
              <label className="small">
                <span className="visually-hidden">Номер страницы</span>
                <input type="number" name="p" id="book-page" min={1} max={book.pages} defaultValue={page} />
              </label>
              <button className="btn" type="submit">
                Открыть
              </button>
            </form>
            {page < book.pages ? (
              <Link className="btn" href={here(page + 1)} rel="next">
                {page + 1} →
              </Link>
            ) : null}
            <Link className="small" href={here(book.contents_page)}>
              Содержание
            </Link>
          </nav>
        </div>

        {task ? (
          addedPages.has(page) ? (
            <p className="book-added">Эта страница уже в задании «{task.title}».</p>
          ) : (
            <form action={addBookPages.bind(null, task.id)} className="book-add">
              <input type="hidden" name="book_id" value={book.id} />
              <input type="hidden" name="pages" value={page} />
              <input type="hidden" name="back" value={here(page)} />
              <button className="btn primary" type="submit">
                Добавить страницу {page} в задание
              </button>
              {addedPages.size ? (
                <span className="small muted">
                  В задании уже: {[...addedPages].sort((x, y) => x - y).join(", ")}
                </span>
              ) : null}
            </form>
          )
        ) : null}

        {signedUrl?.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- временная ссылка на закрытый файл
          <img className="book-page" src={signedUrl.signedUrl} alt={`${book.title}, страница ${page}`} />
        ) : (
          <p className="notes-empty">Эта страница ещё не загружена на сайт.</p>
        )}
      </main>
    </>
  );
}
