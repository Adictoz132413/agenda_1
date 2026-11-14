/**
 * Proveedor global de formularios de registro. Cualquier pantalla puede abrir
 * "agregar comida", "registrar deposición", etc. con `useEntry()`.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Meal, Stool, Symptom, SymptomType } from '@/domain/types';
import type { MedicalAlert } from '@/domain/alerts';
import { todayKey } from '@/domain/dates';
import { MealSheet } from './MealSheet';
import { StoolSheet } from './StoolSheet';
import { SymptomSheet } from './SymptomSheet';
import { FactorsSheet } from './FactorsSheet';
import { AlertDialog } from './AlertDialog';

interface EntryApi {
  openMeal: (opts?: { meal?: Meal; template?: Partial<Meal>; at?: number }) => void;
  openStool: (stool?: Stool, opts?: { at?: number }) => void;
  openSymptom: (opts?: { symptom?: Symptom; type?: SymptomType; at?: number }) => void;
  openFactors: (day?: string) => void;
  showAlerts: (a: MedicalAlert[]) => void;
}

const Ctx = createContext<EntryApi | null>(null);

type State =
  | { kind: 'none' }
  | { kind: 'meal'; meal?: Meal; template?: Partial<Meal>; at?: number }
  | { kind: 'stool'; stool?: Stool; at?: number }
  | { kind: 'symptom'; symptom?: Symptom; type?: SymptomType; at?: number }
  | { kind: 'factors'; day: string };

export function EntryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'none' });
  // Se conserva el último estado para que la animación de cierre no pierda contenido.
  const [last, setLast] = useState<State>({ kind: 'none' });
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);

  const open = useCallback((s: State) => {
    setLast(s);
    setState(s);
  }, []);
  const close = useCallback(() => setState({ kind: 'none' }), []);

  const api = useMemo<EntryApi>(
    () => ({
      openMeal: (o) => open({ kind: 'meal', ...o }),
      openStool: (stool, o) => open({ kind: 'stool', stool, at: o?.at }),
      openSymptom: (o) => open({ kind: 'symptom', symptom: o?.symptom, type: o?.type, at: o?.at }),
      openFactors: (day) => open({ kind: 'factors', day: day ?? todayKey() }),
      showAlerts: (a) => setAlerts(a),
    }),
    [open],
  );

  const s = state.kind === 'none' ? last : state;

  return (
    <Ctx.Provider value={api}>
      {children}
      <MealSheet
        open={state.kind === 'meal'}
        onClose={close}
        meal={s.kind === 'meal' ? s.meal : undefined}
        template={s.kind === 'meal' ? s.template : undefined}
        initialAt={s.kind === 'meal' ? s.at : undefined}
        onAddSymptom={s.kind === 'meal' && s.meal ? () => open({ kind: 'symptom', at: Date.now() }) : undefined}
      />
      <StoolSheet open={state.kind === 'stool'} onClose={close} stool={s.kind === 'stool' ? s.stool : undefined} initialAt={s.kind === 'stool' ? s.at : undefined} onAlerts={setAlerts} />
      <SymptomSheet
        open={state.kind === 'symptom'}
        onClose={close}
        symptom={s.kind === 'symptom' ? s.symptom : undefined}
        initialType={s.kind === 'symptom' ? s.type : undefined}
        initialAt={s.kind === 'symptom' ? s.at : undefined}
        onAlerts={setAlerts}
      />
      <FactorsSheet open={state.kind === 'factors'} onClose={close} day={s.kind === 'factors' ? s.day : todayKey()} />
      <AlertDialog alerts={alerts} onClose={() => setAlerts([])} />
    </Ctx.Provider>
  );
}

export function useEntry(): EntryApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEntry debe usarse dentro de EntryProvider');
  return c;
}
