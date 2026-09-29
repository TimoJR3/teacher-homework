import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { BOOKS_BUCKET, type Book } from "@/lib/books";
import { plural } from "@/lib/format";
import { ErrorBanner, Header } from "@/components/ui";
import { BookImport } from "@/components/book-import";

// Учебники: список, сколько страниц уже на сайте, и загрузка PDF.
export default async function BooksPage(props: PageProps<"/teacher/books">) {
  const { error } = await props.searchParams;
  const { profile, supabase } = await requireRole("teacher");
  const { data } = await supabase.from("books").select("*").order("title");
  const books = (data ?? []) as Book[];

  // Сколько страниц каждой книги уже загружено.
  const counts = await Promise.all(
    books.map(async (b) => {
      const { data: files } = await supabase.storage.from(BOOKS_BUCKET).list(b.id, { limit: 1000 });
      return (files ?? []).filter((f) => f.name.endsWith(".jpg")).length;
    }),
  );

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <div className="cols">
        <main className="stack">
          <h1>Учебники</h1>
          <p className="muted">
            Откройте учебник, найдите нужные страницы и добавьте их в задание. Страницы можно добавить и прямо на
            странице задания, указав номера.
          </p>
          {books.length ? (
            <div className="list">
              {books.map((b, i) => (
                <Link key={b.id} href={`/teacher/books/${b.id}?p=${b.contents_page}`}>
                  <span>{b.title}</span>
                  <small>
                    {counts[i] >= b.pages
                      ? `${b.pages} ${plural(b.pages, "страница", "страницы", "страниц")}`
                      : counts[i]
                        ? `загружено ${counts[i]} из ${b.pages}`
                        : "страницы ещё не загружены"}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">Учебников пока нет.</p>
          )}
        </main>
        <aside className="stack">
          <BookImport books={books} />
        </aside>
      </div>
    </>
  );
}
