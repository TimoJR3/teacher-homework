"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { BOOKS_BUCKET, bookPagePath, type Book } from "@/lib/books";
import {
  BLANK_HEIGHT,
  BOARD_WIDTH,
  COLORS,
  MARKER_COLORS,
  MAX_SHEET,
  MAX_TEXT,
  TOOL_SIZE,
  addPoint,
  clampPage,
  hits,
  isStroke,
  pathD,
  sameSheet,
  sheetKey,
  type Board,
  type Point,
  type Sheet,
  type Stroke,
  type Tool,
} from "@/lib/board";

type Mode = Tool | "eraser" | "hand";
type Me = { id: string; name: string };
// Линия, которую участник рисует прямо сейчас (ещё не отпустил палец).
type Draft = Omit<Stroke, "board_id" | "created_at">;
type Typing = { x: number; y: number; value: string };

const DRAFT_EVERY_MS = 60;
const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5];
const PAGE_URL_TTL = 60 * 60;

const TOOLS: { mode: Mode; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    mode: "pen",
    label: "Ручка",
    hint: "Рисовать и подчёркивать",
    icon: <path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" />,
  },
  {
    mode: "marker",
    label: "Маркер",
    hint: "Выделить строку цветом",
    icon: <path d="M9 15l-3 5h5l2-3M9 15l7-11 4 3-7 11-4-3zM4 21h16" />,
  },
  { mode: "text", label: "Текст", hint: "Нажмите на страницу и печатайте", icon: <path d="M5 6V4h14v2M12 4v16M9 20h6" /> },
  {
    mode: "eraser",
    label: "Ластик",
    hint: "Проведите по линии, чтобы стереть",
    icon: <path d="M8 20h12M5 15l9-9 5 5-8 8H8l-3-3a1.4 1.4 0 0 1 0-1z" />,
  },
  {
    mode: "hand",
    label: "Листать",
    hint: "Прокручивать страницу пальцем",
    icon: <path d="M8 13V6a1.5 1.5 0 0 1 3 0v6m0-7a1.5 1.5 0 0 1 3 0v7m0-6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 15" />,
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function StrokeShape({ s, live }: { s: Draft; live?: boolean }) {
  if (s.tool === "text") {
    const [x, y] = s.points[0] ?? [0, 0];
    return (
      <text x={x} y={y} fontSize={s.size} fill={s.color} dominantBaseline="hanging" className="board-text">
        {s.body}
      </text>
    );
  }
  return (
    <path
      d={pathD(s.points)}
      stroke={s.color}
      strokeWidth={s.size}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={s.tool === "marker" ? "board-marker" : live ? "board-live" : undefined}
    />
  );
}

export function BoardView({
  board,
  me,
  isTeacher,
  books,
  partnerName,
}: {
  board: Board;
  me: Me;
  isTeacher: boolean;
  books: Book[];
  partnerName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [sheet, setSheet] = useState<Sheet>({ bookId: board.book_id, page: board.page });
  const [strokes, setStrokes] = useState<Map<string, Stroke>>(() => new Map());
  const [drafts, setDrafts] = useState<Map<string, Draft>>(() => new Map());
  const [mine, setMine] = useState<Draft | null>(null);
  const [mode, setMode] = useState<Mode>("pen");
  const [ink, setInk] = useState<string>(isTeacher ? COLORS[0].value : COLORS[1].value);
  const [marker, setMarker] = useState<string>(MARKER_COLORS[0].value);
  const [zoom, setZoom] = useState(1);
  const [urls, setUrls] = useState<Record<string, string | "missing">>({});
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [others, setOthers] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<Typing | null>(null);
  const [scale, setScale] = useState(1);
  const [reload, setReload] = useState(0);

  const channel = useRef<RealtimeChannel | null>(null);
  const sheetRef = useRef(sheet);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sheetEl = useRef<HTMLDivElement | null>(null);
  const lastDraft = useRef(0);
  const erased = useRef<Set<string>>(new Set());
  const drawing = useRef<Draft | null>(null);
  const typingRef = useRef<Typing | null>(null);

  const key = sheetKey(sheet);
  const book = sheet.bookId ? (books.find((b) => b.id === sheet.bookId) ?? null) : null;
  const height = sheet.bookId ? (heights[key] ?? BLANK_HEIGHT) : BLANK_HEIGHT;
  const url = sheet.bookId ? urls[key] : undefined;

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);
  useEffect(() => {
    typingRef.current = typing;
  }, [typing]);

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    void channel.current?.send({ type: "broadcast", event, payload });
  }, []);

  // Живой канал доски: линии во время рисования, готовые линии, ластик, перелистывание, кто на доске.
  useEffect(() => {
    let ch: RealtimeChannel | null = null;
    let cancelled = false;
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      ch = supabase.channel(`board:${board.id}`, {
        config: { private: true, broadcast: { self: false }, presence: { key: me.id } },
      });
      ch.on("broadcast", { event: "draft" }, ({ payload }) => {
        if (!isStroke(payload)) return;
        setDrafts((prev) => new Map(prev).set(payload.author_id, payload));
      })
        .on("broadcast", { event: "stroke" }, ({ payload }) => {
          if (!isStroke(payload)) return;
          setStrokes((prev) => new Map(prev).set(payload.id, { ...payload, board_id: board.id }));
          setDrafts((prev) => {
            if (!prev.has(payload.author_id)) return prev;
            const next = new Map(prev);
            next.delete(payload.author_id);
            return next;
          });
        })
        .on("broadcast", { event: "cancel" }, ({ payload }) => {
          const author = typeof payload?.author_id === "string" ? payload.author_id : "";
          setDrafts((prev) => {
            const next = new Map(prev);
            next.delete(author);
            return next;
          });
        })
        .on("broadcast", { event: "erase" }, ({ payload }) => {
          const ids: unknown[] = Array.isArray(payload?.ids) ? payload.ids : [];
          setStrokes((prev) => {
            const next = new Map(prev);
            for (const id of ids) if (typeof id === "string") next.delete(id);
            return next;
          });
        })
        .on("broadcast", { event: "clear" }, ({ payload }) => {
          if (typeof payload?.page !== "number") return;
          const k = sheetKey({ book_id: typeof payload.book_id === "string" ? payload.book_id : null, page: payload.page });
          setStrokes((prev) => new Map([...prev].filter(([, s]) => sheetKey(s) !== k)));
        })
        .on("broadcast", { event: "sheet" }, ({ payload }) => {
          if (typeof payload?.page !== "number") return;
          const bookId = typeof payload.book_id === "string" ? payload.book_id : null;
          setSheet({ bookId, page: clampPage(payload.page, MAX_SHEET) });
          setTyping(null);
        })
        .on("presence", { event: "sync" }, () => {
          const state = ch?.presenceState<{ name: string }>() ?? {};
          setOthers(
            Object.entries(state)
              .filter(([id]) => id !== me.id)
              .map(([, metas]) => metas[0]?.name ?? ""),
          );
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setLive(true);
            void ch?.track({ name: me.name });
            // После подключения (и переподключения) подтягиваем то, что могли пропустить.
            setReload((n) => n + 1);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setLive(false);
          }
        });
      channel.current = ch;
    })();
    return () => {
      cancelled = true;
      channel.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [supabase, board.id, me.id, me.name]);

  // Ученик открывает ту страницу, на которой сейчас преподаватель.
  useEffect(() => {
    if (isTeacher || reload === 0) return;
    let off = false;
    void supabase
      .from("boards")
      .select("book_id, page")
      .eq("id", board.id)
      .maybeSingle()
      .then(({ data }) => {
        if (off || !data) return;
        const next = { bookId: data.book_id as string | null, page: data.page as number };
        setSheet((cur) => (sameSheet(cur, next) ? cur : next));
      });
    return () => {
      off = true;
    };
  }, [supabase, board.id, isTeacher, reload]);

  // Рисунок на открытой странице.
  useEffect(() => {
    let off = false;
    let q = supabase.from("board_strokes").select("*").eq("board_id", board.id).eq("page", sheet.page);
    q = sheet.bookId ? q.eq("book_id", sheet.bookId) : q.is("book_id", null);
    void q.order("created_at").then(({ data, error: err }) => {
      if (off) return;
      if (err) {
        setError("Не удалось загрузить рисунок на странице. Обновите страницу.");
        return;
      }
      const k = sheetKey(sheet);
      const loaded = ((data ?? []) as Stroke[]).filter(isStroke);
      setStrokes((prev) => {
        const next = new Map([...prev].filter(([, s]) => sheetKey(s) !== k));
        for (const s of loaded) next.set(s.id, s);
        // Свои линии, которые ещё сохраняются, не теряем.
        for (const [id, s] of prev) if (sheetKey(s) === k && !next.has(id) && s.author_id === me.id && !s.created_at) next.set(id, s);
        return next;
      });
    });
    return () => {
      off = true;
    };
  }, [supabase, board.id, sheet, reload, me.id]);

  // Картинка страницы учебника: временная ссылка на закрытый файл.
  useEffect(() => {
    if (!sheet.bookId || urls[key]) return;
    let off = false;
    const path = bookPagePath(sheet.bookId, sheet.page);
    const load = async (attempt: number) => {
      const { data } = await supabase.storage.from(BOOKS_BUCKET).createSignedUrl(path, PAGE_URL_TTL);
      if (off) return;
      if (data?.signedUrl) setUrls((u) => ({ ...u, [key]: data.signedUrl }));
      // Ученику страница открывается в тот момент, когда её показал преподаватель: пробуем ещё раз.
      else if (attempt < 2) setTimeout(() => void load(attempt + 1), 1500);
      else setUrls((u) => ({ ...u, [key]: "missing" }));
    };
    void load(0);
    return () => {
      off = true;
    };
  }, [supabase, sheet, key, urls]);

  // Размер листа на экране: от него зависит размер поля для текста.
  useEffect(() => {
    const el = sheetEl.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / BOARD_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toBoard = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * BOARD_WIDTH, ((e.clientY - r.top) / r.height) * height];
  };

  const save = useCallback(
    async (s: Stroke) => {
      setStrokes((prev) => new Map(prev).set(s.id, s));
      send("stroke", s);
      const { error: err } = await supabase.from("board_strokes").insert({
        id: s.id,
        board_id: s.board_id,
        book_id: s.book_id,
        page: s.page,
        tool: s.tool,
        color: s.color,
        size: s.size,
        points: s.points,
        body: s.body,
      });
      if (err) {
        setStrokes((prev) => {
          const next = new Map(prev);
          next.delete(s.id);
          return next;
        });
        send("erase", { ids: [s.id] });
        setError("Последняя линия не сохранилась. Проверьте интернет и нарисуйте ещё раз.");
      } else {
        setStrokes((prev) => (prev.has(s.id) ? new Map(prev).set(s.id, { ...s, created_at: new Date().toISOString() }) : prev));
      }
    },
    [supabase, send],
  );

  const erase = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      setStrokes((prev) => {
        const next = new Map(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      send("erase", { ids });
      const { error: err } = await supabase.from("board_strokes").delete().in("id", ids);
      if (err) setError("Стереть не получилось. Обновите страницу.");
    },
    [supabase, send],
  );

  const canErase = (s: Stroke) => isTeacher || s.author_id === me.id;
  const onSheet = useMemo(() => [...strokes.values()].filter((s) => sheetKey(s) === key), [strokes, key]);

  const eraseAt = (p: Point) => {
    const hit = onSheet.filter((s) => canErase(s) && !erased.current.has(s.id) && hits(s, p, 10)).map((s) => s.id);
    for (const id of hit) erased.current.add(id);
    void erase(hit);
  };

  // Поле теряет фокус и по Enter, и по щелчку мимо: сохраняем надпись один раз.
  const commitText = (t: Typing | null) => {
    if (t !== typingRef.current) return;
    typingRef.current = null;
    setTyping(null);
    const body = t?.value.trim().slice(0, MAX_TEXT);
    if (!t || !body) return;
    void save({
      id: crypto.randomUUID(),
      board_id: board.id,
      book_id: sheet.bookId,
      page: sheet.page,
      author_id: me.id,
      tool: "text",
      color: ink,
      size: TOOL_SIZE.text,
      points: [[Math.round(t.x), Math.round(t.y)]],
      body,
    });
  };

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (mode === "hand" || e.button > 0) return;
    const p = toBoard(e);
    if (mode === "text") {
      e.preventDefault();
      commitText(typing);
      setTyping({ x: p[0], y: p[1] - TOOL_SIZE.text / 2, value: "" });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (mode === "eraser") {
      erased.current = new Set();
      eraseAt(p);
      return;
    }
    const d: Draft = {
      id: crypto.randomUUID(),
      book_id: sheet.bookId,
      page: sheet.page,
      author_id: me.id,
      tool: mode,
      color: mode === "marker" ? marker : ink,
      size: TOOL_SIZE[mode],
      points: addPoint([], p),
      body: "",
    };
    drawing.current = d;
    setMine(d);
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (mode === "eraser" && e.buttons === 1) {
      eraseAt(toBoard(e));
      return;
    }
    const d = drawing.current;
    if (!d) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    let points = d.points;
    for (const ev of events.length ? events : [e]) points = addPoint(points, toBoard(ev));
    if (points === d.points) return;
    const next = { ...d, points };
    drawing.current = next;
    setMine(next);
    const now = performance.now();
    if (now - lastDraft.current > DRAFT_EVERY_MS) {
      lastDraft.current = now;
      send("draft", next);
    }
  };

  const onUp = () => {
    const d = drawing.current;
    drawing.current = null;
    setMine(null);
    if (!d) return;
    // Если за время рисования преподаватель перелистнул страницу, линия остаётся на той, где начата.
    void save({ ...d, board_id: board.id });
  };

  const onCancel = () => {
    if (drawing.current) send("cancel", { author_id: me.id });
    drawing.current = null;
    setMine(null);
  };

  const undo = useCallback(() => {
    const own = [...strokes.values()].filter((s) => s.author_id === me.id && sheetKey(s) === key);
    const last = own[own.length - 1];
    if (last) void erase([last.id]);
  }, [strokes, me.id, key, erase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const clearSheet = async () => {
    if (!window.confirm("Стереть всё, что нарисовано на этой странице? Это увидит и ученик.")) return;
    setStrokes((prev) => new Map([...prev].filter(([, s]) => sheetKey(s) !== key)));
    send("clear", { book_id: sheet.bookId, page: sheet.page });
    let q = supabase.from("board_strokes").delete().eq("board_id", board.id).eq("page", sheet.page);
    q = sheet.bookId ? q.eq("book_id", sheet.bookId) : q.is("book_id", null);
    const { error: err } = await q;
    if (err) setError("Страница не очистилась. Обновите страницу.");
  };

  // Преподаватель листает: страница меняется у обоих.
  const goTo = async (next: Sheet) => {
    if (!isTeacher || sameSheet(next, sheet)) return;
    commitText(typing);
    sheetRef.current = next;
    setSheet(next);
    if (next.bookId) {
      // Сначала открываем страницу ученику, потом зовём его на неё.
      await supabase
        .from("board_pages")
        .upsert({ board_id: board.id, book_id: next.bookId, page: next.page }, { onConflict: "board_id,book_id,page", ignoreDuplicates: true });
    }
    if (!sameSheet(sheetRef.current, next)) return;
    send("sheet", { book_id: next.bookId, page: next.page });
    const { error: err } = await supabase
      .from("boards")
      .update({ book_id: next.bookId, page: next.page, updated_at: new Date().toISOString() })
      .eq("id", board.id);
    if (err) setError("Не удалось запомнить страницу. Ученик увидит её, только пока вы оба на доске.");
  };

  const maxPage = book ? book.pages : MAX_SHEET;
  const step = (delta: number) => void goTo({ bookId: sheet.bookId, page: clampPage(sheet.page + delta, maxPage) });
  const zoomBy = (dir: 1 | -1) => {
    const i = ZOOMS.indexOf(zoom);
    setZoom(ZOOMS[Math.min(Math.max(i + dir, 0), ZOOMS.length - 1)]);
  };

  const palette = mode === "marker" ? MARKER_COLORS : COLORS;
  const picked = mode === "marker" ? marker : ink;
  const markers = onSheet.filter((s) => s.tool === "marker");
  const inks = onSheet.filter((s) => s.tool !== "marker");
  const liveDrafts = [...drafts.values()].filter((d) => sheetKey(d) === key);
  const where = book ? `${book.title}, страница ${sheet.page}` : `Чистый лист ${sheet.page}`;
  const partnerHere = others.length > 0;

  return (
    <div className="board">
      <div className="board-head">
        <div className="board-title">
          <h1>{board.title}</h1>
          <p className={partnerHere ? "board-who here" : "board-who"}>
            {!live
              ? "Подключаюсь к доске…"
              : partnerHere
                ? `${partnerName} сейчас на доске`
                : isTeacher
                  ? `${partnerName} пока не открыл(а) доску`
                  : "Преподаватель пока не на доске"}
          </p>
        </div>

        {isTeacher ? (
          <nav className="board-pager" aria-label="Страницы">
            <label>
              <span className="visually-hidden">Что открыто</span>
              <select
                value={sheet.bookId ?? ""}
                onChange={(e) => {
                  const b = books.find((x) => x.id === e.target.value);
                  void goTo(b ? { bookId: b.id, page: b.contents_page } : { bookId: null, page: 1 });
                }}
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
                <option value="">Чистый лист в клетку</option>
              </select>
            </label>
            <button className="btn small" type="button" onClick={() => step(-1)} disabled={sheet.page <= 1} aria-label="Предыдущая страница">
              ←
            </button>
            <form
              className="board-jump"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(new FormData(e.currentTarget).get("p"));
                void goTo({ bookId: sheet.bookId, page: clampPage(n, maxPage) });
              }}
            >
              <label>
                <span className="visually-hidden">Номер страницы</span>
                <input key={key} type="number" name="p" min={1} max={maxPage} defaultValue={sheet.page} />
              </label>
              <button className="btn small" type="submit">
                Открыть
              </button>
            </form>
            <button className="btn small" type="button" onClick={() => step(1)} disabled={sheet.page >= maxPage} aria-label="Следующая страница">
              →
            </button>
          </nav>
        ) : (
          <p className="board-follow">
            <b>{where}</b>
            <span className="small muted">Страницы листает преподаватель</span>
          </p>
        )}
      </div>

      <div className="board-tools" role="toolbar" aria-label="Инструменты">
        <div className="tool-group">
          {TOOLS.map((t) => (
            <button
              key={t.mode}
              type="button"
              className="tool"
              aria-pressed={mode === t.mode}
              title={t.hint}
              onClick={() => {
                commitText(typing);
                setMode(t.mode);
              }}
            >
              <Icon>{t.icon}</Icon>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        {mode !== "eraser" && mode !== "hand" ? (
          <div className="tool-group inks" role="radiogroup" aria-label="Цвет">
            {palette.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={picked === c.value}
                className="ink"
                title={c.label}
                aria-label={c.label}
                style={{ background: c.value }}
                onClick={() => (mode === "marker" ? setMarker(c.value) : setInk(c.value))}
              />
            ))}
          </div>
        ) : null}
        <div className="tool-group">
          <button type="button" className="tool" onClick={undo} title="Убрать свою последнюю линию (Ctrl+Z)">
            <Icon>
              <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
            </Icon>
            <span>Отменить</span>
          </button>
          {isTeacher ? (
            <button type="button" className="tool" onClick={() => void clearSheet()} title="Стереть всё на этой странице">
              <Icon>
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
              </Icon>
              <span>Очистить</span>
            </button>
          ) : null}
        </div>
        <div className="tool-group zoom">
          <button type="button" className="tool" onClick={() => zoomBy(-1)} disabled={zoom === ZOOMS[0]} aria-label="Уменьшить">
            −
          </button>
          <span className="num">{Math.round(zoom * 100)}%</span>
          <button type="button" className="tool" onClick={() => zoomBy(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Увеличить">
            +
          </button>
        </div>
      </div>

      {error ? (
        <p className="banner" role="alert">
          {error}{" "}
          <button type="button" className="link-btn" onClick={() => setError(null)}>
            Закрыть
          </button>
        </p>
      ) : null}

      <div className={`board-stage mode-${mode}`}>
        <div
          ref={sheetEl}
          className={sheet.bookId ? "board-sheet" : "board-sheet blank"}
          style={{ width: `calc(min(100%, 900px) * ${zoom})`, aspectRatio: `${BOARD_WIDTH} / ${height}` }}
        >
          {sheet.bookId && url && url !== "missing" ? (
            // eslint-disable-next-line @next/next/no-img-element -- временная ссылка на закрытый файл
            <img
              src={url}
              alt={where}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth) setHeights((h) => ({ ...h, [key]: (img.naturalHeight / img.naturalWidth) * BOARD_WIDTH }));
              }}
            />
          ) : sheet.bookId ? (
            <p className="board-missing">{url === "missing" ? "Эта страница ещё не загружена на сайт." : "Открываю страницу…"}</p>
          ) : null}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${BOARD_WIDTH} ${height}`}
            preserveAspectRatio="none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onLostPointerCapture={() => (drawing.current ? onUp() : undefined)}
          >
            <g>
              {markers.map((s) => (
                <StrokeShape key={s.id} s={s} />
              ))}
              {liveDrafts
                .filter((d) => d.tool === "marker")
                .map((d) => (
                  <StrokeShape key={d.id} s={d} live />
                ))}
              {mine?.tool === "marker" ? <StrokeShape s={mine} /> : null}
            </g>
            <g>
              {inks.map((s) => (
                <StrokeShape key={s.id} s={s} />
              ))}
              {liveDrafts
                .filter((d) => d.tool !== "marker")
                .map((d) => (
                  <StrokeShape key={d.id} s={d} live />
                ))}
              {mine && mine.tool !== "marker" ? <StrokeShape s={mine} /> : null}
            </g>
          </svg>
          {typing ? (
            <input
              className="board-input"
              autoFocus
              maxLength={MAX_TEXT}
              value={typing.value}
              placeholder="Пишите…"
              aria-label="Текст на странице"
              style={{
                left: `${(typing.x / BOARD_WIDTH) * 100}%`,
                top: `${(typing.y / height) * 100}%`,
                fontSize: TOOL_SIZE.text * scale,
                color: ink,
              }}
              onChange={(e) => setTyping({ ...typing, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitText(typing);
                if (e.key === "Escape") {
                  typingRef.current = null;
                  setTyping(null);
                }
              }}
              onBlur={() => commitText(typing)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
