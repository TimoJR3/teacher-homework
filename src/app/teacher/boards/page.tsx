import Link from "next/link";
import { createBoard } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import type { Board } from "@/lib/board";
import type { Book } from "@/lib/books";
import { displayName, formatDate } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { ErrorBanner, Header } from "@/components/ui";

// Доски для занятий: новая доска с учеником и список прежних.
export default async function BoardsPage(props: PageProps<"/teacher/boards">) {
  const { error, student } = await props.searchParams;
  const { profile, supabase } = await requireRole("teacher");

  const [{ data: boards }, { data: students }, { data: books }] = await Promise.all([
    supabase.from("boards").select("*").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id, email, full_name, role").eq("role", "student").order("full_name"),
    supabase.from("books").select("*").order("title"),
  ]);
  const studentById = new Map(((students ?? []) as Profile[]).map((s) => [s.id, s]));
  const bookById = new Map(((books ?? []) as Book[]).map((b) => [b.id, b]));
  const picked = typeof student === "string" ? student : "";

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <div className="cols">
        <main className="stack">
          <div className="stack" style={{ gap: 6 }}>
            <h1>Доска для занятия</h1>
            <p className="muted">
              Откройте страницу учебника и объясняйте прямо на ней: ученик видит каждую линию сразу, а сам может писать
              ответы на той же странице.
            </p>
          </div>

          <h2>Доски</h2>
          {boards?.length ? (
            <div className="list">
              {(boards as Board[]).map((b) => (
                <Link key={b.id} href={`/board/${b.id}`}>
                  <span>{b.title}</span>
                  <small>
                    {displayName(studentById.get(b.student_id))} ·{" "}
                    {b.book_id ? `${bookById.get(b.book_id)?.title ?? "учебник"}, с. ${b.page}` : "чистый лист"}
                  </small>
                  <span className="muted small">открывали {formatDate(b.updated_at)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">Досок пока нет. Создайте первую справа.</p>
          )}
        </main>

        <aside className="stack">
          <form action={createBoard} className="panel">
            <h3>Новая доска</h3>
            {students?.length ? (
              <>
                <label>
                  Ученик
                  <select name="student_id" defaultValue={picked} required>
                    <option value="" disabled>
                      Выберите
                    </option>
                    {(students as Profile[]).map((s) => (
                      <option key={s.id} value={s.id}>
                        {displayName(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Название
                  <input type="text" name="title" placeholder="Например, Past Simple" maxLength={200} />
                </label>
                <label>
                  Что открыть
                  <select name="book_id" defaultValue={books?.[0]?.id ?? ""}>
                    {((books ?? []) as Book[]).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                    <option value="">Чистый лист в клетку</option>
                  </select>
                </label>
                <label>
                  Страница учебника
                  <input type="number" name="page" min={1} placeholder="содержание" />
                </label>
                <button className="btn primary" type="submit">
                  Открыть доску
                </button>
                <p className="small muted">Пришлите ученику ссылку на доску или попросите открыть раздел «Доска».</p>
              </>
            ) : (
              <p className="muted small">Пока нет учеников. Доску можно открыть, когда ученик зарегистрируется.</p>
            )}
          </form>
        </aside>
      </div>
    </>
  );
}
