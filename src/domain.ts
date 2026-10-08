export type Status = "pendiente" | "en progreso" | "completada" | "bloqueada";
export type Priority = "alta" | "media" | "baja";
export interface Project {
  id: string;
  name: string;
  color: string;
  categories: string[];
}
export interface Task {
  id: string;
  name: string;
  description: string;
  notes: string;
  projectId: string;
  priority: Priority;
  date: string;
  estimate: number;
  status: Status;
  recurrence: "ninguna" | "diaria" | "semanal";
  subtasks: { id: string; name: string; done: boolean }[];
  originDate?: string;
  blockId?: string;
  seriesId?: string;
}
export interface Block {
  id: string;
  name: string;
  projectId: string;
  minutes: number;
  shopify?: boolean;
}
export interface Session {
  id: string;
  blockId: string;
  date: string;
  seconds: number;
  interruptions: number;
  projectId?: string;
  estimatedMinutes?: number;
  blockName?: string;
}
export interface Timer {
  blockId: string;
  date: string;
  elapsed: number;
  startedAt: number | null;
  interruptions: number;
}
export interface State {
  version: 1;
  projects: Project[];
  tasks: Task[];
  blocks: Block[];
  sessions: Session[];
  timer: Timer | null;
  completions: Record<string, string[]>;
  overrides: Record<string, Block[]>;
  settings: {
    dark: boolean;
    notifications: boolean;
    start: number;
    end: number;
  };
}
export const uid = () => crypto.randomUUID();
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function initialState(): State {
  return {
    version: 1,
    projects: [
      {
        id: "factory1",
        name: "Fábrica · App 1",
        color: "#758361",
        categories: [
          "Programación",
          "Errores",
          "Nuevas funcionalidades",
          "Pruebas",
          "Mejoras",
          "Pendientes",
        ],
      },
      {
        id: "factory2",
        name: "Fábrica · App 2",
        color: "#a27b55",
        categories: [
          "Programación",
          "Errores",
          "Nuevas funcionalidades",
          "Pruebas",
          "Mejoras",
          "Pendientes",
        ],
      },
      {
        id: "store",
        name: "Tienda · App",
        color: "#7a8d9a",
        categories: [
          "Desarrollo",
          "Inventario",
          "Gestión de pedidos",
          "Automatizaciones",
          "Mejoras administrativas",
          "Integraciones futuras",
        ],
      },
      {
        id: "operations",
        name: "Montana · Operaciones",
        color: "#b48b73",
        categories: [
          "Pedidos",
          "Contenido",
          "Shopify",
          "WhatsApp Business",
          "Catálogo",
          "Publicidad",
          "Mejoras comerciales",
        ],
      },
    ],
    tasks: [],
    blocks: [
      {
        id: "b1",
        name: "Desarrollo App Fábrica 1",
        projectId: "factory1",
        minutes: 60,
      },
      {
        id: "b2",
        name: "Desarrollo App Fábrica 2",
        projectId: "factory2",
        minutes: 60,
      },
      {
        id: "b3",
        name: "Desarrollo App Tienda",
        projectId: "store",
        minutes: 30,
      },
      {
        id: "b4",
        name: "Pedidos y operaciones",
        projectId: "operations",
        minutes: 60,
      },
      {
        id: "b5",
        name: "Contenido, WhatsApp y mejoras",
        projectId: "operations",
        minutes: 60,
      },
    ],
    sessions: [],
    timer: null,
    completions: {},
    overrides: {},
    settings: { dark: false, notifications: false, start: 570, end: 840 },
  };
}
// Shopify always receives an hour on Mondays. Other activities share the remaining window.
export function schedule(state: State, date: string) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (weekday === 0 || weekday === 6) return [];
  let blocks = (state.overrides[date] ?? state.blocks).map((b) => ({ ...b }));
  const monday = weekday === 1;
  const capacity = state.settings.end - state.settings.start;
  if (monday) {
    blocks = blocks.filter((b) => !b.shopify);
    blocks.push({
      id: "shopify",
      name: "Página web Shopify",
      projectId: "operations",
      minutes: 60,
      shopify: true,
    });
  }
  const others = blocks.filter((b) => !b.shopify);
  const total = others.reduce((s, b) => s + b.minutes, 0);
  const available = capacity - (monday ? 60 : 0);
  if (total > available) {
    let remaining = available;
    others.forEach((b, i) => {
      b.minutes =
        i === others.length - 1
          ? remaining
          : Math.floor((b.minutes / total) * available);
      remaining -= b.minutes;
    });
  }
  let start = state.settings.start;
  return blocks
    .filter((b) => b.minutes > 0)
    .map((b) => {
      const slot = { ...b, start, end: start + b.minutes };
      start = slot.end;
      return slot;
    });
}
export function elapsed(timer: Timer, now = Date.now()) {
  return (
    timer.elapsed +
    (timer.startedAt === null
      ? 0
      : Math.max(0, Math.floor((now - timer.startedAt) / 1000)))
  );
}
export function finishTimer(state: State, now = Date.now()): State {
  if (!state.timer) return state;
  const t = state.timer;
  return {
    ...state,
    timer: null,
    sessions: [
      ...state.sessions,
      {
        id: uid(),
        date: t.date,
        blockId: t.blockId,
        seconds: elapsed(t, now),
        interruptions: t.interruptions,
        projectId: schedule(state, t.date).find((b) => b.id === t.blockId)
          ?.projectId,
        estimatedMinutes: schedule(state, t.date).find(
          (b) => b.id === t.blockId,
        )?.minutes,
        blockName: schedule(state, t.date).find((b) => b.id === t.blockId)
          ?.name,
      },
    ],
  };
}
export function completeTask(state: State, id: string): State {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.status === "completada") return state;
  const updated = { ...task, status: "completada" as const };
  const next =
    task.recurrence === "ninguna"
      ? []
      : [
          {
            ...task,
            id: uid(),
            seriesId: task.seriesId ?? task.id,
            date: shiftDate(
              task.originDate ?? task.date,
              task.recurrence === "diaria" ? 1 : 7,
            ),
            status: "pendiente" as const,
            subtasks: task.subtasks.map((s) => ({
              ...s,
              id: uid(),
              done: false,
            })),
            originDate: undefined,
          },
        ];
  return {
    ...state,
    tasks: [
      ...state.tasks.map((t) => (t.id === id ? updated : t)),
      ...next.filter(
        (n) =>
          !state.tasks.some(
            (t) =>
              (t.seriesId ?? t.id) === n.seriesId &&
              (t.originDate ?? t.date) === n.date,
          ),
      ),
    ],
  };
}

