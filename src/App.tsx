import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  LayoutDashboard,
  ListTodo,
  Moon,
  Pause,
  Play,
  Plus,
  Settings,
  Sun,
  Upload,
  BarChart3,
  FolderKanban,
  X,
  GripVertical,
} from "lucide-react";
import {
  clock,
  completeTask,
  elapsed,
  finishTimer,
  materializeRecurrences,
  localDate,
  schedule,
  shiftDate,
  uid,
  validateState,
  type Block,
  type State,
  type Task,
} from "./domain";
import Projects from "./components/Projects";
import TaskList from "./components/TaskList";
import Statistics from "./components/Statistics";
import TaskEditor from "./components/TaskEditor";
import * as storage from "./storage";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
type Page =
  "Mi día" | "Calendario" | "Tareas" | "Proyectos" | "Estadísticas" | "Ajustes";
const nav = [
  { name: "Mi día", icon: LayoutDashboard },
  { name: "Calendario", icon: CalendarDays },
  { name: "Tareas", icon: ListTodo },
  { name: "Proyectos", icon: FolderKanban },
  { name: "Estadísticas", icon: BarChart3 },
] as const;
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const duration = (n: number) =>
  `${Math.floor(n / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((n % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
let loading: Promise<State> | undefined;
export default function App() {
  const [state, setState] = useState<State>();
  const [page, setPage] = useState<Page>("Mi día");
  const [date, setDate] = useState(localDate());
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Cargando…");
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState<Task | null | undefined>();
  const [filter, setFilter] = useState({
    project: "",
    priority: "",
    status: "",
  });
  const [calendar, setCalendar] = useState<"día" | "semana" | "mes">("semana");
  const [notice, setNotice] = useState("");
  const chain = useRef(Promise.resolve());
  const revision = useRef(0);
  const latest = useRef<State | undefined>(state);
  latest.current = state;
  const notified = useRef(new Set<string>());
  const drag = useRef<string>("");
  const file = useRef<HTMLInputElement>(null);
  const booted = useRef(false);
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const registration = getCurrentWindow().onCloseRequested(async (e) => {
      const snapshot = latest.current;
      if (!snapshot) return;
      e.preventDefault();
      try {
        await chain.current;
        const paused = {
          ...snapshot,
          timer: snapshot.timer
            ? {
                ...snapshot.timer,
                elapsed: elapsed(snapshot.timer),
                startedAt: null,
              }
            : null,
        };
        await storage.save(paused);
        await getCurrentWindow().destroy();
      } catch (error) {
        setError(
          `No se pudo guardar al cerrar: ${String(error)}. Exporta un respaldo.`,
        );
      }
    });
    registration
      .then((unlisten) => {
        if (cancelled) unlisten();
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
      void registration.then((unlisten) => unlisten());
    };
  }, []);
  useEffect(() => {
    if (!state) return;
    const through =
      calendar === "mes"
        ? `${date.slice(0, 7)}-${new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate()}`
        : calendar === "semana"
          ? shiftDate(date, 6)
          : date;
    const expanded = materializeRecurrences(state, through);
    if (expanded !== state) setState(expanded);
  }, [state, date, calendar]);
  useEffect(() => {
    (loading ??= storage.load())
      .then((s) => {
        setState(s);
        booted.current = true;
      })
      .catch((e) => setError(String(e)));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!state || !booted.current) return;
    const savedRevision = ++revision.current;
    setSaveStatus("Guardando…");
    chain.current = chain.current
      .catch(() => {})
      .then(() => storage.save(state))
      .then(() => {
        if (savedRevision === revision.current) setSaveStatus("Guardado local");
      })
      .catch((e) => {
        setSaveStatus("Error al guardar");
        setError(
          `No se pudo guardar: ${String(e)}. Exporta una copia antes de cerrar.`,
        );
      });
  }, [state]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus !== "Guardado local") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);
  useEffect(() => {
    if (!state?.settings.notifications) return;
    const d = new Date(now),
      today = localDate(d),
      minute = d.getHours() * 60 + d.getMinutes();
    const events = [
      ...schedule(state, today).flatMap((b) => [
        { minute: b.start, text: `Es hora de ${b.name}` },
        { minute: b.end, text: `Finaliza ${b.name}` },
      ]),
      {
        minute: state.settings.end,
        text: "Tu jornada termina. Revisa tus pendientes.",
      },
      {
        minute: state.settings.start,
        text: `Tienes ${state.tasks.filter((t) => t.date <= today && t.priority === "alta" && t.status !== "completada").length} tareas prioritarias pendientes.`,
      },
    ];
    events
      .filter((e) => e.minute === minute)
      .forEach((e) => {
        const key = today + e.minute + e.text;
        if (notified.current.has(key)) return;
        notified.current.add(key);
        if (isTauri())
          sendNotification({ title: "Montana Agenda", body: e.text });
        else if (Notification.permission === "granted")
          new Notification("Montana Agenda", { body: e.text });
      });
  }, [now, state]);
  const change = (fn: (s: State) => State) => setState((s) => (s ? fn(s) : s));
  if (!state)
    return (
      <div className="loading">
        <h1>Montana Agenda</h1>
        <p>{error || "Preparando tu espacio de trabajo…"}</p>
      </div>
    );
  const s = state;
  const today = localDate();
  const blocks = schedule(s, date);
  const minute = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const current =
    date === today
      ? blocks.find((b) => b.start <= minute && b.end > minute)
      : undefined;
  const next = blocks.find((b) => b.start > minute);
  const done = s.completions[date] ?? [];
  const dayTasks = s.tasks.filter((t) => t.date === date);
  const backlog = s.tasks.filter(
    (t) => t.date < today && t.status !== "completada",
  );
  const project = (id: string) => s.projects.find((p) => p.id === id);
  const progress = blocks.length
    ? Math.round((done.length / blocks.length) * 100)
    : 0;
  function start(blockId: string) {
    change((st) => {
      let base = st;
      if (st.timer && (st.timer.blockId !== blockId || st.timer.date !== date))
        base = finishTimer(st);
      return {
        ...base,
        timer: base.timer
          ? { ...base.timer, startedAt: base.timer.startedAt ?? Date.now() }
          : {
              blockId,
              date,
              elapsed: 0,
              startedAt: Date.now(),
              interruptions: 0,
            },
      };
    });
  }
  function pause() {
    change((st) =>
      st.timer
        ? {
            ...st,
            timer: {
              ...st.timer,
              elapsed: elapsed(st.timer),
              startedAt: null,
              interruptions: st.timer.interruptions + 1,
            },
          }
        : st,
    );
  }
  function finish(blockId: string) {
    change((st) => ({
      ...(st.timer && st.timer.blockId === blockId ? finishTimer(st) : st),
      completions: {
        ...st.completions,
        [date]: [...new Set([...(st.completions[date] ?? []), blockId])],
      },
    }));
  }
  function reschedule(t: Task) {
    const selected = prompt("Nueva fecha (AAAA-MM-DD)", shiftDate(today, 1));
    if (!selected) return;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(selected) ||
      Number.isNaN(new Date(selected + "T12:00:00").getTime())
    ) {
      setError("Introduce una fecha válida.");
      return;
    }
    change((st) => ({
      ...st,
      tasks: st.tasks.map((x) =>
        x.id === t.id
          ? { ...x, date: selected, originDate: x.originDate ?? x.date }
          : x,
      ),
    }));
  }
  function reorder(target: string) {
    if (!drag.current || drag.current === target) return;
    const from = blocks.findIndex((b) => b.id === drag.current),
      to = blocks.findIndex((b) => b.id === target);
    if (from < 0 || to < 0) return;
    const reordered = blocks.map(({ start: _a, end: _b, ...b }) => b);
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    change((st) => ({
      ...st,
      overrides: { ...st.overrides, [date]: reordered },
    }));
    drag.current = "";
  }
  function download(content: string, extension: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `montana-${today}.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCsv() {
    const quote = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      [
        "tipo",
        "id",
        "nombre",
        "proyecto",
        "fecha",
        "estado",
        "prioridad",
        "minutos",
        "segundos",
        "interrupciones",
      ],
      ...s.projects.map((p) => [
        "proyecto",
        p.id,
        p.name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]),
      ...s.tasks.map((t) => [
        "tarea",
        t.id,
        t.name,
        project(t.projectId)?.name ?? "",
        t.date,
        t.status,
        t.priority,
        t.estimate,
        "",
        "",
      ]),
      ...s.sessions.map((x) => [
        "registro",
        x.id,
        s.blocks.find((b) => b.id === x.blockId)?.name ?? x.blockId,
        "",
        x.date,
        "",
        "",
        "",
        x.seconds,
        x.interruptions,
      ]),
    ];
    download(
      "\uFEFF" + rows.map((r) => r.map(quote).join(",")).join("\r\n"),
      "csv",
      "text/csv;charset=utf-8",
    );
  }
  async function restore(selected: File) {
    try {
      const data: unknown = JSON.parse(await selected.text());
      if (!validateState(data))
        throw new Error("Formato de respaldo inválido.");
      if (
        confirm(
          "¿Restaurar esta copia? Reemplazará los datos actuales. Exporta primero un respaldo si deseas conservarlos.",
        )
      ) {
        change(() => ({
          ...data,
          timer: data.timer
            ? { ...data.timer, elapsed: elapsed(data.timer), startedAt: null }
            : null,
        }));
        setNotice("Copia restaurada.");
      }
    } catch (e) {
      setError(String(e));
    }
  }
  const taskList = (tasks: Task[]) => (
    <TaskList
      tasks={tasks}
      projects={s.projects}
      onComplete={(id) => change((st) => completeTask(st, id))}
      onEdit={setModal}
      onReschedule={reschedule}
      onDrag={(id) => {
        drag.current = "task:" + id;
      }}
    />
  );
  const agenda = (selected: string, compact = false) => {
    const rows = schedule(s, selected);
    return rows.length ? (
      <div className={`timeline ${compact ? "compact" : ""}`}>
        {rows.map((b) => {
          const completed = (s.completions[selected] ?? []).includes(b.id);
          const active =
            selected === today && b.start <= minute && b.end > minute;
          return (
            <div
              className="time-row"
              key={b.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag.current.startsWith("task:")) {
                  const id = drag.current.slice(5);
                  change((st) => ({
                    ...st,
                    tasks: st.tasks.map((t) =>
                      t.id === id
                        ? {
                            ...t,
                            date: selected,
                            projectId: b.projectId,
                            blockId: b.id,
                            originDate: t.originDate ?? t.date,
                          }
                        : t,
                    ),
                  }));
                  drag.current = "";
                } else if (selected === date) reorder(b.id);
              }}
            >
              <span className="time-label">
                {clock(b.start)}
                <small>{clock(b.end)}</small>
              </span>
              <article
                className={`block ${active ? "active" : ""} ${completed ? "completed" : ""}`}
                style={
                  {
                    "--project-color": project(b.projectId)?.color ?? "#758361",
                  } as React.CSSProperties
                }
                draggable={!compact}
                onDragStart={() => {
                  drag.current = b.id;
                }}
              >
                <div className="block-top">
                  <span className="category">
                    {project(b.projectId)?.name ?? "Proyecto"}
                  </span>
                  {active && <span className="live">EN ESTE MOMENTO</span>}
                  {completed && <Check size={15} />}
                  <GripVertical className="grip" size={15} />
                </div>
                <h3>{b.name}</h3>
                {s.tasks
                  .filter((t) => t.date === selected && t.blockId === b.id)
                  .map((t) => (
                    <button
                      key={t.id}
                      className="calendar-task"
                      onClick={() => setModal(t)}
                    >
                      {t.status === "completada" ? "✓ " : ""}
                      {t.name}
                    </button>
                  ))}
                <div className="block-bottom">
                  <span>
                    <Clock3 size={13} />
                    {b.minutes} min{b.shopify ? " · Lunes Montana" : ""}
                  </span>
                  {!compact && (
                    <div className="block-actions">
                      <button
                        onClick={() => start(b.id)}
                        disabled={completed}
                        aria-label={`Iniciar ${b.name}`}
                      >
                        <Play size={13} /> Iniciar
                      </button>
                      {s.timer?.blockId === b.id &&
                        s.timer.startedAt !== null && (
                          <button onClick={pause}>
                            <Pause size={13} /> Pausar
                          </button>
                        )}
                      <button onClick={() => finish(b.id)} disabled={completed}>
                        <Check size={13} /> Completar
                      </button>
                      <button
                        onClick={() => {
                          change((st) => ({
                            ...st,
                            tasks: [
                              ...st.tasks,
                              {
                                id: uid(),
                                name: b.name,
                                description:
                                  "Actividad pospuesta desde " + selected,
                                notes: "",
                                projectId: b.projectId,
                                priority: "media",
                                date: shiftDate(selected, 1),
                                originDate: selected,
                                estimate: b.minutes,
                                status: "pendiente",
                                recurrence: "ninguna",
                                subtasks: [],
                              },
                            ],
                          }));
                          setNotice(
                            "Actividad añadida a las tareas de mañana.",
                          );
                        }}
                      >
                        Posponer
                      </button>
                      <button
                        onClick={() => {
                          const minutes = Number(
                            prompt(
                              "Duración en minutos (la jornada se ajusta automáticamente)",
                              String(b.minutes),
                            ),
                          );
                          if (!Number.isFinite(minutes) || minutes < 1) return;
                          const updated = rows.map(
                            ({ start: _a, end: _b, ...x }) =>
                              x.id === b.id
                                ? { ...x, minutes: x.shopify ? 60 : minutes }
                                : x,
                          );
                          change((st) => ({
                            ...st,
                            overrides: { ...st.overrides, [selected]: updated },
                          }));
                        }}
                      >
                        Reprogramar
                      </button>
                    </div>
                  )}
                </div>
              </article>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="empty">
        <Sun size={24} />
        <p>Un espacio para descansar</p>
        <small>No hay bloques recurrentes el fin de semana.</small>
      </div>
    );
  };
  return (
    <div className={s.settings.dark ? "app dark" : "app"}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div>
            MONTANA<small>AGENDA</small>
          </div>
        </div>
        <div className="workspace-label">TU ESPACIO DE TRABAJO</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={page === n.name ? "selected" : ""}
              onClick={() => setPage(n.name)}
            >
              <n.icon size={19} />
              {n.name}
              {n.name === "Tareas" && backlog.length > 0 && (
                <span className="nav-count">{backlog.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-projects">
          <div className="workspace-label">PROYECTOS</div>
          {s.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setFilter({ ...filter, project: p.id });
                setPage("Tareas");
              }}
            >
              <i style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button
            onClick={() => setPage("Ajustes")}
            className={page === "Ajustes" ? "selected" : ""}
          >
            <Settings size={18} /> Ajustes
          </button>
          <div className="profile">
            <span>SM</span>
            <div>
              Sombreros Montana<small>Un día a la vez.</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Mi espacio <ChevronRight size={14} /> <strong>{page}</strong>
          </div>
          <div className="header-right">
            <span className="save-state">
              <i />
              {saveStatus}
            </span>
            <button
              className="icon-button"
              aria-label="Cambiar tema"
              onClick={() =>
                change((st) => ({
                  ...st,
                  settings: { ...st.settings, dark: !st.settings.dark },
                }))
              }
            >
              {s.settings.dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="alert">
              {error}
              <button aria-label="Cerrar error" onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button aria-label="Cerrar aviso" onClick={() => setNotice("")}>
                <X size={17} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Mi día"
                  ? "MENOS RUIDO, MÁS ENFOQUE"
                  : "MONTANA AGENDA"}
              </div>
              <h1>{page === "Mi día" ? "Tu día, con intención." : page}</h1>
              <p>
                {page === "Mi día"
                  ? "Un espacio para avanzar en lo que importa."
                  : {
                      Calendario: "Haz espacio para tus prioridades.",
                      Tareas: "De la idea al siguiente paso.",
                      Proyectos: "Cada proyecto, en su lugar.",
                      Estadísticas: "Observa tu ritmo. Ajusta con calma.",
                      Ajustes: "Tu agenda, a tu manera.",
                    }[page as Exclude<Page, "Mi día">]}
              </p>
            </div>
            <button className="primary" onClick={() => setModal(null)}>
              <Plus size={17} /> Nueva tarea
            </button>
          </div>
          {(page === "Mi día" || page === "Calendario") && (
            <div className="date-bar">
              <div>
                <button
                  className="icon-button"
                  aria-label="Fecha anterior"
                  onClick={() => setDate(shiftDate(date, -1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Fecha siguiente"
                  onClick={() => setDate(shiftDate(date, 1))}
                >
                  <ChevronRight size={18} />
                </button>
                <strong>{dateLabel(date)}</strong>
                {date === today && <span className="pill">HOY</span>}
              </div>
              <div>
                <button className="subtle" onClick={() => setDate(today)}>
                  Hoy
                </button>
                <input
                  aria-label="Fecha de agenda"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || today)}
                />
                {page === "Calendario" && (
                  <select
                    aria-label="Vista del calendario"
                    value={calendar}
                    onChange={(e) =>
                      setCalendar(e.target.value as typeof calendar)
                    }
                  >
                    <option>día</option>
                    <option>semana</option>
                    <option>mes</option>
                  </select>
                )}
              </div>
            </div>
          )}
          {page === "Mi día" && (
            <>
              <div className="summary-grid">
                <div className="summary">
                  <span>JORNADA COMPLETADA</span>
                  <strong>
                    {progress}
                    <small>%</small>
                  </strong>
                  <div className="progress-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <small>
                    {done.length} de {blocks.length} bloques completados
                  </small>
                </div>
                <div className="summary">
                  <span>TIEMPO REGISTRADO</span>
                  <strong>
                    {duration(
                      s.sessions
                        .filter((x) => x.date === date)
                        .reduce((a, x) => a + x.seconds, 0) +
                        (s.timer?.date === date ? elapsed(s.timer, now) : 0),
                    ).slice(0, 5)}
                    <small> h</small>
                  </strong>
                  <small>
                    De {((s.settings.end - s.settings.start) / 60).toFixed(1)}{" "}
                    horas disponibles
                  </small>
                </div>
                <div className="summary">
                  <span>TAREAS DEL DÍA</span>
                  <strong>
                    {dayTasks.filter((t) => t.status === "completada").length}
                    <small> / {dayTasks.length}</small>
                  </strong>
                  <small>
                    {
                      dayTasks.filter(
                        (t) =>
                          t.priority === "alta" && t.status !== "completada",
                      ).length
                    }{" "}
                    con prioridad alta
                  </small>
                </div>
              </div>
              <div className="day-layout">
                <section className="panel agenda-panel">
                  <div className="section-heading">
                    <div>
                      <h2>La agenda de hoy</h2>
                      <p>
                        {clock(s.settings.start)} — {clock(s.settings.end)} · Tu
                        jornada de trabajo
                      </p>
                    </div>
                    <span className="pill">
                      {blocks.reduce((a, b) => a + b.minutes, 0)} MIN
                    </span>
                  </div>
                  {new Date(`${date}T12:00:00`).getDay() === 1 && (
                    <div className="monday-note">
                      Los lunes, una hora para Shopify. Todo dentro de tu
                      jornada.
                    </div>
                  )}
                  {agenda(date)}
                </section>
                <aside className="day-side">
                  <section className="focus-card">
                    <div className="eyebrow">
                      <span className="focus-dot" /> TU MOMENTO DE ENFOQUE
                    </div>
                    <h2>
                      {s.timer
                        ? (blocks.find((b) => b.id === s.timer?.blockId)
                            ?.name ?? "Actividad en curso")
                        : (current?.name ?? "Encuentra tu ritmo")}
                    </h2>
                    <p>
                      {s.timer
                        ? "El tiempo se guarda automáticamente."
                        : next
                          ? `A continuación: ${next.name}`
                          : "Elige un bloque para comenzar."}
                    </p>
                    <div className="timer">
                      {s.timer ? duration(elapsed(s.timer, now)) : "00:00:00"}
                    </div>
                    {s.timer ? (
                      <div className="timer-controls">
                        <button
                          className="primary"
                          onClick={() =>
                            s.timer?.startedAt !== null
                              ? pause()
                              : start(s.timer!.blockId)
                          }
                        >
                          {s.timer.startedAt !== null ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}{" "}
                          {s.timer.startedAt !== null ? "Pausar" : "Continuar"}
                        </button>
                        <button
                          className="subtle"
                          onClick={() => change((st) => finishTimer(st))}
                        >
                          Finalizar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="primary"
                        disabled={!blocks.length}
                        onClick={() => start(current?.id ?? blocks[0].id)}
                      >
                        <Play size={16} /> Empezar a trabajar
                      </button>
                    )}
                    <small>Un paso a la vez también es avanzar.</small>
                  </section>
                  <section className="panel priorities">
                    <div className="section-heading">
                      <h2>Prioridades del día</h2>
                      <span>
                        {
                          dayTasks.filter((t) => t.status !== "completada")
                            .length
                        }
                      </span>
                    </div>
                    {taskList(
                      dayTasks
                        .filter((t) => t.status !== "completada")
                        .sort(
                          (a, b) =>
                            ["alta", "media", "baja"].indexOf(a.priority) -
                            ["alta", "media", "baja"].indexOf(b.priority),
                        ),
                    )}
                    <button className="add-link" onClick={() => setModal(null)}>
                      <Plus size={15} /> Añadir una tarea
                    </button>
                  </section>
                  <div className="quiet-note">
                    “El secreto de avanzar es comenzar.”
                    <span>Haz de hoy un buen día.</span>
                  </div>
                </aside>
              </div>
            </>
          )}
          {page === "Tareas" && (
            <>
              <div className="filters">
                <select
                  aria-label="Filtrar proyecto"
                  value={filter.project}
                  onChange={(e) =>
                    setFilter({ ...filter, project: e.target.value })
                  }
                >
                  <option value="">Todos los proyectos</option>
                  {s.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar prioridad"
                  value={filter.priority}
                  onChange={(e) =>
                    setFilter({ ...filter, priority: e.target.value })
                  }
                >
                  <option value="">Todas las prioridades</option>
                  {["alta", "media", "baja"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar estado"
                  value={filter.status}
                  onChange={(e) =>
                    setFilter({ ...filter, status: e.target.value })
                  }
                >
                  <option value="">Todos los estados</option>
                  {["pendiente", "en progreso", "completada", "bloqueada"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </div>
              {backlog.length > 0 && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>Bandeja de reprogramación</h2>
                    <span className="pill">{backlog.length} PENDIENTES</span>
                  </div>
                  <p>
                    Las fechas originales permanecen en el historial. Reprograma
                    cuando estés listo.
                  </p>
                  {taskList(backlog)}
                </section>
              )}
              <section className="panel">
                <div className="section-heading">
                  <h2>Todas tus tareas</h2>
                </div>
                {taskList(
                  s.tasks.filter(
                    (t) =>
                      (!filter.project || t.projectId === filter.project) &&
                      (!filter.priority || t.priority === filter.priority) &&
                      (!filter.status || t.status === filter.status),
                  ),
                )}
              </section>
            </>
          )}
          {page === "Calendario" &&
            (calendar === "día" ? (
              <section className="panel">
                {agenda(date)}
                {taskList(dayTasks)}
              </section>
            ) : (
              <div
                className={calendar === "semana" ? "week-grid" : "month-grid"}
              >
                {Array.from(
                  {
                    length:
                      calendar === "semana"
                        ? 7
                        : new Date(
                            Number(date.slice(0, 4)),
                            Number(date.slice(5, 7)),
                            0,
                          ).getDate(),
                  },
                  (_, i) => {
                    const weekday = new Date(`${date}T12:00:00`).getDay();
                    const selected =
                      calendar === "semana"
                        ? shiftDate(date, -((weekday + 6) % 7) + i)
                        : `${date.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`;
                    const daily = s.tasks.filter((t) => t.date === selected);
                    return (
                      <section
                        key={selected}
                        className={`calendar-day ${selected === today ? "today" : ""}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (drag.current.startsWith("task:")) {
                            const id = drag.current.slice(5);
                            change((st) => ({
                              ...st,
                              tasks: st.tasks.map((t) =>
                                t.id === id
                                  ? {
                                      ...t,
                                      date: selected,
                                      originDate: t.originDate ?? t.date,
                                    }
                                  : t,
                              ),
                            }));
                            drag.current = "";
                          }
                        }}
                      >
                        <button
                          className="calendar-date"
                          onClick={() => {
                            setDate(selected);
                            setCalendar("día");
                          }}
                        >
                          {new Date(selected + "T12:00:00").toLocaleDateString(
                            "es-CO",
                            { weekday: "short", day: "numeric" },
                          )}
                        </button>
                        {calendar === "semana" ? (
                          agenda(selected, true)
                        ) : (
                          <small>
                            {schedule(s, selected).length} bloques ·{" "}
                            {daily.length} tareas
                          </small>
                        )}
                        {daily.map((t) => (
                          <button
                            key={t.id}
                            className={`calendar-task ${t.status === "completada" ? "finished" : ""}`}
                            draggable
                            onDragStart={() => {
                              drag.current = "task:" + t.id;
                            }}
                            onClick={() => setModal(t)}
                          >
                            {t.status === "completada" ? "✓ " : ""}
                            {t.name}
                          </button>
                        ))}
                      </section>
                    );
                  },
                )}
              </div>
            ))}
          {page === "Proyectos" && <Projects state={s} change={change} />}
          {page === "Estadísticas" && <Statistics state={s} />}
          {page === "Estadísticas" && s.sessions.length > 0 && (
            <section className="panel">
              <h2>Duración prevista y real</h2>
              {s.sessions
                .slice(-10)
                .reverse()
                .map((x) => (
                  <div className="stat-row" key={x.id}>
                    <span>
                      {x.blockName ?? x.blockId} · {x.date}
                    </span>
                    <strong>
                      {x.estimatedMinutes ?? "—"} min previstos ·{" "}
                      {Math.round(x.seconds / 60)} min reales ·{" "}
                      {x.interruptions} interrupciones
                    </strong>
                  </div>
                ))}
            </section>
          )}
          {page === "Ajustes" && (
            <>
              <section className="panel settings">
                <h2>Jornada y bloques recurrentes</h2>
                <p>
                  Lunes a viernes. El cierre no puede superar las 14:00. Los
                  lunes se reserva una hora para Shopify.
                </p>
                <div className="form-grid">
                  <label>
                    Inicio de jornada
                    <input
                      type="time"
                      value={clock(s.settings.start)}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number),
                          v = h * 60 + m;
                        if (v >= 0 && v <= s.settings.end - 60)
                          change((st) => ({
                            ...st,
                            settings: { ...st.settings, start: v },
                          }));
                        else
                          setError("La jornada debe durar al menos una hora.");
                      }}
                    />
                  </label>
                  <label>
                    Fin de jornada
                    <input
                      type="time"
                      max="14:00"
                      value={clock(s.settings.end)}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number),
                          v = h * 60 + m;
                        if (v <= 840 && v >= s.settings.start + 60)
                          change((st) => ({
                            ...st,
                            settings: { ...st.settings, end: v },
                          }));
                        else
                          setError(
                            "El cierre debe ser antes de las 14:00, con al menos una hora de jornada.",
                          );
                      }}
                    />
                  </label>
                </div>
                {s.blocks.map((b, i) => (
                  <div className="block-setting" key={b.id}>
                    <input
                      aria-label={`Nombre bloque ${i + 1}`}
                      value={b.name}
                      onChange={(e) =>
                        change((st) => ({
                          ...st,
                          blocks: st.blocks.map((x) =>
                            x.id === b.id ? { ...x, name: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                    <select
                      aria-label={`Proyecto bloque ${i + 1}`}
                      value={b.projectId}
                      onChange={(e) =>
                        change((st) => ({
                          ...st,
                          blocks: st.blocks.map((x) =>
                            x.id === b.id
                              ? { ...x, projectId: e.target.value }
                              : x,
                          ),
                        }))
                      }
                    >
                      {s.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Minutos bloque ${i + 1}`}
                      type="number"
                      min="1"
                      max="270"
                      value={b.minutes}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= 1 && v <= 270)
                          change((st) => ({
                            ...st,
                            blocks: st.blocks.map((x) =>
                              x.id === b.id ? { ...x, minutes: v } : x,
                            ),
                          }));
                      }}
                    />
                    <small>min</small>
                  </div>
                ))}
                <button
                  className="subtle"
                  onClick={() => {
                    if (confirm("¿Eliminar los ajustes de agenda por fecha?"))
                      change((st) => ({ ...st, overrides: {} }));
                  }}
                >
                  Restablecer reprogramaciones de bloques
                </button>
              </section>
              <section className="panel">
                <h2>Recordatorios locales</h2>
                <p>
                  Recibe avisos al empezar y terminar bloques y al cerrar la
                  jornada. La aplicación debe permanecer abierta.
                </p>
                <button
                  className="subtle"
                  onClick={async () => {
                    if (s.settings.notifications) {
                      change((st) => ({
                        ...st,
                        settings: { ...st.settings, notifications: false },
                      }));
                      return;
                    }
                    try {
                      const allowed = isTauri()
                        ? (await isPermissionGranted()) ||
                          (await requestPermission()) === "granted"
                        : "Notification" in window &&
                          (await Notification.requestPermission()) ===
                            "granted";
                      if (allowed)
                        change((st) => ({
                          ...st,
                          settings: { ...st.settings, notifications: true },
                        }));
                      else
                        setError("No se concedió permiso para notificaciones.");
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  {s.settings.notifications
                    ? "Desactivar recordatorios"
                    : "Activar recordatorios"}
                </button>
              </section>
              <section className="panel">
                <h2>Tus datos son tuyos</h2>
                <p>
                  SQLite local, sin cuenta ni servicios de pago. Exporta una
                  copia periódica para conservar tu historial.
                </p>
                <div className="backup-actions">
                  <button
                    className="subtle"
                    onClick={() =>
                      download(
                        JSON.stringify(s, null, 2),
                        "json",
                        "application/json",
                      )
                    }
                  >
                    <Download size={16} /> Copia JSON
                  </button>
                  <button className="subtle" onClick={exportCsv}>
                    <Download size={16} /> Exportar CSV
                  </button>
                  <button
                    className="subtle"
                    onClick={() => file.current?.click()}
                  >
                    <Upload size={16} /> Restaurar copia
                  </button>
                  <input
                    ref={file}
                    hidden
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void restore(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              </section>
            </>
          )}
          <footer>
            <span>MONTANA AGENDA</span>
            <span>Tu trabajo, a tu ritmo. · Almacenamiento local</span>
          </footer>
        </div>
      </main>
      {modal !== undefined && (
        <TaskEditor
          task={modal}
          date={date}
          state={s}
          close={() => setModal(undefined)}
          save={(t) => {
            change((st) => {
              const previous = st.tasks.find((x) => x.id === t.id);
              const updated = {
                ...st,
                tasks: previous
                  ? st.tasks.map((x) => (x.id === t.id ? t : x))
                  : [...st.tasks, t],
              };
              return t.status === "completada" &&
                previous?.status !== "completada"
                ? completeTask(
                    {
                      ...updated,
                      tasks: updated.tasks.map((x) =>
                        x.id === t.id ? { ...x, status: "pendiente" } : x,
                      ),
                    },
                    t.id,
                  )
                : updated;
            });
            setModal(undefined);
          }}
          remove={(id) => {
            if (confirm("¿Eliminar esta tarea?")) {
              change((st) => ({
                ...st,
                tasks: st.tasks.filter((t) => t.id !== id),
              }));
              setModal(undefined);
            }
          }}
        />
      )}
    </div>
  );
}
