/** Selector rápido de fecha y hora: atajos + entradas nativas. */
import { useId } from 'react';
import { formatTime, fromDateTimeInputs, relativeDayLabel, dayKey, toDateInput, toTimeInput } from '@/domain/dates';
import { Chip, inputClass } from './ui';

const SHORTCUTS = [
  { label: 'Ahora', delta: 0 },
  { label: 'Hace 30 min', delta: 30 },
  { label: 'Hace 1 h', delta: 60 },
  { label: 'Hace 2 h', delta: 120 },
  { label: 'Hace 4 h', delta: 240 },
];

export function TimeField({ value, onChange, label = 'Fecha y hora' }: { value: number; onChange: (t: number) => void; label?: string }) {
  const id = useId();
  const now = Date.now();
  const active = SHORTCUTS.find((s) => Math.abs(now - s.delta * 60_000 - value) < 60_000);
  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 flex w-full items-baseline justify-between text-sm font-semibold">
        <span>{label}</span>
        <span className="text-muted">
          {relativeDayLabel(dayKey(value))} · {formatTime(value)}
        </span>
      </legend>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {SHORTCUTS.map((s) => (
          <Chip key={s.label} size="sm" selected={active === s} onClick={() => onChange(Date.now() - s.delta * 60_000)}>
            {s.label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="sr-only" htmlFor={`${id}-d`}>
          Fecha
        </label>
        <input
          id={`${id}-d`}
          type="date"
          className={inputClass}
          value={toDateInput(value)}
          max={toDateInput(now)}
          onChange={(e) => e.target.value && onChange(fromDateTimeInputs(e.target.value, toTimeInput(value)))}
        />
        <label className="sr-only" htmlFor={`${id}-t`}>
          Hora
        </label>
        <input id={`${id}-t`} type="time" className={inputClass} value={toTimeInput(value)} onChange={(e) => e.target.value && onChange(fromDateTimeInputs(toDateInput(value), e.target.value))} />
      </div>
    </fieldset>
  );
}