/** Materialize independent occurrences so an overdue task never stops its series. */
export function materializeRecurrences(state: State, through: string): State {
  const groups = new Map<string, Task[]>();
  for (const task of state.tasks) {
    if (task.recurrence === "ninguna") continue;
    const key = task.seriesId ?? task.id;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  const additions: Task[] = [];
  for (const [key, tasks] of groups) {
    const template = [...tasks].sort((a, b) =>
      (a.originDate ?? a.date).localeCompare(b.originDate ?? b.date),
    )[0];
    const existing = new Set(tasks.map((t) => t.originDate ?? t.date));
    let date = shiftDate(
      template.originDate ?? template.date,
      template.recurrence === "diaria" ? 1 : 7,
    );
    while (date <= through) {
      if (!existing.has(date))
        additions.push({
          ...template,
          id: uid(),
          seriesId: key,
          date,
          originDate: undefined,
          status: "pendiente",
          subtasks: template.subtasks.map((x) => ({
            ...x,
            id: uid(),
            done: false,
          })),
        });
      date = shiftDate(date, template.recurrence === "diaria" ? 1 : 7);
    }
  }
  return additions.length
    ? { ...state, tasks: [...state.tasks, ...additions] }
    : state;
}
export function validateState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const s = value as State;
  const str = (v: unknown) => typeof v === "string";
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const date = (v: unknown) =>
    str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string);
  const block = (b: Block) =>
    b &&
    str(b.id) &&
    str(b.name) &&
    str(b.projectId) &&
    num(b.minutes) &&
    b.minutes > 0;
  return (
    s.version === 1 &&
    Array.isArray(s.projects) &&
    s.projects.every(
      (p) =>
        p &&
        str(p.id) &&
        str(p.name) &&
        /^#[a-fA-F0-9]{6}$/.test(p.color) &&
        Array.isArray(p.categories) &&
        p.categories.every(str),
    ) &&
    Array.isArray(s.tasks) &&
    s.tasks.every(
      (t) =>
        t &&
        str(t.id) &&
        str(t.name) &&
        str(t.description) &&
        str(t.notes) &&
        str(t.projectId) &&
        date(t.date) &&
        ["alta", "media", "baja"].includes(t.priority) &&
        ["pendiente", "en progreso", "completada", "bloqueada"].includes(
          t.status,
        ) &&
        ["ninguna", "diaria", "semanal"].includes(t.recurrence) &&
        num(t.estimate) &&
        t.estimate > 0 &&
        Array.isArray(t.subtasks) &&
        t.subtasks.every(
          (x) => str(x.id) && str(x.name) && typeof x.done === "boolean",
        ),
    ) &&
    Array.isArray(s.blocks) &&
    s.blocks.length > 0 &&
    s.blocks.every(block) &&
    Array.isArray(s.sessions) &&
    s.sessions.every(
      (x) =>
        str(x.id) &&
        str(x.blockId) &&
        date(x.date) &&
        num(x.seconds) &&
        x.seconds >= 0 &&
        num(x.interruptions),
    ) &&
    (s.timer === null ||
      (s.timer &&
        str(s.timer.blockId) &&
        date(s.timer.date) &&
        num(s.timer.elapsed) &&
        num(s.timer.interruptions) &&
        (s.timer.startedAt === null || num(s.timer.startedAt)))) &&
    !!s.completions &&
    typeof s.completions === "object" &&
    Object.values(s.completions).every(
      (x) => Array.isArray(x) && x.every(str),
    ) &&
    !!s.overrides &&
    typeof s.overrides === "object" &&
    Object.values(s.overrides).every(
      (x) => Array.isArray(x) && x.every(block),
    ) &&
    !!s.settings &&
    typeof s.settings.dark === "boolean" &&
    typeof s.settings.notifications === "boolean" &&
    num(s.settings.start) &&
    num(s.settings.end) &&
    s.settings.start >= 0 &&
    s.settings.end <= 840 &&
    s.settings.end - s.settings.start >= 60
  );
}
