import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Assignment, Mark, Submission, Topic } from "@/lib/types";
import { Header, StatusPill, TopicStats } from "@/components/ui";

export default async function StudentHome() {
  const { profile, supabase } = await requireRole("student");

  const [{ data: assignments }, { data: submissions }, { data: marks }, { data: topics }] = await Promise.all([
    supabase.from("assignments").select("*").order("created_at", { ascending: false }),
    supabase.from("submissions").select("*").eq("student_id", profile.id),
    // RLS отдаёт ученику только пометки к его собственным работам.
    // Работы, которые ещё проверяются, не учитываем.
    supabase.from("marks").select("topic_id, submissions!inner(status)").neq("submissions.status", "submitted"),
    supabase.from("topics").select("*").order("sort_order"),
  ]);

  const subByAssignment = new Map(((submissions ?? []) as Submission[]).map((s) => [s.assignment_id, s]));
  const list = (assignments ?? []) as Assignment[];

  return (
    <>
      <Header profile={profile} />
      <div className="cols">
        <main className="stack">
          <h1>Мои задания</h1>
          {list.length ? (
            <div className="list">
              {list.map((a) => {
                const s = subByAssignment.get(a.id);
                return (
                  <Link key={a.id} href={`/student/assignments/${a.id}`}>
                    <span>{a.title}</span>
                    <StatusPill status={s?.status ?? null} />
                    <small>срок: {formatDate(a.due_at)}</small>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="muted">Заданий пока нет.</p>
          )}
        </main>
        <aside className="stack">
          <h3>Мои темы для повторения</h3>
          <TopicStats marks={(marks ?? []) as Pick<Mark, "topic_id">[]} topics={(topics ?? []) as Topic[]} />
        </aside>
      </div>
    </>
  );
}
