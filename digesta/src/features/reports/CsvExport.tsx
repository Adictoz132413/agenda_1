/** Botones de exportación CSV (todos los registros de la base activa). */
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { loadAll } from '@/db/repo';
import { dailyCsv, mealsCsv, stoolsCsv, symptomsCsv } from '@/db/csv';
import { todayKey } from '@/domain/dates';
import { downloadText } from '@/lib/download';
import { Button, errorMessage, useToast } from '@/components/ui';

const KINDS = [
  { key: 'comidas', label: 'Comidas' },
  { key: 'deposiciones', label: 'Deposiciones' },
  { key: 'sintomas', label: 'Síntomas' },
  { key: 'registro-diario', label: 'Registro diario' },
] as const;

export function CsvExport() {
  const toast = useToast();
  const [busy, setBusy] = useState<string>();
  const run = async (k: (typeof KINDS)[number]['key']) => {
    setBusy(k);
    try {
      const all = await loadAll();
      const text = k === 'comidas' ? mealsCsv(all.meals) : k === 'deposiciones' ? stoolsCsv(all.stools) : k === 'sintomas' ? symptomsCsv(all.symptoms) : dailyCsv(all.logs);
      const rows = (k === 'comidas' ? all.meals.reduce((a, m) => a + m.items.length, 0) : k === 'deposiciones' ? all.stools.length : k === 'sintomas' ? all.symptoms.length : all.logs.length);
      downloadText(`digesta-${k}-${todayKey()}.csv`, text, 'text/csv;charset=utf-8');
      toast(`CSV descargado (${rows} fila${rows === 1 ? '' : 's'})`);
    } catch (e) {
      toast(errorMessage(e), { tone: 'error' });
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {KINDS.map((k) => (
          <Button key={k.key} variant="secondary" onClick={() => run(k.key)} disabled={!!busy}>
            <FileSpreadsheet size={18} /> {busy === k.key ? 'Generando…' : k.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Separador punto y coma (;) y codificación UTF-8, compatible con Excel y Hojas de cálculo en español.</p>
    </div>
  );
}
