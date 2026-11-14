/**
 * Registro rápido de comidas: buscar y tocar alimentos, ajustar cantidad y
 * preparación, y guardar. Todo lo demás es opcional y está plegado.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, ChevronDown, Copy, ImageOff, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDb } from '@/db/db';
import { deleteMeal, foodHistory, markFavoriteUsed, saveCustomFood, saveFavorite, saveMeal, supplementHistory } from '@/db/repo';
import { catalogFood, deriveFlags, foodKey, prettyName, searchFoods } from '@/domain/foods';
import { FEELINGS, MEAL_FLAGS, MEAL_TYPES, PREPARATIONS, QUANTITIES, mealTypeLabel, suggestMealType, symptomLabel } from '@/domain/labels';
import { formatDateTime } from '@/domain/dates';
import type { FeelingAfter, Meal, MealFlag, MealItem, MealType, Preparation } from '@/domain/types';
import { storePhoto } from '@/lib/images';
import { usePhotoUrl, useSettings } from '@/lib/hooks';
import { TimeField } from '@/components/TimeField';
import { Button, Chip, Field, IconButton, Sheet, TextArea, cx, errorMessage, inputClass, useConfirm, useToast } from '@/components/ui';

export interface MealSheetProps {
  open: boolean;
  onClose: () => void;
  /** Comida a editar. */
  meal?: Meal;
  /** Plantilla para duplicar (se guarda como comida nueva). */
  template?: Partial<Meal>;
  onAddSymptom?: () => void;
}

interface Draft {
  at: number;
  mealType: MealType;
  items: MealItem[];
  flagsAdded: MealFlag[];
  flagsRemoved: MealFlag[];
  supplements: string[];
  photoId?: string;
  notes: string;
  feelingAfter?: FeelingAfter;
}

function draftFrom(meal?: Partial<Meal>, keepTime = false): Draft {
  const now = Date.now();
  const derived = deriveFlags(meal?.itemKeys ?? []);
  const flags = meal?.flags ?? [];
  return {
    at: keepTime && meal?.at ? meal.at : now,
    mealType: meal?.mealType ?? suggestMealType(new Date(now)),
    items: meal?.items ? structuredClone(meal.items) : [],
    flagsAdded: flags.filter((f) => !derived.includes(f)),
    flagsRemoved: derived.filter((f) => !flags.includes(f)),
    supplements: meal?.supplements ? [...meal.supplements] : [],
    photoId: keepTime ? meal?.photoId : undefined,
    notes: meal?.notes ?? '',
    feelingAfter: meal?.feelingAfter,
  };
}

