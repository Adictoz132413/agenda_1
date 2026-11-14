/** Factores del día que pueden influir en la digestión: estrés, sueño y ejercicio. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getDailyLog, patchDailyLog } from '@/db/repo';
import { relativeDayLabel } from '@/domain/dates';
import type { DailyLog } from '@/domain/types';
import { Button, Chip, Field, IntensitySlider, Segmented, Sheet, Stepper, TextArea, errorMessage, inputClass, useToast } from '@/components/ui';

const EXERCISES = ['Pesas', 'Correr', 'Caminar', 'Bicicleta', 'Fútbol', 'Natación', 'Yoga', 'Funcional'];

export function FactorsSheet({ open, onClose, day }: { open: boolean; onClose: () => void; day: string }) {
  const toast = useToast();
  const log = useLiveQuery(() => getDailyLog(day), [day]);
  const [stress, setStress] = useState<number | undefined>();
  const [sleepHours, setSleepHours] = useState<number | undefined>();
  const [sleepQuality, setSleepQuality] = useState<DailyLog['sleepQuality']>();
  const [exType, setExType] = useState('');
  const [exMin, setExMin] = useState(45);
  const [exInt, setExInt] = useState<'suave' | 'moderada' | 'intensa'>('moderada');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setStress(log?.stress);
    setSleepHours(log?.sleepHours);
    setSleepQuality(log?.sleepQuality);
    setExType(log?.exercise?.type ?? '');
    setExMin(log?.exercise?.minutes ?? 45);
    setExInt(log?.exercise?.intensity ?? 'moderada');
    setNotes(log?.notes ?? '');
    setError(undefined);
    // Sólo al abrir: no sobrescribir lo que se está editando si la base cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, log?.updatedAt]);

  const save = async () => {
    try {
      await patchDailyLog(day, {
        stress,
        sleepHours,
        sleepQuality,
        exercise: exType.trim() ? { type: exType.trim(), minutes: exMin, intensity: exInt } : undefined,
        notes: notes.trim() || undefined,
      });
      toast('Factores del día guardados');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Factores del día"
      description={`${relativeDayLabel(day)} · Todo es opcional`}
      footer={
        <Button size="lg" block onClick={save}>
          Guardar
        </Button>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          {error}
        </p>
      )}
      <Field label="Estrés">
        {stress === undefined ? (
          <Button variant="secondary" onClick={() => setStress(3)}>
            Registrar nivel de estrés
          </Button>
        ) : (
          <>
            <IntensitySlider label="Nivel de estrés" value={stress} onChange={setStress} word={stress <= 3 ? 'Bajo' : stress <= 6 ? 'Medio' : 'Alto'} />
            <button type="button" className="mt-1 text-sm font-semibold text-muted" onClick={() => setStress(undefined)}>
              Quitar
            </button>
          </>
        )}
      </Field>

      <Field label="Sueño de anoche">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {sleepHours === undefined ? (
            <Button variant="secondary" onClick={() => setSleepHours(7)}>
              Registrar horas de sueño
            </Button>
          ) : (
            <Stepper label="Horas de sueño" value={sleepHours} onChange={setSleepHours} min={0} max={16} step={0.5} unit="h" />
          )}
        </div>
        <Segmented
          className="mt-3"
          label="Calidad del sueño"
          value={sleepQuality}
          onChange={(v) => setSleepQuality(v === sleepQuality ? undefined : v)}
          options={[
            { value: 1, label: 'Mala' },
            { value: 2, label: 'Regular' },
            { value: 3, label: 'Buena' },
          ]}
        />
      </Field>

      <Field label="Ejercicio" hint="Deja el tipo vacío si no entrenaste.">
        <div className="mb-2 flex flex-wrap gap-2">
          {EXERCISES.map((e) => (
            <Chip key={e} size="sm" selected={exType === e} onClick={() => setExType(exType === e ? '' : e)}>
              {e}
            </Chip>
          ))}
        </div>
        <input aria-label="Tipo de ejercicio" className={inputClass} placeholder="Otro tipo de ejercicio" value={exType} maxLength={60} onChange={(e) => setExType(e.target.value)} />
        {exType.trim() && (
          <div className="mt-3 space-y-3">
            <Stepper label="Minutos de ejercicio" value={exMin} onChange={setExMin} min={5} max={600} step={5} unit="min" />
            <Segmented
              label="Intensidad del ejercicio"
              value={exInt}
              onChange={setExInt}
              options={[
                { value: 'suave', label: 'Suave' },
                { value: 'moderada', label: 'Moderada' },
                { value: 'intensa', label: 'Intensa' },
              ]}
            />
          </div>
        )}
      </Field>

      <Field label="Notas del día" htmlFor="day-notes">
        <TextArea id="day-notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Medicamentos, viajes, cambios de rutina…" />
      </Field>
    </Sheet>
  );
}
