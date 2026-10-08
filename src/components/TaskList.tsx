import { Check, CalendarDays, ListTodo } from "lucide-react";
import type { Task, Project } from "../domain";
interface Props {
  tasks: Task[];
  projects: Project[];
  onComplete: (id: string) => void;
  onEdit: (t: Task) => void;
  onReschedule: (t: Task) => void;
  onDrag: (id: string) => void;
}
export default function TaskList({
  tasks,
  projects,
  onComplete,
  onEdit,
  onReschedule,
  onDrag,
}: Props) {
  const project = (id: string) => projects.find((p) => p.id === id);
  return tasks.length ? (
    <div className="task-list">
      {tasks.map((t) => (
        <div
          className={`task-row ${t.status === "completada" ? "finished" : ""}`}
          key={t.id}
          draggable
          onDragStart={() => {
            onDrag(t.id);
          }}
        >
          <button
            className="check"
            aria-label={`Completar ${t.name}`}
            disabled={t.status === "completada"}
            onClick={() => onComplete(t.id)}
          >
            {t.status === "completada" && <Check size={15} />}
          </button>
          <button className="task-text" onClick={() => onEdit(t)}>
            <strong>{t.name}</strong>
            <span>
              {project(t.projectId)?.name ?? "Sin proyecto"} · {t.estimate} min
              · {t.date}
              {t.originDate && ` · Original: ${t.originDate}`}
            </span>
          </button>
          <span className={`priority ${t.priority}`}>{t.priority}</span>
          <span className="task-state">{t.status}</span>
          <button
            className="icon-button"
            title="Reprogramar tarea"
            aria-label={`Reprogramar ${t.name}`}
            onClick={() => onReschedule(t)}
          >
            <CalendarDays size={17} />
          </button>
        </div>
      ))}
    </div>
  ) : (
    <div className="empty">
      <ListTodo size={25} />
      <p>Todo despejado por aquí</p>
      <small>Añade una tarea y dale un lugar en tu día.</small>
    </div>
  );
}
