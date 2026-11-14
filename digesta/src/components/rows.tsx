/** Filas de registro reutilizadas en Hoy, Diario y Calendario. */
import { Camera, Check, Copy } from 'lucide-react';
import { endSymptom, isOngoing } from '@/db/repo';
import { formatDuration, formatTime } from '@/domain/dates';
import { BLOOD_OPTIONS, FEELINGS, bristolInfo, bristolTone, flagLabel, mealTypeLabel, MEAL_TYPES, quantityLabel, symptomDef, symptomLabel, zoneLabel, URGENCY_LABELS } from '@/domain/labels';
import type { Meal, Stool, Symptom } from '@/domain/types';
import { BristolIcon } from './illustrations';
import { Badge, cx, toneBg, useToast, type Tone } from './ui';

const intensityTone = (n: number): Tone => (n <= 3 ? 'good' : n <= 6 ? 'mid' : 'bad');

export function MealRow({ meal, onOpen, onDuplicate }: { meal: Meal; onOpen: () => void; onDuplicate?: () => void }) {
  const emoji = MEAL_TYPES.find((m) => m.value === meal.mealType)?.emoji;
  const feeling = FEELINGS.find((f) => f.value === meal.feelingAfter);
  return (
    <li className="flex items-stretch gap-1 rounded-2xl border border-border bg-surface">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 p-3 text-left">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl" aria-hidden>
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm">
            <span className="font-bold">{mealTypeLabel(meal.mealType)}</span>
            <span className="tabular text-muted">{formatTime(meal.at)}</span>
            {meal.photoId && <Camera size={14} className="text-muted" aria-label="Con foto" />}
          </span>
          <span className="line-clamp-2 block text-[15px] leading-snug">
            {meal.items.map((i) => (i.quantity !== 'normal' ? `${i.name} (${i.quantity === 'personalizada' ? i.customQuantity ?? 'otra' : quantityLabel(i.quantity).toLowerCase()})` : i.name)).join(', ')}
          </span>
          {(meal.flags.length > 0 || feeling || meal.supplements.length > 0) && (
            <span className="mt-1 flex flex-wrap gap-1">
              {feeling && <Badge tone={feeling.tone}>{feeling.label}</Badge>}
              {meal.flags.slice(0, 4).map((f) => (
                <Badge key={f}>{flagLabel(f)}</Badge>
              ))}
              {meal.supplements.length > 0 && <Badge tone="primary">+{meal.supplements.length} supl.</Badge>}
            </span>
          )}
        </span>
      </button>
      {onDuplicate && (
        <button type="button" onClick={onDuplicate} aria-label="Duplicar esta comida" title="Duplicar" className="flex w-12 shrink-0 items-center justify-center rounded-r-2xl border-l border-border text-muted hover:bg-surface-2 hover:text-text">
          <Copy size={18} />
        </button>
      )}
    </li>
  );
}

export function StoolRow({ stool, onOpen }: { stool: Stool; onOpen: () => void }) {
  const info = bristolInfo(stool.bristol);
  const flags: string[] = [];
  if (stool.urgency >= 2) flags.push(`Urgencia ${URGENCY_LABELS[stool.urgency].toLowerCase()}`);
  if (stool.pain.before || stool.pain.during || stool.pain.after) flags.push('Dolor');
  if (stool.incomplete) flags.push('Incompleta');
  if (stool.mucus) flags.push('Moco');
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left">
        <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-2">
          <BristolIcon type={stool.bristol} className="h-8 w-14" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm">
            <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', toneBg[bristolTone(stool.bristol)])}>Bristol {stool.bristol}</span>
            <span className="tabular text-muted">{formatTime(stool.at)}</span>
          </span>
          <span className="line-clamp-1 block text-[13px] text-muted">{info.description}</span>
          {(flags.length > 0 || stool.blood !== 'no' || stool.color === 'negro') && (
            <span className="mt-1 flex flex-wrap gap-1">
              {stool.blood !== 'no' && <Badge tone="bad">Sangre: {BLOOD_OPTIONS.find((b) => b.value === stool.blood)?.label.toLowerCase()}</Badge>}
              {stool.color === 'negro' && <Badge tone="bad">Heces negras</Badge>}
              {flags.map((f) => (
                <Badge key={f} tone="mid">
                  {f}
                </Badge>
              ))}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function SymptomRow({ symptom, onOpen, now = Date.now() }: { symptom: Symptom; onOpen: () => void; now?: number }) {
  const toast = useToast();
  const def = symptomDef(symptom.type);
  const ongoing = isOngoing(symptom, now);
  const dur = symptom.endedAt ? (symptom.endedAt - symptom.startedAt) / 60000 : symptom.durationMin;
  return (
    <li className="flex items-stretch gap-1 rounded-2xl border border-border bg-surface">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
        <span className={cx('flex size-11 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-extrabold', toneBg[intensityTone(symptom.intensity)])}>
          <span className="tabular leading-none">{symptom.intensity}</span>
          <span className="text-[9px] font-bold opacity-70">/10</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm">
            <span className="font-bold">
              <span aria-hidden>{def.emoji}</span> {symptomLabel(symptom.type, symptom.customName)}
            </span>
          </span>
          <span className="block text-[13px] text-muted">
            {formatTime(symptom.startedAt)}
            {ongoing ? ' · en curso' : dur ? ` · ${formatDuration(dur)}` : ''}
            {symptom.location ? ` · ${zoneLabel(symptom.location)}` : ''}
          </span>
        </span>
      </button>
      {ongoing && (
        <button
          type="button"
          onClick={async () => {
            await endSymptom(symptom.id);
            toast('Marcado como terminado');
          }}
          className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-r-2xl border-l border-border px-3 text-[11px] font-bold text-good hover:bg-good-soft"
        >
          <Check size={18} /> Ya pasó
        </button>
      )}
    </li>
  );
}
