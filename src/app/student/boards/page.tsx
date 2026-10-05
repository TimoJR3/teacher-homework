import Link from "next/link";
import { requireRole } from "@/lib/auth";
import type { Board } from "@/lib/board";
import { formatDate } from "@/lib/format";
import { Header } from "@/components/ui";

// Доски, которые преподаватель открыл для ученика.
export default async function StudentBoardsPage() {
  const { profile, supabase } = await requireRole("student");
  const { data: boards } = await supabase.from("boards").select("*").order("updated_at", { ascending: false });

  return (
    <>
      <Header profile={profile} />
      <main className="stack">
        <div className="stack" style={{ gap: 6 }}>
          <h1>Доска</h1>
          <p className="muted">Здесь занятия с преподавателем: он объясняет на странице учебника, вы пишете ответы рядом.</p>
        </div>
        {boards?.length ? (
          <div className="list">
            {(boards as Board[]).map((b) => (
              <Link key={b.id} href={`/board/${b.id}`}>
                <span>{b.title}</span>
                <small>{b.book_id ? `страница ${b.page}` : "чистый лист"}</small>
                <span className="muted small">{formatDate(b.updated_at)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="notes-empty">
            <p>Досок пока нет</p>
            <p className="muted">Когда преподаватель откроет доску для занятия, она появится здесь.</p>
          </div>
        )}
      </main>
    </>
  );
}
