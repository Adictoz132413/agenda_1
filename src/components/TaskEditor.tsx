import { useState, useRef, useEffect, type FormEvent } from "react";
import { X } from "lucide-react";
import { schedule, uid, type Task, type State } from "../domain";
export default function TaskEditor({
  task,
  date,
  state,
  close,
  save,
  remove,
}: {
  task: Task | null;
  date: string;
  state: State;
  close: () => void;
  save: (t: Task) => void;
  remove: (id: string) => void;
}) {
  const [value, setValue] = useState<Task>(
    task ?? {
      id: uid(),
      name: "",
      description: "",
      notes: "",
      projectId: "",
      priority: "media",
      date,
      estimate: 30,
      status: "pendiente",
      recurrence: "ninguna",
      subtasks: [],
    },
  );
  const [subtask, setSubtask] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const update = (patch: Partial<Task>) =>
    setValue((v) => ({ ...v, ...patch }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.name.trim()) save({ ...value, name: value.name.trim() });
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const items = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button,input,select,textarea",
              ),
            ).filter((x) => !x.hasAttribute("disabled"));
            const first = items[0],
              last = items.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="section-heading">
          <h2 id="task-title">{task ? "Editar tarea" : "Un nuevo paso"}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <label>
          Nombre
          <input
            ref={input}
            required
            maxLength={200}
            placeholder="¿Qué quieres hacer?"
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <label>
          Descripción
          <textarea
            value={value.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Proyecto
            <select
              value={value.projectId}
              onChange={(e) => update({ projectId: e.target.value })}
            >
              <option value="">Sin proyecto</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select
              value={value.priority}
              onChange={(e) =>
                update({ priority: e.target.value as Task["priority"] })
              }
            >
              {["alta", "media", "baja"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input
              type="date"
              required
              value={value.date}
              onChange={(e) => update({ date: e.target.value })}
            />
          </label>
          <label>
            Duración estimada (min)
            <input
              type="number"
              min="1"
              max="1440"
              required
              value={value.estimate}
              onChange={(e) => update({ estimate: Number(e.target.value) })}
            />
          </label>
          <label>
            Estado
            <select
              value={value.status}
              onChange={(e) =>
                update({ status: e.target.value as Task["status"] })
              }
            >
              {["pendiente", "en progreso", "completada", "bloqueada"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Repetición
            <select
              value={value.recurrence}
              onChange={(e) =>
                update({ recurrence: e.target.value as Task["recurrence"] })
              }
            >
              {["ninguna", "diaria", "semanal"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Bloque de agenda
          <select
            aria-label="Bloque de agenda"
            value={value.blockId ?? ""}
            onChange={(e) => {
              const block = schedule(state, value.date).find(
                (b) => b.id === e.target.value,
              );
              update({
                blockId: e.target.value || undefined,
                ...(block ? { projectId: block.projectId } : {}),
              });
            }}
          >
            <option value="">Sin bloque</option>
            {schedule(state, value.date).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notas
          <textarea
            value={value.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
        <label>Subtareas</label>
        {value.subtasks.map((x) => (
          <label className="subtask" key={x.id}>
            <input
              type="checkbox"
              checked={x.done}
              onChange={(e) =>
                update({
                  subtasks: value.subtasks.map((y) =>
                    y.id === x.id ? { ...y, done: e.target.checked } : y,
                  ),
                })
              }
            />
            {x.name}
            <button
              type="button"
              aria-label={`Eliminar subtarea ${x.name}`}
              onClick={() =>
                update({
                  subtasks: value.subtasks.filter((y) => y.id !== x.id),
                })
              }
            >
              <X size={14} />
            </button>
          </label>
        ))}
        <div className="subtask-input">
          <input
            aria-label="Nueva subtarea"
            value={subtask}
            onChange={(e) => setSubtask(e.target.value)}
          />
          <button
            type="button"
            className="subtle"
            onClick={() => {
              if (subtask.trim()) {
                update({
                  subtasks: [
                    ...value.subtasks,
                    { id: uid(), name: subtask.trim(), done: false },
                  ],
                });
                setSubtask("");
              }
            }}
          >
            Añadir
          </button>
        </div>
        <div className="modal-footer">
          {task && (
            <button
              type="button"
              className="danger"
              onClick={() => remove(task.id)}
            >
              Eliminar
            </button>
          )}
          <button type="button" className="subtle" onClick={close}>
            Cancelar
          </button>
          <button className="primary" type="submit">
            Guardar tarea
          </button>
        </div>
      </form>
    </div>
  );
}
