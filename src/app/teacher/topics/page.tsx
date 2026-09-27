import { addTopic, deleteTopic, saveTopic } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import type { Topic } from "@/lib/types";
import { ErrorBanner, Header } from "@/components/ui";

export default async function TopicsPage(props: PageProps<"/teacher/topics">) {
  const { error } = await props.searchParams;
  const { profile, supabase } = await requireRole("teacher");

  const [{ data: topics }, { data: used }] = await Promise.all([
    supabase.from("topics").select("*").order("sort_order").order("name"),
    supabase.from("marks").select("topic_id"),
  ]);
  const usage = new Map<string, number>();
  for (const m of used ?? []) usage.set(m.topic_id, (usage.get(m.topic_id) ?? 0) + 1);
  const list = (topics ?? []) as Topic[];

  return (
    <>
      <Header profile={profile} />
      <ErrorBanner error={error} />
      <main className="stack">
        <h1>Темы ошибок</h1>
        <p className="muted" style={{ maxWidth: "65ch" }}>
          Эти темы вы выбираете, когда ставите пометку. По ним ученик видит, что повторить. Короткий
          список (15–25 тем) даёт более полезную сводку, чем длинный. Тему, которая уже стоит в
          пометках, можно переименовать, но нельзя удалить.
        </p>

        <div className="stack">
          {list.map((t) => {
            const n = usage.get(t.id) ?? 0;
            return (
              <div className="panel" key={t.id}>
                <form action={saveTopic.bind(null, t.id)} className="topic-row">
                  <label>
                    Название
                    <input type="text" name="name" id={`topic-name-${t.id}`} defaultValue={t.name} required />
                  </label>
                  <label>
                    Что повторить
                    <input type="text" name="rule" id={`topic-rule-${t.id}`} defaultValue={t.rule} />
                  </label>
                  <label>
                    Порядок
                    <input
                      type="number"
                      name="sort_order"
                      id={`topic-order-${t.id}`}
                      defaultValue={t.sort_order}
                      className="num"
                    />
                  </label>
                  <button className="btn" type="submit">
                    Сохранить
                  </button>
                  <span className="muted small num">{n ? `в пометках: ${n}` : "не используется"}</span>
                </form>
                {n === 0 ? (
                  <form action={deleteTopic.bind(null, t.id)}>
                    <button className="btn danger small" type="submit">
                      Удалить тему
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>

        <form action={addTopic} className="panel">
          <h2>Новая тема</h2>
          <div className="topic-row">
            <label>
              Название
              <input type="text" name="name" id="new-topic-name" required placeholder="Условные предложения" />
            </label>
            <label>
              Что повторить
              <input type="text" name="rule" id="new-topic-rule" placeholder="типы 0–3, will после if" />
            </label>
            <label>
              Порядок
              <input type="number" name="sort_order" id="new-topic-order" defaultValue={(list.length + 1) * 10} />
            </label>
            <button className="btn primary" type="submit">
              Добавить
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
