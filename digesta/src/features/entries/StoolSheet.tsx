/**
 * Registro de deposición: elegir el tipo de Bristol basta para guardar.
 * El resto de campos tiene valores por defecto razonables.
 */
import { ChevronDown, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { deleteStool, saveStool } from '@/db/repo';
import { AMOUNTS, BLOOD_OPTIONS, BRISTOL, EFFORT_LABELS, STOOL_COLORS, URGENCY_LABELS, bristolTone } from '@/domain/labels';
import { formatDateTime } from '@/domain/dates';
import type { BristolType, Level0to3, Stool } from '@/domain/types';
import { stoolAlerts, type MedicalAlert } from '@/domain/alerts';
import { BristolIcon } from '@/components/illustrations';
import { TimeField } from '@/components/TimeField';
import { Button, Chip, Field, IconButton, IntensitySlider, Segmented, Sheet, TextArea, cx, errorMessage, toneBg, useConfirm, useToast } from '@/components/ui';

type Draft = Omit<Stool, 'id' | 'createdAt' | 'updatedAt' | 'bristol'> & { bristol?: BristolType };

const empty = (): Draft => ({
  at: Date.now(),
  bristol: undefined,
  color: 'marron',
  amount: 'normal',
  urgency: 0,
  effort: 0,
  pain: { before: false, during: false, after: false },
  incomplete: false,
  mucus: false,
  blood: 'no',
  notes: '',
});

export function StoolSheet({ open, onClose, stool, onAlerts }: { open: boolean; onClose: () => void; stool?: Stool; onAlerts: (a: MedicalAlert[]) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<Draft>(empty);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setD(stool ? { ...stool, notes: stool.notes ?? '' } : empty());
      setMore(!!stool);
      setError(undefined);
    }
  }, [open, stool]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const anyPain = d.pain.before || d.pain.during || d.pain.after;

  const save = async () => {
    if (!d.bristol) {
      setError('Elige el tipo de deposición en la escala de Bristol');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveStool({ ...d, id: stool?.id, bristol: d.bristol, painIntensity: anyPain ? d.painIntensity ?? 3 : undefined });
      toast(stool ? 'Deposición actualizada' : 'Deposición registrada');
      onClose();
      const alerts = stoolAlerts(saved);
      if (alerts.length) onAlerts(alerts);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (stool && (await confirm({ title: 'Eliminar deposición', message: 'Se eliminará este registro.', confirmLabel: 'Eliminar', danger: true }))) {
      await deleteStool(stool.id);
      toast('Registro eliminado');
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={stool ? 'Editar deposición' : 'Registrar deposición'}
      description={stool ? formatDateTime(stool.at) : 'Elige el tipo más parecido. Lo demás es opcional.'}
      footer={
        <div className="flex gap-2">
          {stool && (
            <IconButton label="Eliminar deposición" onClick={remove} className="border border-border text-bad">
              <Trash2 size={20} />
            </IconButton>
          )}
          <Button size="lg" block onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : stool ? 'Guardar cambios' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold">Escala de Bristol</legend>
        <div className="grid gap-2" role="radiogroup" aria-label="Tipo de Bristol">
          {BRISTOL.map((b) => {
            const sel = d.bristol === b.type;
            const tone = bristolTone(b.type);
            return (
              <button
                key={b.type}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => {
                  set('bristol', b.type);
                  setError(undefined);
                }}
                className={cx('flex items-center gap-3 rounded-2xl border p-2.5 text-left transition active:scale-[0.99]', sel ? 'border-primary bg-primary-soft ring-2 ring-primary/40' : 'border-border bg-surface')}
              >
                <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-2">
                  <BristolIcon type={b.type} className="h-10 w-[72px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-bold">{b.title}</span>
                    <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', toneBg[tone])}>{b.group === 'normal' ? 'Ideal' : b.group === 'duro' ? 'Dura' : b.type === 5 ? 'Blanda' : 'Muy blanda'}</span>
                  </span>
                  <span className="block text-[13px] leading-snug text-muted">{b.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          {error}
        </p>
      )}

      <TimeField value={d.at} onChange={(at) => set('at', at)} />

      <Field label="¿Observaste sangre?" hint="Regístralo sólo si lo observaste.">
        <div className="flex flex-wrap gap-2">
          {BLOOD_OPTIONS.map((b) => (
            <Chip key={b.value} size="sm" tone={b.value === 'no' ? 'primary' : 'bad'} selected={d.blood === b.value} onClick={() => set('blood', b.value)}>
              {b.label}
            </Chip>
          ))}
        </div>
      </Field>

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mb-3 flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold">
        Color, cantidad, urgencia, dolor y más
        <ChevronDown size={18} className={cx('transition', more && 'rotate-180')} />
      </button>

      {more && (
        <div className="animate-fade">
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {STOOL_COLORS.map((c) => (
                <Chip key={c.value} size="sm" selected={d.color === c.value} onClick={() => set('color', c.value)}>
                  <span className="size-4 rounded-full border border-black/10" style={{ background: c.hex }} aria-hidden />
                  {c.label}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Cantidad aproximada">
            <Segmented label="Cantidad" value={d.amount} onChange={(v) => set('amount', v)} options={AMOUNTS.map((a) => ({ value: a.value, label: a.label }))} />
          </Field>
          <Field label="Urgencia">
            <Segmented label="Urgencia" value={d.urgency} onChange={(v) => set('urgency', v as Level0to3)} options={([0, 1, 2, 3] as Level0to3[]).map((v) => ({ value: v, label: URGENCY_LABELS[v] }))} className="text-xs" />
          </Field>
          <Field label="Esfuerzo o dificultad">
            <Segmented label="Esfuerzo" value={d.effort} onChange={(v) => set('effort', v as Level0to3)} options={([0, 1, 2, 3] as Level0to3[]).map((v) => ({ value: v, label: EFFORT_LABELS[v] }))} />
          </Field>
          <Field label="Dolor">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['before', 'Antes'],
                  ['during', 'Durante'],
                  ['after', 'Después'],
                ] as const
              ).map(([k, l]) => (
                <Chip key={k} size="sm" tone="bad" selected={d.pain[k]} onClick={() => set('pain', { ...d.pain, [k]: !d.pain[k] })}>
                  {l}
                </Chip>
              ))}
            </div>
            {anyPain && (
              <div className="mt-3">
                <IntensitySlider label="Intensidad del dolor" value={d.painIntensity ?? 3} onChange={(v) => set('painIntensity', v)} />
              </div>
            )}
          </Field>
          <Field label="Otras observaciones">
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" tone="mid" selected={d.incomplete} onClick={() => set('incomplete', !d.incomplete)}>
                Sensación de evacuación incompleta
              </Chip>
              <Chip size="sm" tone="mid" selected={d.mucus} onClick={() => set('mucus', !d.mucus)}>
                Presencia de moco
              </Chip>
            </div>
          </Field>
          <Field label="Notas" htmlFor="stool-notes">
            <TextArea id="stool-notes" value={d.notes} maxLength={2000} onChange={(e) => set('notes', e.target.value)} placeholder="Cualquier detalle que quieras recordar" />
          </Field>
        </div>
      )}
    </Sheet>
  );
}
