import { FolderKanban, Plus } from "lucide-react";
import { uid, type State } from "../domain";
export default function Projects({
  state: s,
  change,
}: {
  state: State;
  change: (fn: (s: State) => State) => void;
}) {
  return (
    <div className="project-grid">
      {s.projects.map((p) => {
        const tasks = s.tasks.filter((t) => t.projectId === p.id),
          completed = tasks.filter((t) => t.status === "completada").length;
        return (
          <section className="panel project-card" key={p.id}>
            <div className="project-icon" style={{ color: p.color }}>
              <FolderKanban size={24} />
            </div>
            <h2>{p.name}</h2>
            <p>
              {tasks.length} tareas · {completed} completadas
            </p>
            <div className="progress-track">
              <i
                style={{
                  width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`,
                  background: p.color,
                }}
              />
            </div>
            <div className="tags">
              {p.categories.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <button
              className="subtle"
              onClick={() => {
                const name = prompt("Nombre del proyecto", p.name);
                if (name?.trim())
                  change((st) => ({
                    ...st,
                    projects: st.projects.map((x) =>
                      x.id === p.id ? { ...x, name: name.trim() } : x,
                    ),
                  }));
              }}
            >
              Editar nombre
            </button>
          </section>
        );
      })}
      <button
        className="new-project"
        onClick={() => {
          const name = prompt("Nombre del nuevo proyecto");
          if (name?.trim())
            change((st) => ({
              ...st,
              projects: [
                ...st.projects,
                {
                  id: uid(),
                  name: name.trim(),
                  color: "#758361",
                  categories: [],
                },
              ],
            }));
        }}
      >
        <Plus size={26} /> Crear proyecto
      </button>
    </div>
  );
}
