import Link from "next/link";
import { createAssignment } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { displayName, formatDate } from "@/lib/format";
import { assignedCount, recipientsByAssignment } from "@/lib/assignments";
import type { Assignment, AssignmentStudent, Profile, Submission } from "@/lib/types";
import { ErrorBanner, Header, StatusPill } from "@/components/ui";
import { AssignmentForm } from "@/components/assignment-form";

export default async function TeacherHome(props: PageProps<"/teacher">) {
  const { error } = await props.searchParams;
  const { profile, supabase } = await requireRole("teacher");

  const [{ data: assignments }, { data: submissions }, { data: students }, { data: recipientRows }] = await Promise.all([
    supabase.from("assignments").select("*").order("created_at", { ascending: false }),
    supabase.from("submissions").select("*").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id, email, full_name, role").eq("role", "student").order("full_name"),
    supabase.from("assignment_students").select("assignment_id, student_id"),
  ]);
  const recipients = recipientsByAssignment((recipientRows ?? []) as AssignmentStudent[]);
  const forWhom = (id: string) => {
    const list = recipients.get(id);
    if (!list) return "всем";
    return list.map((sid) => displayName(studentById.get(sid))).join(", ");
  };

  const subs = (submissions ?? []) as Submission[];
  const assignmentById = new Map(((assignments ?? []) as Assignment[]).map((a) => [a.id, a]));
  const studentById = new Map(((students ?? []) as Profile[]).map((s) => [s.id, s]));
  const waiting = subs.filter((s) => s.status === "submitted" || s.status === "fixed");
  const rest = subs.filter((s) => s.status === "returned" || s.status === "accepted");

  const row = (s: Submission) => (
    <Link key={s.id} href={`/teacher/submissions/${s.id}`}>
      <span>
        {displayName(studentById.get(s.student_id))} · {assignmentById.get(s.assignment_id)?.title}
      </span>
      <StatusPill status={s.status} />
      <small>обновлено {formatDate(s.updated_at)}</small>
    </Link>
  );

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <div className="cols">
        <main className="stack">
          <h1>Ждут проверки: {waiting.length}</h1>
          {waiting.length ? (
            <div className="list">{waiting.map(row)}</div>
          ) : (
            <p className="muted">Новых работ нет.</p>
          )}

          <h2>Проверенные</h2>
          {rest.length ? <div className="list">{rest.map(row)}</div> : <p className="muted">Пока нет.</p>}

          <h2>Задания</h2>
          {assignments?.length ? (
            <div className="list">
              {(assignments as Assignment[]).map((a) => (
                <Link key={a.id} href={`/teacher/assignments/${a.id}`}>
                  <span>{a.title}</span>
                  <span className="muted small">
                    сдали {subs.filter((s) => s.assignment_id === a.id).length} из{" "}
                    {assignedCount(recipients, a.id, students?.length ?? 0)}
                  </span>
                  <small>
                    срок: {formatDate(a.due_at)} · для: {forWhom(a.id)}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">Заданий пока нет. Создайте первое справа.</p>
          )}
        </main>

        <aside className="stack">
          <AssignmentForm action={createAssignment} students={(students ?? []) as Profile[]} />

          <div className="stack">
            <h3>Ученики</h3>
            {students?.length ? (
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {(students as Profile[]).map((s) => (
                  <li key={s.id}>
                    <Link href={`/teacher/students/${s.id}`}>{displayName(s)}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Пока никто не зарегистрировался. Пришлите ученику ссылку на сайт.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
