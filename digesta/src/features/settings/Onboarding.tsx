/** Bienvenida y aviso de uso (se muestra una sola vez por base de datos). */
import * as Dialog from '@radix-ui/react-dialog';
import { Lock, ShieldCheck, Stethoscope } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';

export function Onboarding({ onAccept }: { onAccept: () => void }) {
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-bg" />
        <Dialog.Content
          className="fixed inset-0 z-[81] mx-auto flex max-w-lg flex-col overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]"
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <Logo className="size-16" />
          <Dialog.Title className="mt-5 text-3xl font-extrabold tracking-tight">Bienvenido a DIGESTA</Dialog.Title>
          <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-muted">
            Tu diario digestivo personal. Registra comidas, deposiciones y síntomas en segundos y descubre, con el paso de las semanas, qué alimentos parecen sentarte mejor.
          </Dialog.Description>
          <ul className="mt-6 space-y-4">
            <li className="flex gap-3">
              <Lock className="mt-0.5 shrink-0 text-primary" size={22} />
              <p className="text-sm leading-relaxed">
                <strong>Tus datos se quedan en este teléfono.</strong> No hay cuentas, publicidad ni rastreadores, y nada se envía a servidores externos.
              </p>
            </li>
            <li className="flex gap-3">
              <Stethoscope className="mt-0.5 shrink-0 text-primary" size={22} />
              <p className="text-sm leading-relaxed">
                <strong>No es una herramienta de diagnóstico.</strong> Los análisis muestran asociaciones observadas en tus registros, no causas ni intolerancias confirmadas. No elimines grupos de alimentos sin orientación profesional.
              </p>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={22} />
              <p className="text-sm leading-relaxed">
                <strong>Haz copias de seguridad.</strong> Si borras los datos del navegador o pierdes el teléfono, la información se pierde. Exporta un respaldo desde Ajustes de vez en cuando.
              </p>
            </li>
          </ul>
          <p className="mt-6 rounded-2xl bg-bad-soft p-4 text-sm leading-relaxed text-bad">
            Ante sangrado abundante, heces negras, dolor intenso o persistente, fiebre alta o vómito que no cede, busca atención médica. Línea de emergencias en Colombia: <strong>123</strong>.
          </p>
          <div className="mt-auto pt-8">
            <Button size="lg" block onClick={onAccept}>
              Entendido, empezar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
