/** Diálogo de recomendación médica prudente tras registrar una señal importante. */
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Phone } from 'lucide-react';
import { ALERT_LEVEL_INFO, EMERGENCY_LINE, sortAlerts, type MedicalAlert } from '@/domain/alerts';
import { Button, cx, toneBg } from '@/components/ui';

export function AlertDialog({ alerts, onClose }: { alerts: MedicalAlert[]; onClose: () => void }) {
  const sorted = sortAlerts(alerts);
  const urgent = sorted.some((a) => a.level === 'urgente');
  return (
    <Dialog.Root open={alerts.length > 0} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Content className="animate-pop fixed left-1/2 top-1/2 z-[61] max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-border bg-surface p-5 shadow-2xl">
          <div className={cx('mb-3 inline-flex size-12 items-center justify-center rounded-2xl', urgent ? 'bg-bad-soft text-bad' : 'bg-mid-soft text-mid')}>
            <AlertTriangle size={26} />
          </div>
          <Dialog.Title className="text-lg font-extrabold">{urgent ? 'Esto merece atención médica' : 'Una recomendación prudente'}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">DIGESTA no diagnostica. Esta orientación general no reemplaza la valoración de un profesional de la salud.</Dialog.Description>
          <ul className="mt-4 space-y-3">
            {sorted.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border p-3">
                <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', toneBg[ALERT_LEVEL_INFO[a.level].tone])}>{ALERT_LEVEL_INFO[a.level].label}</span>
                <p className="mt-2 font-bold">{a.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{a.message}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2">
            {urgent && (
              <a href={`tel:${EMERGENCY_LINE}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-bad px-4 font-semibold text-white">
                <Phone size={18} /> Llamar a la línea de emergencias {EMERGENCY_LINE}
              </a>
            )}
            <Button variant="secondary" block onClick={onClose}>
              Entendido
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
