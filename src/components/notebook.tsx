import { addNote, deleteNote, updateNote } from "@/app/actions";
import { formatDate } from "@/lib/format";
import type { Note } from "@/lib/types";

// Блокнот ученика: тетрадный лист, новые записи сверху.
export function Notebook({ notes, unavailable }: { notes: Note[]; unavailable?: boolean }) {
  return (
    <section className="notebook" id="notebook" aria-labelledby="notebook-title">
      <h2 id="notebook-title">Мой блокнот</h2>
      <p className="muted small">Правила, новые слова, то, что хочется запомнить. Записи видите только вы.</p>

      {unavailable ? (
        <p className="muted">Блокнот пока не подключён к базе.</p>
      ) : (
        <>
          <form action={addNote} className="note-new">
            <label>
              Новая запись
              <textarea name="body" required maxLength={5000} placeholder="Например: after «since» и «for» нужен Present Perfect" />
            </label>
            <button className="btn primary" type="submit">
              Записать
            </button>
          </form>

          {notes.length ? (
            <ol className="notes">
              {notes.map((n) => (
                <li key={n.id}>
                  <time className="note-date" dateTime={n.created_at}>
                    {formatDate(n.created_at)}
                  </time>
                  <p className="note-body">{n.body}</p>
                  <details className="note-edit">
                    <summary>Изменить</summary>
                    <form action={updateNote.bind(null, n.id)} className="stack">
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
            <p className="muted">Здесь пока пусто. Первая запись появится под полем выше.</p>
          )}
        </>
      )}
    </section>
  );
}
