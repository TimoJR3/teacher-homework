import Link from "next/link";
import { addNote, deleteNote, updateNote } from "@/app/actions";
import { formatDate, plural } from "@/lib/format";
import { splitWord } from "@/lib/student";
import { NOTE_KINDS, type Note, type NoteKind } from "@/lib/types";


function KindPicker({ name, value }: { name: string; value: NoteKind }) {
  return (
    <fieldset className="kinds">
      <legend>Что это</legend>
      {NOTE_KINDS.map((k) => (
        <label key={k.kind} className={`kind k-${k.kind}`}>
          <input type="radio" name={name} value={k.kind} defaultChecked={k.kind === value} />
          {k.label}
        </label>
      ))}
    </fieldset>
  );
}

function NoteBody({ note }: { note: Note }) {
  const word = note.kind === "word" ? splitWord(note.body) : null;
  if (word)
    return (
      <p className="note-body">
        <b className="term">{word[0]}</b>
        <span>{word[1]}</span>
      </p>
    );
  return <p className="note-body">{note.body}</p>;
}

// Блокнот ученика: слева новая запись, справа записи стикерами по цвету вида.
export function Notebook({ notes, filter, unavailable }: { notes: Note[]; filter: NoteKind | null; unavailable?: boolean }) {
  const shown = filter ? notes.filter((n) => n.kind === filter) : notes;
  const count = (k: NoteKind) => notes.filter((n) => n.kind === k).length;

  return (
    <section className="notebook" id="notebook" aria-labelledby="notebook-title">
      <div className="nb-head">
        <div>
          <h2 id="notebook-title">Мой блокнот</h2>
          <p className="muted small">
            {notes.length} {plural(notes.length, "запись", "записи", "записей")} · видите только вы ·{" "}
            <Link href="/student/cards">тренировать слова</Link>
          </p>
        </div>
        <nav className="tabs" aria-label="Виды записей">
          <Link href="/student#notebook" aria-current={filter === null ? "page" : undefined}>
            Все <span className="num">{notes.length}</span>
          </Link>
          {NOTE_KINDS.map((k) => (
            <Link
              key={k.kind}
              href={`/student?kind=${k.kind}#notebook`}
              className={`k-${k.kind}`}
              aria-current={filter === k.kind ? "page" : undefined}
            >
              {k.many} <span className="num">{count(k.kind)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {unavailable ? (
        <p className="muted">Блокнот пока не подключён к базе.</p>
      ) : (
        <div className="nb-body">
          <form action={addNote} className="note-new">
            <h3>Новая запись</h3>
            <KindPicker name="kind" value={filter ?? "rule"} />
            <label>
              Текст
              <textarea name="body" required maxLength={5000} placeholder="Правило, новое слово или мысль, которую хочется запомнить" />
            </label>
            <p className="muted small">Для слова пишите через тире: слово — перевод.</p>
            <button className="btn primary" type="submit">
              Записать
            </button>
          </form>

          {shown.length ? (
            <ol className="notes">
              {shown.map((n) => (
                <li key={n.id} className={`k-${n.kind}`}>
                  <div className="note-top">
                    <span className="note-kind">{NOTE_KINDS.find((k) => k.kind === n.kind)?.label}</span>
                    <time dateTime={n.created_at}>{formatDate(n.created_at)}</time>
                  </div>
                  <NoteBody note={n} />
                  <details className="note-edit">
                    <summary>Изменить</summary>
                    <form action={updateNote.bind(null, n.id)} className="stack">
                      <KindPicker name="kind" value={n.kind} />
                      <textarea name="body" required maxLength={5000} defaultValue={n.body} aria-label="Текст записи" />
                      <div className="row">
                        <button className="btn small primary" type="submit">
                          Сохранить
                        </button>
                        <button className="btn small danger" type="submit" formAction={deleteNote.bind(null, n.id)} formNoValidate>
                          Удалить
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <div className="notes-empty">
              <p>{filter ? "Записей этого вида пока нет." : "Здесь будут ваши записи."}</p>
              <p className="muted small">
                Правила — голубые, слова — зелёные, заметки — жёлтые. Записывайте то, что объяснил преподаватель, и
                слова, которые хотите выучить.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
