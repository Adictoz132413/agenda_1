import { describe, expect, it } from 'vitest';
import { buildIcs, dueReminders, isDue, nextOccurrence, scheduledAt } from '@/lib/reminderLogic';
import type { Reminder } from '@/domain/types';

const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m).getTime();
const TODAY = '2026-11-14';
const rem = (p: Partial<Reminder> = {}): Reminder => ({ id: 'r1', kind: 'comida', time: '13:00', enabled: true, ...p });

describe('cálculo de recordatorios', () => {
  it('hora programada en el día local', () => {
    expect(scheduledAt('13:00', at(9))).toBe(at(13));
  });
  it('no se dispara antes de la hora', () => {
    expect(isDue(rem(), at(12, 59), TODAY)).toBe(false);
  });
  it('se dispara dentro de las 2 horas siguientes', () => {
    expect(isDue(rem(), at(13), TODAY)).toBe(true);
    expect(isDue(rem(), at(14, 30), TODAY)).toBe(true);
    expect(isDue(rem(), at(15, 1), TODAY)).toBe(false);
  });
  it('no se repite el mismo día ni si está desactivado', () => {
    expect(isDue(rem({ lastFired: TODAY }), at(13, 5), TODAY)).toBe(false);
    expect(isDue(rem({ lastFired: '2026-11-13' }), at(13, 5), TODAY)).toBe(true);
    expect(isDue(rem({ enabled: false }), at(13, 5), TODAY)).toBe(false);
  });
  it('omite el resumen si la digestión ya fue valorada', () => {
    const list = [rem({ id: 'a', kind: 'resumen', time: '21:00' }), rem({ id: 'b', kind: 'agua', time: '21:00' })];
    expect(dueReminders(list, at(21, 10), TODAY, { digestionRated: true }).map((r) => r.id)).toEqual(['b']);
    expect(dueReminders(list, at(21, 10), TODAY, { digestionRated: false })).toHaveLength(2);
  });
  it('próxima ocurrencia hoy o mañana', () => {
    expect(nextOccurrence(rem(), at(9))).toBe(at(13));
    expect(nextOccurrence(rem(), at(14))).toBe(at(13) + 24 * 3600_000);
  });
});

describe('exportación .ics', () => {
  it('genera un evento diario con alarma', () => {
    const ics = buildIcs(rem({ time: '08:30', kind: 'deposicion' }), at(9), 'https://ejemplo.test/');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('DTSTART:20261115T083000'); // ya pasó hoy → mañana
    expect(ics).toContain('DTEND:20261115T084000');
    expect(ics).toContain('SUMMARY:DIGESTA: Registrar deposición');
    expect(ics).toContain('UID:digesta-r1@digesta.local');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });
  it('escapa comas y punto y coma', () => {
    const ics = buildIcs(rem({ kind: 'resumen', time: '21:00' }), at(9));
    expect(ics).toContain('DTSTART:20261114T210000');
    expect(ics).toMatch(/DESCRIPTION:.*hoy\? Completa/);
  });
});
