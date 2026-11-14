/** Hooks que ejecutan el motor de análisis sobre los datos locales (reactivo). */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { loadAll, loadRange, type RangeBundle } from '@/db/repo';
import { analyze, type AnalysisResult } from './engine';
import { useSettings } from '@/lib/hooks';
import { getDb } from '@/db/db';

/** Todos los registros (se recalcula al cambiar cualquier tabla). */
export function useAllData(): RangeBundle | undefined {
  return useLiveQuery(() => loadAll(), []);
}

/** Registros entre dos días (claves YYYY-MM-DD inclusive). */
export function useRangeData(from: string, to: string): RangeBundle | undefined {
  return useLiveQuery(() => loadRange(from, to), [from, to]);
}

/** Resultado del análisis completo. `undefined` mientras carga. */
export function useAnalysis(): { result?: AnalysisResult; data?: RangeBundle; threshold: number } {
  const data = useAllData();
  const settings = useSettings();
  const threshold = settings.analysisThreshold;
  const result = useMemo(() => (data ? analyze({ ...data, threshold }) : undefined), [data, threshold]);
  return { result, data, threshold };
}

/** Notas/clasificaciones manuales de alimentos indexadas por clave. */
export function useFoodNotes() {
  return useLiveQuery(async () => new Map((await getDb().foodNotes.toArray()).map((n) => [n.key, n])), []);
}
