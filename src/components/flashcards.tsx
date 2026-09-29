"use client";

import { useEffect, useRef, useState } from "react";
import { markStudyDay } from "@/app/actions";
import { shuffle } from "@/lib/student";

export type Card = { id: string; term: string; translation: string };


// Карточки: показываем слово (или перевод), ученик переворачивает и отмечает, помнит ли.
export function Flashcards({ cards }: { cards: Card[] }) {
  const [deck, setDeck] = useState(cards);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [missed, setMissed] = useState<Card[]>([]);
  const marked = useRef(false);

  const done = i >= deck.length;
  const card = deck[i];

  function answer(known: boolean) {
    if (!marked.current) {
      marked.current = true;
      void markStudyDay();
    }
    if (!known) setMissed((m) => [...m, card]);
    setFlipped(false);
    setI((n) => n + 1);
  }

  function restart(list: Card[]) {
    setDeck(shuffle(list));
    setMissed([]);
    setI(0);
    setFlipped(false);
  }

  // Клавиши: пробел переворачивает, стрелки отвечают.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || (e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "ArrowRight") answer(true);
      else if (flipped && e.key === "ArrowLeft") answer(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    const known = deck.length - missed.length;
    return (
      <section className="fc-done">
        <p className="fc-score">
          <b className="num">{known}</b> из {deck.length}
        </p>
        <p>{missed.length ? "Эти слова стоит повторить:" : "Все слова вспомнили. Отлично!"}</p>
        {missed.length ? (
          <ul className="fc-missed">
            {missed.map((c) => (
              <li key={c.id}>
                <b>{c.term}</b> — {c.translation}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="row">
          {missed.length ? (
            <button className="btn primary" type="button" onClick={() => restart(missed)}>
              Повторить незнакомые ({missed.length})
            </button>
          ) : null}
          <button className="btn" type="button" onClick={() => restart(cards)}>
            Все слова заново
          </button>
        </div>
      </section>
    );
  }

  const front = reverse ? card.translation : card.term;
  const back = reverse ? card.term : card.translation;

  return (
    <section className="fc">
      <div className="fc-bar">
        <span className="num">
          {i + 1} / {deck.length}
        </span>
        <span className="fc-progress" aria-hidden="true">
          <i style={{ width: `${(i / deck.length) * 100}%` }} />
        </span>
        <label className="check small">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
          сначала перевод
        </label>
      </div>

      <button
        type="button"
        className={`fc-card${flipped ? " flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Перевернуть обратно" : "Показать ответ"}
      >
        <span className="fc-front">{front}</span>
        {flipped ? <span className="fc-back">{back}</span> : <span className="fc-hint">нажмите или пробел, чтобы перевернуть</span>}
      </button>

      <div className="fc-actions">
        <button className="btn fc-no" type="button" disabled={!flipped} onClick={() => answer(false)}>
          ← Не помню
        </button>
        <button className="btn fc-yes" type="button" disabled={!flipped} onClick={() => answer(true)}>
          Помню →
        </button>
      </div>
    </section>
  );
}
