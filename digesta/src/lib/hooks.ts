/** Hooks de datos reactivos sobre IndexedDB. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getDb } from '@/db/db';
import { getSettings } from '@/db/repo';
import { DEFAULT_SETTINGS, type Settings } from '@/domain/types';
import { todayKey } from '@/domain/dates';

export function useSettings(): Settings {
  return useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS);
}

/** Clave del día actual que se actualiza al pasar la medianoche. */
export function useToday(): string {
  const [k, setK] = useState(todayKey());
  useEffect(() => {
    const t = setInterval(() => setK(todayKey()), 30_000);
    const vis = () => setK(todayKey());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return k;
}

/** Re-render periódico (para "en curso", tiempos relativos, etc.). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** URL de objeto para una foto guardada (se libera al desmontar). */
export function usePhotoUrl(photoId?: string): string | undefined {
  const photo = useLiveQuery(() => (photoId ? getDb().photos.get(photoId) : undefined), [photoId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!photo) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(new Blob([photo.data], { type: photo.mime }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return url;
}
