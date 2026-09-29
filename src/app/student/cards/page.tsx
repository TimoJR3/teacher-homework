import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { plural } from "@/lib/format";
import { shuffle, splitWord } from "@/lib/student";
import { Header } from "@/components/ui";
import { Flashcards, type Card } from "@/components/flashcards";


// Тренировка слов из блокнота: слово на карточке, нужно вспомнить перевод.
export default async function CardsPage() {
  const { profile, supabase } = await requireRole("student");
  const { data } = await supabase.from("notes").select("id, body").eq("kind", "word");

  const words = (data ?? []) as { id: string; body: string }[];
  const cards: Card[] = [];
  for (const w of words) {
    const pair = splitWord(w.body);
    if (pair) cards.push({ id: w.id, term: pair[0], translation: pair[1] });
  }
  const skipped = words.length - cards.length;

  return (
    <>
      <Header profile={profile} />
      <main className="stack">
        <div className="hello">
          <div>
            <h1>Карточки</h1>
            <p className="muted">
              Слова из вашего блокнота. Вспомните перевод, потом переверните карточку и честно отметьте, помните ли.
            </p>
          </div>
        </div>
        {cards.length ? (
          <>
            <Flashcards cards={shuffle(cards)} />
            {skipped ? (
              <p className="muted small">
                {skipped} {plural(skipped, "слово", "слова", "слов")} без перевода не попали в карточки. Запишите их
                через тире: слово — перевод.
              </p>
            ) : null}
          </>
        ) : (
          <div className="notes-empty">
            <p>Слов пока нет.</p>
            <p className="muted small">
              Добавьте слова в <Link href="/student?kind=word#notebook">блокнот</Link>: выберите вид «Слово» и
              напишите через тире, например «borrow — брать взаймы». Они сразу появятся здесь.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
