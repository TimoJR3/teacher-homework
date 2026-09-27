import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isAssignedTo, recipientsByAssignment } from "@/lib/assignments";
import { displayName, formatDate } from "@/lib/format";
import type { Assignment, AssignmentStudent, Mark, Profile, Submission, Topic } from "@/lib/types";
import { Header, StatusPill, TopicStats } from "@/components/ui";

export default async function StudentPage(props: PageProps<"/teacher/students/[id]">) {
  const { id } = await props.params;
  const { profile, supabase } = await requireRole("teacher");

  const { data: student } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", id)
    .eq("role", "student")
    .maybeSingle();
  if (!student) notFound();
  const s = student as Profile;

  const [{ data: assignments }, { data: recipientRows }, { data: submissions }, { data: marks }, { data: topics }] =
    await Promise.all([
      supabase.from("assignments").select("*").order("created_at", { ascending: false }),
      supabase.from("assignment_students").select("assignment_id, student_id"),
      supabase.from("submissions").select("*").eq("student_id", id),
      supabase.from("marks").select("topic_id, submissions!inner(student_id)").eq("submissions.student_id", id),
      supabase.from("topics").select("*").order("sort_order"),
    ]);

  const recipients = recipientsByAssignment((recipientRows ?? []) as AssignmentStudent[]);
  const own = ((assignments ?? []) as Assignment[]).filter((a) => isAssignedTo(recipients, a.id, id));
  const subByAssignment = new Map(((submissions ?? []) as Submission[]).map((x) => [x.assignment_id, x]));
  const done = own.filter((a) => subByAssignment.get(a.id)?.status === "accepted").length;

  return (
    <>
      <Header profile={profile} />
      <div className="cols">
        <main className="stack">
          <Link href="/teacher" className="small">
            ← Все работы
          </Link>
          <div className="stack" style={{ gap: 4 }}>
            <p className="eyebrow">{s.email}</p>
            <h1>{displayName(s)}</h1>
          </div>
          <p className="muted">
            Принято работ: {done} из {own.length}
          </p>

          <h2>Задания</h2>
          {own.length ? (
            <div className="list">
              {own.map((a) => {
                const sub = subByAssignment.get(a.id);
                const content = (
                  <>
                    <span>{a.title}</span>
                    <StatusPill status={sub?.status ?? null} />
                    <small>
                      срок: {formatDate(a.due_at)}
                      {sub ? ` · сдано ${formatDate(sub.submitted_at)}` : ""}
                    </small>
                  </>
                );
                return sub ? (
                  <Link key={a.id} href={`/teacher/submissions/${sub.id}`}>
                    {content}
                  </Link>
                ) : (
                  <div className="li" key={a.id}>
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">Этому ученику заданий пока не выдано.</p>
          )}
        </main>

        <aside className="stack">
          <h3>Темы для повторения</h3>
          <TopicStats marks={(marks ?? []) as Pick<Mark, "topic_id">[]} topics={(topics ?? []) as Topic[]} />
        </aside>
      </div>
    </>
  );
}
