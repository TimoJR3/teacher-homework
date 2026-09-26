import Link from "next/link";
import { signOut } from "@/app/actions";
import { countTopics, segment } from "@/lib/text";
import { STATUS_LABEL, type Mark, type Profile, type Status, type Topic } from "@/lib/types";
import { displayName } from "@/lib/format";

export function Header({ profile }: { profile: Profile }) {
  const home = profile.role === "teacher" ? "/teacher" : "/student";
  return (
    <header className="topbar">
      <Link href={home} className="brand">
        Тетрадь с пометками
      </Link>
      <div className="row">
        <span className="muted small">
          {displayName(profile)} · {profile.role === "teacher" ? "преподаватель" : "ученик"}
        </span>
        <form action={signOut}>
          <button className="btn" type="submit">
            Выйти
          </button>
        </form>
      </div>
    </header>
  );
}

export function StatusPill({ status }: { status: Status | null }) {
  if (!status) return <span className="pill s-none">Не сдано</span>;
  return <span className={`pill s-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function ErrorBanner({ error }: { error?: string | string[] }) {
  const msg = Array.isArray(error) ? error[0] : error;
  if (!msg) return null;
  return (
    <p className="banner" role="alert">
      {msg}
    </p>
  );
}

export function TopicStats({ marks, topics }: { marks: Pick<Mark, "topic_id">[]; topics: Topic[] }) {
  const counts = countTopics(marks);
  if (!counts.length) return <p className="muted">Пока ошибок не отмечено.</p>;
  const max = counts[0].count;
  const byId = new Map(topics.map((t) => [t.id, t]));
  return (
    <div className="topics">
      {counts.map(({ topicId, count }) => {
        const t = byId.get(topicId);
        return (
          <div className="topic" key={topicId}>
            <span>{t?.name ?? "Тема удалена"}</span>
            <b className="num">{count}</b>
            <span className="meter">
              <i style={{ width: `${(count / max) * 100}%` }} />
            </span>
            {t?.rule ? <small className="muted">Повторить: {t.rule}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

// Текст работы с подчёркнутыми ошибками. Номер пометки совпадает со списком комментариев.
export function MarkedText({ body, marks, showFixed }: { body: string; marks: Mark[]; showFixed?: boolean }) {
  const ranges = marks.map((m) => ({ ...m, start: m.start_offset, end: m.end_offset }));
  return (
    <div className="essay">
      {segment(body, ranges).map((s) =>
        s.kind === "text" ? (
          <span key={s.start}>{s.text}</span>
        ) : (
          <a
            key={s.start}
            href={`#mark-${s.mark.id}`}
            className={`mk${showFixed && s.mark.student_fix ? " done" : ""}`}
          >
            {s.text}
            <sup>{s.index + 1}</sup>
          </a>
        ),
      )}
    </div>
  );
}

export function MarkList({
  marks,
  topics,
  renderExtra,
}: {
  marks: Mark[];
  topics: Topic[];
  renderExtra?: (mark: Mark) => React.ReactNode;
}) {
  if (!marks.length) return <p className="muted">Пометок нет.</p>;
  const byId = new Map(topics.map((t) => [t.id, t]));
  return (
    <ol className="marks">
      {marks.map((m) => (
        <li key={m.id} id={`mark-${m.id}`}>
          <span className="quote">«{m.quote}»</span>
          <span className="topic-name">{byId.get(m.topic_id)?.name ?? "Тема удалена"}</span>
          {m.comment ? <span>{m.comment}</span> : null}
          {renderExtra?.(m)}
        </li>
      ))}
    </ol>
  );
}
