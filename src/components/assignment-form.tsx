import { displayName, dueInputValue } from "@/lib/format";
import type { Assignment, Profile } from "@/lib/types";

// Форма задания: создание на главной и изменение на странице задания.
export function AssignmentForm({
  action,
  students,
  assignment,
  selected = [],
  locked = [],
}: {
  action: (form: FormData) => Promise<void>;
  students: Profile[];
  assignment?: Assignment;
  // Кому задание уже выдано.
  selected?: string[];
  // Ученики, которые уже сдали работу: убрать их нельзя.
  locked?: string[];
}) {
  const key = assignment?.id ?? "new";
  return (
    <form action={action} className="panel">
      <h3>{assignment ? "Изменить задание" : "Новое задание"}</h3>
      <label>
        Название
        <input
          type="text"
          name="title"
          id={`title-${key}`}
          required
          defaultValue={assignment?.title}
          placeholder="Essay: My last holiday"
        />
      </label>
      <label>
        Что нужно сделать
        <textarea
          name="description"
          id={`description-${key}`}
          defaultValue={assignment?.description}
          placeholder="120–150 слов, используйте Past Simple"
        />
      </label>
      <label>
        Срок
        <input type="date" name="due" id={`due-${key}`} defaultValue={dueInputValue(assignment?.due_at ?? null)} />
      </label>
      {students.length ? (
        <fieldset className="choices">
          <legend>Кому выдать</legend>
          {students.map((s) => {
            const isLocked = locked.includes(s.id);
            return (
              <label key={s.id} className="check">
                <input
                  type="checkbox"
                  name="student_ids"
                  value={s.id}
                  id={`assign-${key}-${s.id}`}
                  defaultChecked={selected.includes(s.id) || isLocked}
                />
                {displayName(s)}
                {isLocked ? <span className="muted small"> · уже сдал(а)</span> : null}
              </label>
            );
          })}
          <small className="muted">Если никого не отметить, задание получат все ученики.</small>
        </fieldset>
      ) : null}
      <button className="btn primary" type="submit">
        {assignment ? "Сохранить" : "Создать"}
      </button>
    </form>
  );
}
