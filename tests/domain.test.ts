import { describe, it, expect } from "vitest";
import {
  initialState,
  schedule,
  elapsed,
  finishTimer,
  completeTask,
  validateState,
  shiftDate,
  type Task,
} from "../src/domain";
const task: Task = {
  id: "t1",
  name: "Pruebas",
  description: "",
  notes: "",
  projectId: "factory1",
  priority: "alta",
  date: "2026-10-05",
  estimate: 30,
  status: "pendiente",
  recurrence: "diaria",
  subtasks: [{ id: "s1", name: "Revisar", done: true }],
};
describe("planificación", () => {
  it("mantiene el horario inicial de 270 minutos", () => {
    const blocks = schedule(initialState(), "2026-10-06");
    expect(blocks.map((b) => [b.start, b.end])).toEqual([
      [570, 630],
      [630, 690],
      [690, 720],
      [720, 780],
      [780, 840],
    ]);
  });
  it("reserva exactamente una hora Shopify sin extender el lunes", () => {
    const blocks = schedule(initialState(), "2026-10-05");
    expect(blocks.find((b) => b.shopify)?.minutes).toBe(60);
    expect(blocks.at(-1)?.end).toBe(840);
    expect(blocks.reduce((a, b) => a + b.minutes, 0)).toBe(270);
  });
  it("no duplica Shopify con ajustes y reduce bloques largos", () => {
    const s = initialState();
    s.overrides["2026-10-05"] = schedule(s, "2026-10-05");
    s.blocks[0].minutes = 300;
    expect(schedule(s, "2026-10-05").filter((b) => b.shopify)).toHaveLength(1);
    expect(schedule(s, "2026-10-06").at(-1)?.end).toBe(840);
  });
  it("no agenda fin de semana", () => {
    expect(schedule(initialState(), "2026-10-10")).toEqual([]);
  });
  it("ajusta una jornada corta conservando Shopify", () => {
    const s = initialState();
    s.settings.start = 780;
    const b = schedule(s, "2026-10-05");
    expect(b.find((x) => x.shopify)?.minutes).toBe(60);
    expect(b.at(-1)?.end).toBe(840);
  });
  it("maneja cambios de mes", () =>
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01"));
});
describe("tiempo e historial", () => {
  it("recupera tiempo transcurrido y pausado", () => {
    const t = {
      blockId: "b1",
      date: "2026-10-05",
      elapsed: 10,
      startedAt: 1000,
      interruptions: 0,
    };
    expect(elapsed(t, 5100)).toBe(14);
    expect(elapsed({ ...t, startedAt: null }, 9999)).toBe(10);
  });
  it("registra tiempo real al finalizar", () => {
    const s = initialState();
    s.timer = {
      blockId: "b1",
      date: "2026-10-05",
      elapsed: 20,
      startedAt: 1000,
      interruptions: 2,
    };
    const result = finishTimer(s, 11000);
    expect(result.timer).toBeNull();
    expect(result.sessions[0].seconds).toBe(30);
    expect(result.sessions[0].interruptions).toBe(2);
  });
  it("genera siguiente recurrencia sin borrar historial", () => {
    const s = initialState();
    s.tasks = [task];
    const result = completeTask(s, "t1");
    expect(result.tasks[0].date).toBe("2026-10-05");
    expect(result.tasks[0].status).toBe("completada");
    expect(result.tasks[1].date).toBe("2026-10-06");
    expect(result.tasks[1].subtasks[0].done).toBe(false);
  });
  it("rechaza respaldos malformados", () => {
    expect(validateState(initialState())).toBe(true);
    expect(validateState({ version: 1 })).toBe(false);
    const s = initialState();
    s.tasks = [{ ...task, estimate: -1 }];
    expect(validateState(s)).toBe(false);
  });
});

import { materializeRecurrences } from "../src/domain";
describe("recurrencia independiente", () => {
  it("genera ocurrencias aunque la tarea anterior esté pendiente", () => {
    const s = initialState();
    s.tasks = [task];
    const result = materializeRecurrences(s, "2026-10-07");
    expect(result.tasks.map((t) => t.date)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ]);
    expect(result.tasks.every((t) => t.status === "pendiente")).toBe(true);
    expect(materializeRecurrences(result, "2026-10-07")).toBe(result);
  });
  it("completar una ocurrencia no duplica la siguiente", () => {
    const s = initialState();
    s.tasks = [task];
    const result = completeTask(materializeRecurrences(s, "2026-10-07"), "t1");
    expect(result.tasks).toHaveLength(3);
    expect(completeTask(result, "t1")).toBe(result);
  });
  it("preserva la fecha de una ocurrencia reprogramada", () => {
    const s = initialState();
    s.tasks = [{ ...task, date: "2026-10-08", originDate: "2026-10-05" }];
    const result = materializeRecurrences(s, "2026-10-08");
    expect(
      result.tasks.filter((t) => t.originDate === "2026-10-05"),
    ).toHaveLength(1);
    expect(result.tasks.filter((t) => t.date === "2026-10-06")).toHaveLength(1);
  });
  it("repite semanalmente en el mismo día", () => {
    const s = initialState();
    s.tasks = [{ ...task, recurrence: "semanal" }];
    expect(
      materializeRecurrences(s, "2026-10-19").tasks.map((t) => t.date),
    ).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
  });
});
