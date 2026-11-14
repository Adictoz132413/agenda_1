/**
 * Registro de síntomas. Al crear se pueden marcar varios a la vez, cada uno
 * con su intensidad. Al editar se modifica un solo síntoma.
 */
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteSymptom, saveSymptom } from '@/db/repo';
import { SYMPTOMS, intensityWord, symptomDef } from '@/domain/labels';
import { formatDateTime, formatDuration, fromDateTimeInputs, toDateInput, toTimeInput } from '@/domain/dates';
import type { AbdomenZone, Symptom, SymptomType } from '@/domain/types';
import { symptomAlerts, type MedicalAlert } from '@/domain/alerts';
import { AbdomenMap } from '@/components/illustrations';
import { TimeField } from '@/components/TimeField';
import { Button, Chip, Field, IconButton, IntensitySlider, Segmented, Sheet, TextArea, cx, errorMessage, inputClass, useConfirm, useToast } from '@/components/ui';

interface Pick {
  type: SymptomType;
  intensity: number;
  location?: AbdomenZone;
  customName?: string;
}

type Status = 'en_curso' | 'termino' | 'duracion';
const DURATIONS = [15, 30, 60, 120, 240, 480];

export function SymptomSheet({
  open,
  onClose,
  symptom,
  initialType,
  initialAt,
  onAlerts,
}: {
  open: boolean;
  onClose: () => void;
  symptom?: Symptom;
  initialType?: SymptomType;
  initialAt?: number;
  onAlerts: (a: MedicalAlert[]) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [at, setAt] = useState(Date.now());
  const [status, setStatus] = useState<Status>('en_curso');
  const [endedAt, setEndedAt] = useState(Date.now());
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    if (symptom) {
      setPicks([{ type: symptom.type, intensity: symptom.intensity, location: symptom.location, customName: symptom.customName }]);
      setAt(symptom.startedAt);
      setStatus(symptom.endedAt ? 'termino' : symptom.durationMin ? 'duracion' : 'en_curso');
      setEndedAt(symptom.endedAt ?? Date.now());
      setDuration(symptom.durationMin ?? 60);
      setNotes(symptom.notes ?? '');
    } else {
      setPicks(initialType ? [{ type: initialType, intensity: 4 }] : []);
      setAt(initialAt ?? Date.now());
      setStatus('en_curso');
      setEndedAt(Date.now());
      setDuration(60);
      setNotes('');
    }
  }, [open, symptom, initialType, initialAt]);

  const toggle = (t: SymptomType) => {
    if (symptom) {
      setPicks((p) => [{ ...p[0], type: t }]);
      return;
    }
    setPicks((p) => (p.some((x) => x.type === t) ? p.filter((x) => x.type !== t) : [...p, { type: t, intensity: 4 }]));
    setError(undefined);
  };
  const update = (t: SymptomType, patch: Partial<Pick>) => setPicks((p) => p.map((x) => (x.type === t ? { ...x, ...patch } : x)));

  const save = async () => {
    if (!picks.length) {
      setError('Elige al menos un síntoma');
      return;
    }
    setSaving(true);
    try {
      const alerts: MedicalAlert[] = [];
      for (const p of picks) {
        const saved = await saveSymptom({
          id: symptom?.id,
          type: p.type,
          customName: p.customName,
          intensity: p.intensity,
          startedAt: at,
          endedAt: status === 'termino' ? endedAt : undefined,
          durationMin: status === 'duracion' ? duration : undefined,
          location: p.location,
          notes,
        });
        alerts.push(...symptomAlerts(saved));
      }
      toast(symptom ? 'Síntoma actualizado' : picks.length > 1 ? `${picks.length} síntomas registrados` : 'Síntoma registrado');
      onClose();
      if (alerts.length) onAlerts(alerts);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (symptom && (await confirm({ title: 'Eliminar síntoma', message: 'Se eliminará este registro.', confirmLabel: 'Eliminar', danger: true }))) {
      await deleteSymptom(symptom.id);
      toast('Síntoma eliminado');
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={symptom ? 'Editar síntoma' : 'Registrar síntoma'}
      description={symptom ? formatDateTime(symptom.startedAt) : 'Puedes marcar varios a la vez.'}
      footer={
        <div className="flex gap-2">
          {symptom && (
            <IconButton label="Eliminar síntoma" onClick={remove} className="border border-border text-bad">
              <Trash2 size={20} />
            </IconButton>
          )}
          <Button size="lg" block onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : symptom ? 'Guardar cambios' : `Guardar${picks.length > 1 ? ` (${picks.length})` : ''}`}
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2" role="group" aria-label="Síntomas">
        {SYMPTOMS.map((s) => {
          const sel = picks.some((p) => p.type === s.type);
          return (
            <button
              key={s.type}
              type="button"
              aria-pressed={sel}
              onClick={() => toggle(s.type)}
              className={cx('flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-[13px] font-semibold leading-tight transition active:scale-[0.97]', sel ? 'border-primary bg-primary-soft text-primary ring-2 ring-primary/30' : 'border-border bg-surface')}
            >
              <span className="text-2xl" aria-hidden>
                {s.emoji}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          {error}
        </p>
      )}

      {picks.map((p) => {
        const def = symptomDef(p.type);
        return (
          <div key={p.type} className="animate-pop mb-3 rounded-2xl border border-border bg-surface p-4">
            <p className="mb-3 font-bold">
              <span aria-hidden>{def.emoji}</span> {def.label}
            </p>
            {p.type === 'otro' && (
              <Field label="¿Qué síntoma?" htmlFor={`custom-${p.type}`}>
                <input id={`custom-${p.type}`} className={inputClass} value={p.customName ?? ''} maxLength={60} placeholder="p. ej. Dolor de cabeza, picazón…" onChange={(e) => update(p.type, { customName: e.target.value })} />
              </Field>
            )}
            <IntensitySlider label="Intensidad" value={p.intensity} word={intensityWord(p.intensity)} onChange={(v) => update(p.type, { intensity: v })} />
            {(def.askLocation || p.location) && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold">Ubicación (opcional)</p>
                <AbdomenMap value={p.location} onChange={(z) => update(p.type, { location: z })} />
              </div>
            )}
            {!def.askLocation && !p.location && (
              <button type="button" className="mt-3 text-sm font-semibold text-primary" onClick={() => update(p.type, { location: 'general' })}>
                + Indicar ubicación
              </button>
            )}
          </div>
        );
      })}

      <TimeField label="¿Cuándo empezó?" value={at} onChange={setAt} />

      <Field label="Duración">
        <Segmented
          label="Estado del síntoma"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'en_curso', label: 'Sigue' },
            { value: 'termino', label: 'Ya pasó' },
            { value: 'duracion', label: 'Duró aprox.' },
          ]}
        />
        {status === 'termino' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input aria-label="Fecha de fin" type="date" className={inputClass} value={toDateInput(endedAt)} onChange={(e) => e.target.value && setEndedAt(fromDateTimeInputs(e.target.value, toTimeInput(endedAt)))} />
            <input aria-label="Hora de fin" type="time" className={inputClass} value={toTimeInput(endedAt)} onChange={(e) => e.target.value && setEndedAt(fromDateTimeInputs(toDateInput(endedAt), e.target.value))} />
          </div>
        )}
        {status === 'duracion' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATIONS.map((m) => (
              <Chip key={m} size="sm" selected={duration === m} onClick={() => setDuration(m)}>
                {formatDuration(m)}
              </Chip>
            ))}
          </div>
        )}
        {status === 'en_curso' && <p className="mt-1 text-xs text-muted">Cuando desaparezca, toca «Ya pasó» en la lista de síntomas.</p>}
      </Field>

      <Field label="Observaciones" htmlFor="sym-notes">
        <TextArea id="sym-notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Qué lo empeora o alivia, qué estabas haciendo…" />
      </Field>
    </Sheet>
  );
}