export function MealSheet({ open, onClose, meal, template, onAddSymptom }: MealSheetProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const settings = useSettings();
  const [d, setD] = useState<Draft>(() => draftFrom(meal ?? template, !!meal));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [favName, setFavName] = useState('');
  const [saveAsFav, setSaveAsFav] = useState(false);
  const [more, setMore] = useState(!!meal && !!(meal.notes || meal.supplements.length || meal.photoId || meal.feelingAfter));

  useEffect(() => {
    if (open) {
      setD(draftFrom(meal ?? template, !!meal));
      setError(undefined);
      setSaveAsFav(false);
      setFavName('');
      setMore(!!meal && !!(meal.notes || meal.supplements.length || meal.photoId || meal.feelingAfter));
    }
  }, [open, meal, template]);

  const itemKeys = useMemo(() => {
    const s = new Set<string>();
    for (const it of d.items) {
      s.add(foodKey(it.name));
      for (const i of it.ingredients ?? []) s.add(foodKey(i));
    }
    return [...s];
  }, [d.items]);
  const derivedFlags = useMemo(() => deriveFlags(itemKeys), [itemKeys]);
  const flags = useMemo(() => {
    const s = new Set<MealFlag>([...derivedFlags, ...d.flagsAdded]);
    for (const f of d.flagsRemoved) s.delete(f);
    return [...s];
  }, [derivedFlags, d.flagsAdded, d.flagsRemoved]);

  const toggleFlag = (f: MealFlag) => {
    setD((x) => {
      const on = flags.includes(f);
      if (on) return { ...x, flagsAdded: x.flagsAdded.filter((y) => y !== f), flagsRemoved: derivedFlags.includes(f) ? [...x.flagsRemoved, f] : x.flagsRemoved };
      return { ...x, flagsRemoved: x.flagsRemoved.filter((y) => y !== f), flagsAdded: derivedFlags.includes(f) ? x.flagsAdded : [...x.flagsAdded, f] };
    });
  };

  const addItem = (name: string, ingredients?: string[]) => {
    const clean = prettyName(name);
    if (!clean) return;
    const key = foodKey(clean);
    if (d.items.some((i) => i.key === key)) {
      toast(`${clean} ya está en la lista`, { tone: 'info' });
      return;
    }
    setD((x) => ({ ...x, items: [...x.items, { name: clean, key, quantity: 'normal', ...(ingredients?.length ? { ingredients: [...ingredients] } : {}) }] }));
    setError(undefined);
    if (!catalogFood(key)) void saveCustomFood(clean, []).catch(() => undefined);
  };

  const updateItem = (idx: number, patch: Partial<MealItem>) => setD((x) => ({ ...x, items: x.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const removeItem = (idx: number) => setD((x) => ({ ...x, items: x.items.filter((_, i) => i !== idx) }));

  const applyTemplate = (t: Partial<Meal>, favId?: string) => {
    setD((x) => ({ ...draftFrom({ ...t, at: x.at }, false), at: x.at, mealType: t.mealType ?? x.mealType }));
    if (favId) void markFavoriteUsed(favId);
    toast('Comida cargada. Revisa y guarda.', { tone: 'info' });
  };

  const save = async () => {
    if (!d.items.length) {
      setError('Agrega al menos un alimento o bebida');
      return;
    }
    setSaving(true);
    try {
      await saveMeal({
        id: meal?.id,
        at: d.at,
        mealType: d.mealType,
        items: d.items,
        flags,
        supplements: d.supplements,
        photoId: d.photoId,
        notes: d.notes,
        feelingAfter: d.feelingAfter,
      });
      if (saveAsFav) {
        await saveFavorite({ name: favName.trim() || `${mealTypeLabel(d.mealType)}: ${d.items.map((i) => i.name).join(', ')}`.slice(0, 80), mealType: d.mealType, items: d.items, flags, supplements: d.supplements });
      }
      toast(meal ? 'Comida actualizada' : 'Comida guardada');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!meal) return;
    if (await confirm({ title: 'Eliminar comida', message: 'Esta comida y su foto se eliminarán de tu diario.', confirmLabel: 'Eliminar', danger: true })) {
      await deleteMeal(meal.id);
      toast('Comida eliminada');
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={meal ? 'Editar comida' : 'Agregar comida'}
      description={meal ? formatDateTime(meal.at) : 'Toca los alimentos y guarda. Lo demás es opcional.'}
      footer={
        <div className="flex gap-2">
          {meal && (
            <IconButton label="Eliminar comida" onClick={remove} className="border border-border text-bad">
              <Trash2 size={20} />
            </IconButton>
          )}
          <Button size="lg" block onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : meal ? 'Guardar cambios' : `Guardar${d.items.length ? ` (${d.items.length})` : ''}`}
          </Button>
        </div>
      }
    >
      {!meal && <QuickRepeat onPick={applyTemplate} />}

      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label="Tipo de comida">
        {MEAL_TYPES.map((t) => (
          <Chip key={t.value} role="radio" aria-checked={d.mealType === t.value} selected={d.mealType === t.value} onClick={() => setD((x) => ({ ...x, mealType: t.value }))}>
            <span aria-hidden>{t.emoji}</span> {t.label}
          </Chip>
        ))}
      </div>

      <FoodPicker onAdd={addItem} selectedKeys={d.items.map((i) => i.key)} />

      {error && (
        <p role="alert" className="mb-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          {error}
        </p>
      )}

      {d.items.length > 0 && (
        <ul className="mb-4 space-y-2" aria-label="Alimentos de esta comida">
          {d.items.map((it, idx) => (
            <ItemRow key={it.key + idx} item={it} onChange={(p) => updateItem(idx, p)} onRemove={() => removeItem(idx)} />
          ))}
        </ul>
      )}

      <TimeField value={d.at} onChange={(at) => setD((x) => ({ ...x, at }))} />

      <Field label="Contiene" hint="Se marca automáticamente según los alimentos; puedes ajustarlo.">
        <div className="flex flex-wrap gap-2">
          {MEAL_FLAGS.map((f) => (
            <Chip key={f.value} size="sm" selected={flags.includes(f.value)} onClick={() => toggleFlag(f.value)}>
              <span aria-hidden>{f.emoji}</span> {f.label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="¿Cómo te sentiste al terminar?">
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <Chip key={f.value} size="sm" tone={f.tone} selected={d.feelingAfter === f.value} onClick={() => setD((x) => ({ ...x, feelingAfter: x.feelingAfter === f.value ? undefined : f.value }))}>
              <span aria-hidden>{f.emoji}</span> {f.label}
            </Chip>
          ))}
        </div>
      </Field>

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="mb-3 flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold">
        Suplementos, foto y notas
        <ChevronDown size={18} className={cx('transition', more && 'rotate-180')} />
      </button>

      {more && (
        <div className="animate-fade">
          <SupplementsInput value={d.supplements} onChange={(supplements) => setD((x) => ({ ...x, supplements }))} />
          <PhotoInput photoId={d.photoId} maxSide={settings.photoMaxSide} onChange={(photoId) => setD((x) => ({ ...x, photoId }))} />
          <Field label="Notas" htmlFor="meal-notes">
            <TextArea id="meal-notes" value={d.notes} maxLength={2000} placeholder="Dónde comiste, cómo estaba preparado, algo diferente…" onChange={(e) => setD((x) => ({ ...x, notes: e.target.value }))} />
          </Field>
        </div>
      )}

      {!meal && d.items.length > 0 && (
        <div className="mb-4 rounded-2xl border border-border p-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={saveAsFav} onChange={(e) => setSaveAsFav(e.target.checked)} />
            <Star size={16} className="text-mid" /> Guardar también como favorita
          </label>
          {saveAsFav && <input aria-label="Nombre de la favorita" className={cx(inputClass, 'mt-2')} placeholder="Nombre (opcional), p. ej. Desayuno de entreno" value={favName} onChange={(e) => setFavName(e.target.value)} maxLength={80} />}
        </div>
      )}

      {meal && <AfterMealSymptoms meal={meal} onAddSymptom={onAddSymptom} />}
    </Sheet>
  );
}

// ───────── Repetir rápido: favoritas y últimas comidas ─────────

function QuickRepeat({ onPick }: { onPick: (t: Partial<Meal>, favId?: string) => void }) {
  const favorites = useLiveQuery(() => getDb().favorites.orderBy('uses').reverse().limit(12).toArray(), []);
  const recent = useLiveQuery(async () => {
    const all = await getDb().meals.orderBy('at').reverse().limit(30).toArray();
    const seen = new Set<string>();
    return all
      .filter((m) => {
        const sig = m.items.map((i) => i.key).sort().join('|');
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      })
      .slice(0, 6);
  }, []);
  if (!favorites?.length && !recent?.length) return null;
  return (
    <div className="mb-4">
      <p className="mb-2 text-sm font-semibold">Repetir rápido</p>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {favorites?.map((f) => (
          <button key={f.id} type="button" onClick={() => onPick(f, f.id)} className="flex max-w-[220px] shrink-0 flex-col items-start rounded-2xl border border-border bg-surface px-3 py-2 text-left active:scale-[0.98]">
            <span className="flex items-center gap-1 text-xs font-bold text-mid">
              <Star size={12} fill="currentColor" /> Favorita
            </span>
            <span className="line-clamp-1 text-sm font-semibold">{f.name}</span>
          </button>
        ))}
        {recent?.map((m) => (
          <button key={m.id} type="button" onClick={() => onPick(m)} className="flex max-w-[220px] shrink-0 flex-col items-start rounded-2xl border border-border bg-surface px-3 py-2 text-left active:scale-[0.98]">
            <span className="flex items-center gap-1 text-xs font-bold text-muted">
              <Copy size={12} /> {mealTypeLabel(m.mealType)} · {formatDateTime(m.at).split(' · ')[0]}
            </span>
            <span className="line-clamp-1 text-sm font-semibold">{m.items.map((i) => i.name).join(', ')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────── Buscador de alimentos ─────────

function FoodPicker({ onAdd, selectedKeys }: { onAdd: (name: string, ingredients?: string[]) => void; selectedKeys: string[] }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useLiveQuery(() => foodHistory(), [], []);
  const custom = useLiveQuery(() => getDb().customFoods.toArray(), [], []);
  const results = useMemo(() => searchFoods(q, history, custom, q ? 10 : 14), [q, history, custom]);
  const exact = results.some((r) => r.key === foodKey(q));
  const add = (name: string, ingredients?: string[]) => {
    onAdd(name, ingredients);
    setQ('');
    inputRef.current?.focus();
  };
  return (
    <div className="mb-4">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Buscar o escribir un alimento"
          placeholder="Buscar o escribir: arepa, café, fríjoles…"
          className={cx(inputClass, 'pl-11')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) {
              e.preventDefault();
              const first = results[0];
              if (first && (exact || first.key.startsWith(foodKey(q)))) add(first.name, first.ingredients);
              else add(q);
            }
          }}
          enterKeyHint="done"
          autoComplete="off"
        />
      </div>
      <p className="mb-1 mt-2 text-xs font-semibold text-muted">{q ? 'Resultados' : history.length ? 'Tus alimentos frecuentes' : 'Sugerencias'}</p>
      <div className="flex flex-wrap gap-2">
        {q.trim() && !exact && (
          <Chip size="sm" onClick={() => add(q)} className="border-primary text-primary">
            <Plus size={14} /> Agregar «{prettyName(q)}»
          </Chip>
        )}
        {results.map((r) => {
          const sel = selectedKeys.includes(r.key);
          return (
            <Chip key={r.key} size="sm" selected={sel} onClick={() => !sel && add(r.name, r.ingredients)} aria-label={sel ? `${r.name} (agregado)` : `Agregar ${r.name}`}>
              {!sel && <Plus size={14} className="text-muted" />}
              {r.name}
              {r.count ? <span className="text-xs text-muted">×{r.count}</span> : null}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

// ───────── Fila de alimento ─────────

function ItemRow({ item, onChange, onRemove }: { item: MealItem; onChange: (p: Partial<MealItem>) => void; onRemove: () => void }) {
  const [showIng, setShowIng] = useState(false);
  const [newIng, setNewIng] = useState('');
  const suggested = catalogFood(item.key)?.ingredients ?? [];
  const ingredients = item.ingredients ?? [];
  const addIng = (name: string) => {
    const n = prettyName(name);
    if (!n || ingredients.some((i) => foodKey(i) === foodKey(n))) return;
    onChange({ ingredients: [...ingredients, n] });
  };
  return (
    <li className="animate-pop rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{item.name}</p>
        <IconButton label={`Quitar ${item.name}`} onClick={onRemove} className="size-9">
          <X size={18} />
        </IconButton>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Cantidad de ${item.name}`}>
        {QUANTITIES.map((q) => (
          <Chip key={q.value} size="sm" role="radio" aria-checked={item.quantity === q.value} selected={item.quantity === q.value} onClick={() => onChange({ quantity: q.value })}>
            {q.label}
          </Chip>
        ))}
      </div>
      {item.quantity === 'personalizada' && (
        <input aria-label={`Cantidad personalizada de ${item.name}`} className={cx(inputClass, 'mt-2 min-h-10')} placeholder="p. ej. 2 tazas, 150 g, 1 vaso" value={item.customQuantity ?? ''} maxLength={60} onChange={(e) => onChange({ customQuantity: e.target.value })} />
      )}
      <div className="mt-2 flex items-center gap-2">
        <label className="sr-only" htmlFor={`prep-${item.key}`}>
          Preparación de {item.name}
        </label>
        <select
          id={`prep-${item.key}`}
          className={cx(inputClass, 'min-h-10 flex-1 py-1 text-sm')}
          value={item.preparation ?? ''}
          onChange={(e) => onChange({ preparation: (e.target.value || undefined) as Preparation | undefined })}
        >
          <option value="">Preparación: sin especificar</option>
          {PREPARATIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setShowIng((s) => !s)} aria-expanded={showIng} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-primary">
          Ingredientes{ingredients.length ? ` (${ingredients.length})` : ''}
        </button>
      </div>
      {showIng && (
        <div className="mt-2 rounded-xl bg-surface-2 p-2">
          <div className="flex flex-wrap gap-1.5">
            {ingredients.map((i) => (
              <Chip key={i} size="sm" selected onClick={() => onChange({ ingredients: ingredients.filter((x) => x !== i) })} aria-label={`Quitar ingrediente ${i}`}>
                {i} <X size={12} />
              </Chip>
            ))}
            {suggested
              .filter((s) => !ingredients.some((i) => foodKey(i) === foodKey(s)))
              .map((s) => (
                <Chip key={s} size="sm" onClick={() => addIng(s)}>
                  <Plus size={12} /> {s}
                </Chip>
              ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addIng(newIng);
              setNewIng('');
            }}
          >
            <input aria-label="Nuevo ingrediente" className={cx(inputClass, 'min-h-10 text-sm')} placeholder="Agregar ingrediente" value={newIng} onChange={(e) => setNewIng(e.target.value)} maxLength={80} />
            <Button type="submit" size="sm" variant="soft" disabled={!newIng.trim()}>
              Agregar
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}

// ───────── Suplementos ─────────

function SupplementsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [txt, setTxt] = useState('');
  const history = useLiveQuery(() => supplementHistory(), [], []);
  const common = ['Creatina', 'Proteína en polvo', 'Multivitamínico', 'Omega 3', 'Magnesio', 'Probiótico', 'Hierro', 'Vitamina D', 'Pre-entreno', 'Fibra (psyllium)'];
  const options = [...new Set([...history, ...common])].filter((s) => !value.some((v) => foodKey(v) === foodKey(s))).slice(0, 10);
  const add = (s: string) => {
    const n = prettyName(s);
    if (n && !value.some((v) => foodKey(v) === foodKey(n))) onChange([...value, n]);
  };
  return (
    <Field label="Suplementos (opcional)">
      <div className="flex flex-wrap gap-1.5">
        {value.map((s) => (
          <Chip key={s} size="sm" selected onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Quitar ${s}`}>
            {s} <X size={12} />
          </Chip>
        ))}
        {options.map((s) => (
          <Chip key={s} size="sm" onClick={() => add(s)}>
            <Plus size={12} /> {s}
          </Chip>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(txt);
          setTxt('');
        }}
      >
        <input aria-label="Otro suplemento" className={cx(inputClass, 'min-h-10 text-sm')} placeholder="Otro suplemento" value={txt} onChange={(e) => setTxt(e.target.value)} maxLength={80} />
        <Button type="submit" size="sm" variant="soft" disabled={!txt.trim()}>
          Agregar
        </Button>
      </form>
    </Field>
  );
}

// ───────── Foto ─────────

function PhotoInput({ photoId, onChange, maxSide }: { photoId?: string; onChange: (id?: string) => void; maxSide: number }) {
  const url = usePhotoUrl(photoId);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const prev = photoId;
      const id = await storePhoto(f, maxSide);
      onChange(id);
      // La foto anterior sólo se borra si no pertenece a una comida ya guardada (eso lo maneja saveMeal).
      if (prev) {
        const usedBy = await getDb().meals.filter((m) => m.photoId === prev).count();
        if (!usedBy) await getDb().photos.delete(prev);
      }
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <Field label="Foto del plato (opcional)" hint="Se comprime en tu teléfono y se guarda sólo aquí.">
      {url ? (
        <div className="relative overflow-hidden rounded-2xl border border-border">
          <img src={url} alt="Foto del plato" className="max-h-64 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              Cambiar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onChange(undefined)} aria-label="Quitar foto">
              <ImageOff size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" block onClick={() => fileRef.current?.click()} disabled={busy}>
          <Camera size={18} /> {busy ? 'Comprimiendo…' : 'Tomar o elegir foto'}
        </Button>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Seleccionar foto" />
    </Field>
  );
}

// ───────── Síntomas posteriores (al editar) ─────────

function AfterMealSymptoms({ meal, onAddSymptom }: { meal: Meal; onAddSymptom?: () => void }) {
  const later = useLiveQuery(() => getDb().symptoms.where('startedAt').between(meal.at, meal.at + 24 * 3600_000).toArray(), [meal.at], []);
  return (
    <div className="mb-2 rounded-2xl bg-surface-2 p-3">
      <p className="text-sm font-semibold">Síntomas en las 24 h siguientes</p>
      {later.length ? (
        <ul className="mt-1 text-sm text-muted">
          {later.map((s) => (
            <li key={s.id}>
              • {symptomLabel(s.type, s.customName)} · {s.intensity}/10 · {formatDateTime(s.startedAt)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Ninguno registrado.</p>
      )}
      {onAddSymptom && (
        <Button size="sm" variant="soft" className="mt-2" onClick={onAddSymptom}>
          <Plus size={14} /> Registrar síntoma posterior
        </Button>
      )}
    </div>
  );
}
