"use client";

import { useMemo, useState } from "react";
import { overlaps, tokenize } from "@/lib/text";
import type { Mark, Topic } from "@/lib/types";

type Props = {
  body: string;
  marks: Mark[];
  topics: Topic[];
  action: (form: FormData) => Promise<void>;
};

// Преподаватель нажимает на первое и последнее слово ошибки,
// затем выбирает тему и пишет комментарий.
export function Annotator({ body, marks, topics, action }: Props) {
  const tokens = useMemo(() => tokenize(body), [body]);
  const [first, setFirst] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);

  const markIndexAt = (start: number, end: number) =>
    marks.findIndex((m) => overlaps({ start, end }, { start: m.start_offset, end: m.end_offset }));

  const range =
    first === null
      ? null
      : {
          start: tokens[Math.min(first, last ?? first)].start,
          end: tokens[Math.max(first, last ?? first)].end,
        };

  function pick(i: number) {
    const t = tokens[i];
    if (markIndexAt(t.start, t.end) !== -1) return;
    if (first === null || last !== null) {
      setFirst(i);
      setLast(null);
      return;
    }
    const start = tokens[Math.min(first, i)].start;
    const end = tokens[Math.max(first, i)].end;
    if (marks.some((m) => overlaps({ start, end }, { start: m.start_offset, end: m.end_offset }))) {
      setFirst(i);
      setLast(null);
      return;
    }
    setLast(i);
  }

  function reset() {
    setFirst(null);
    setLast(null);
  }

  return (
    <div className="stack">
      <div className="essay teacher">
        {tokens.map((t, i) => {
          if (!t.isWord) return <span key={i}>{t.text}</span>;
          const mi = markIndexAt(t.start, t.end);
          if (mi !== -1) {
            const isLastWordOfMark = t.end >= marks[mi].end_offset;
            return (
              <span key={i} className="mk">
                {t.text}
                {isLastWordOfMark ? <sup>{mi + 1}</sup> : null}
              </span>
            );
          }
          const selected = range !== null && t.start >= range.start && t.end <= range.end;
          return (
            <button
              key={i}
              type="button"
              className={`w${selected ? " sel" : ""}`}
              onClick={() => pick(i)}
            >
              {t.text}
            </button>
          );
        })}
      </div>

      {range ? (
        <form action={action} className="panel">
          <p className="eyebrow">Новая пометка: «{body.slice(range.start, range.end)}»</p>
          {last === null ? (
            <p className="muted small">
              Если ошибка из нескольких слов, нажмите на последнее слово. Иначе заполните форму.
            </p>
          ) : null}
          <input type="hidden" name="start" value={range.start} />
          <input type="hidden" name="end" value={range.end} />
          <label>
            Тема ошибки
            <select name="topic_id" id="topic_id" required defaultValue="">
              <option value="" disabled>
                Выберите тему
              </option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Комментарий для ученика
            <textarea
              name="comment"
              id="comment"
              placeholder="Объясните, что не так, или дайте подсказку"
            />
          </label>
          <div className="row">
            <button className="btn primary" type="submit">
              Добавить пометку
            </button>
            <button className="btn" type="button" onClick={reset}>
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <p className="muted small">Нажмите на первое слово ошибки, чтобы поставить пометку.</p>
      )}
    </div>
  );
}
