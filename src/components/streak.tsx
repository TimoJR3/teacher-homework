import { plural, weekdayShort } from "@/lib/format";
import { lastWeek, streak } from "@/lib/student";

// Сколько дней подряд ученик занимается, и последняя неделя кружками.
export function Streak({ days, today }: { days: string[]; today: string }) {
  const s = streak(days, today);
  const week = lastWeek(days, today);
  const hint = s.today
    ? "Сегодня вы уже занимались."
    : s.count
      ? "Позанимайтесь сегодня, чтобы не прервать серию."
      : "Запишите слово или потренируйте карточки, чтобы начать серию.";
  return (
    <div className="streak">
      <p className="streak-num">
        <b className="num">{s.count}</b>
        <span>
          {plural(s.count, "день", "дня", "дней")}
          <br />
          подряд
        </span>
      </p>
      <ol className="week" aria-label="Последние 7 дней">
        {week.map((d) => (
          <li key={d.day} className={d.done ? "on" : undefined} title={d.done ? "занимались" : "не занимались"}>
            {weekdayShort(d.day)}
          </li>
        ))}
      </ol>
      <p className="small muted">{hint}</p>
    </div>
  );
}
