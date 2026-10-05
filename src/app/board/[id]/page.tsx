import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Board } from "@/lib/board";
import type { Book } from "@/lib/books";
import { displayName } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { Header } from "@/components/ui";
import { BoardView } from "@/components/board";

// Доска занятия: общая страница для преподавателя и ученика.
export default async function BoardPage(props: PageProps<"/board/[id]">) {
  const { id } = await props.params;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  // Чужую доску база не отдаст: её видят только ученик этой доски и преподаватель.
  const { data } = await supabase.from("boards").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const board = data as Board;
  const isTeacher = profile.role === "teacher";

  const [{ data: books }, { data: student }] = await Promise.all([
    supabase.from("books").select("*").order("title"),
    isTeacher
      ? supabase.from("profiles").select("id, email, full_name, role").eq("id", board.student_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <Header profile={profile} />
      <main className="stack board-page">
        <Link href={isTeacher ? "/teacher/boards" : "/student/boards"} className="small">
          ← Все доски
        </Link>
        <BoardView
          board={board}
          me={{ id: profile.id, name: displayName(profile) }}
          isTeacher={isTeacher}
          books={(books ?? []) as Book[]}
          partnerName={isTeacher ? displayName(student as Profile | null) : "Преподаватель"}
        />
      </main>
    </>
  );
}
