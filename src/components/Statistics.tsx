import { localDate, shiftDate, schedule, type State } from "../domain";
export default function Statistics({ state: s }: { state: State }) {
  const today = localDate();
  const backlog = s.tasks.filter(
    (t) => t.date < today && t.status !== "completada",
  );
  return (
    <>
      <div className="summary-grid">
        <div className="summary">
          <span>TIEMPO REGISTRADO TOTAL</span>
          <strong>
            {(s.sessions.reduce((a, x) => a + x.seconds, 0) / 3600).toFixed(1)}
            <small> h</small>
          </strong>
        </div>
        <div className="summary">
          <span>TAREAS COMPLETADAS</span>
          <strong>
            {s.tasks.length
              ? Math.round(
                  (s.tasks.filter((t) => t.status === "completada").length /
                    s.tasks.length) *
                    100,
                )
              : 0}
            <small>%</small>
          </strong>
        </div>
        <div className="summary">
          <span>PENDIENTES VENCIDOS</span>
          <strong>{backlog.length}</strong>
        </div>
      </div>
      <section className="panel">
        <h2>Tu semana de trabajo</h2>
        <div className="chart">
          {Array.from({ length: 7 }, (_, i) => {
            const d = shiftDate(today, -6 + i);
            const seconds = s.sessions
              .filter((x) => x.date === d)
              .reduce((a, x) => a + x.seconds, 0);
            return (
              <div key={d}>
                <span>{(seconds / 3600).toFixed(1)} h</span>
                <i
                  style={{
                    height: Math.min(150, seconds / 108) + "px",
                  }}
                />
                <small>
                  {new Date(d + "T12:00:00").toLocaleDateString("es-CO", {
                    weekday: "short",
                  })}
                </small>
              </div>
            );
          })}
        </div>
        <p>
          Cumplimiento:{" "}
          {(() => {
            let total = 0,
              completed = 0;
            for (let i = 0; i < 7; i++) {
              const d = shiftDate(today, -6 + i),
                slots = schedule(s, d);
              total += slots.length;
              completed += slots.filter((b) =>
                (s.completions[d] ?? []).includes(b.id),
              ).length;
            }
            return total ? Math.round((completed / total) * 100) : 0;
          })()}
          % de los bloques en los últimos 7 días.
        </p>
      </section>
      <section className="panel">
        <h2>Tiempo por proyecto</h2>
        {s.projects.map((p) => {
          const seconds = s.sessions
            .filter(
              (x) =>
                (x.projectId ??
                  s.blocks.find((b) => b.id === x.blockId)?.projectId) ===
                  p.id ||
                (x.blockId === "shopify" && p.id === "operations"),
            )
            .reduce((a, x) => a + x.seconds, 0);
          return (
            <div key={p.id} className="stat-row">
              <span>
                <i style={{ background: p.color }} />
                {p.name}
              </span>
              <strong>{(seconds / 3600).toFixed(2)} h</strong>
            </div>
          );
        })}
      </section>
    </>
  );
}
