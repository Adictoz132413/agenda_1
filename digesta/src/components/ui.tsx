/**
 * Componentes de interfaz reutilizables y accesibles.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export type Tone = 'good' | 'mid' | 'bad' | 'none' | 'primary';

export const toneText: Record<Tone, string> = {
  good: 'text-good',
  mid: 'text-mid',
  bad: 'text-bad',
  none: 'text-none',
  primary: 'text-primary',
};
export const toneBg: Record<Tone, string> = {
  good: 'bg-good-soft text-good',
  mid: 'bg-mid-soft text-mid',
  bad: 'bg-bad-soft text-bad',
  none: 'bg-none-soft text-none',
  primary: 'bg-primary-soft text-primary',
};
export const toneDot: Record<Tone, string> = {
  good: 'bg-good',
  mid: 'bg-mid',
  bad: 'bg-bad',
  none: 'bg-none',
  primary: 'bg-primary',
};

// ───────── Botones ─────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  block,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-12 px-4 text-[15px]',
        size === 'lg' && 'min-h-14 px-5 text-base',
        variant === 'primary' && 'bg-primary text-on-primary shadow-card hover:bg-primary-strong',
        variant === 'secondary' && 'border border-border bg-surface text-text hover:bg-surface-2',
        variant === 'ghost' && 'text-text hover:bg-surface-2',
        variant === 'soft' && 'bg-primary-soft text-primary hover:brightness-95',
        variant === 'danger' && 'bg-bad text-white hover:brightness-95',
        block && 'w-full',
        className,
      )}
    />
  );
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx('inline-flex size-11 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-text active:scale-95', className)}
    >
      {children}
    </button>
  );
}

// ───────── Contenedores ─────────

export function Card({ className, children, as: As = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' | 'li' } & Record<string, unknown>) {
  return (
    <As {...rest} className={cx('rounded-3xl border border-border bg-surface p-4 shadow-card', className)}>
      {children}
    </As>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-2 mt-6 flex items-center justify-between gap-2 px-1', className)}>
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'none', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', toneBg[tone], className)}>{children}</span>;
}

// ───────── Selección ─────────

export function Chip({
  selected,
  onClick,
  children,
  tone = 'primary',
  className,
  size = 'md',
  ...rest
}: { selected?: boolean; onClick?: () => void; children: ReactNode; tone?: Tone; className?: string; size?: 'sm' | 'md' } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      {...rest}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition active:scale-[0.97]',
        size === 'md' ? 'min-h-10 px-3.5 text-sm' : 'min-h-8 px-3 text-[13px]',
        selected ? cx('border-transparent', toneBg[tone], 'ring-1 ring-current') : 'border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex gap-1 rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(o.value)}
            className={cx('min-h-10 flex-1 rounded-xl px-2 text-sm font-semibold transition', sel ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-8 w-14 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-surface-3')}
      >
        <span className={cx('absolute top-1 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-7' : 'left-1')} />
      </button>
    </div>
  );
}

// ───────── Formularios ─────────

export function Field({ label, hint, error, children, htmlFor, className }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cx('mb-4', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full min-h-12 rounded-2xl border border-border bg-surface px-4 text-[15px] text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputClass, 'py-3', props.className)} />;
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label, unit }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; unit?: string }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" aria-label={`Disminuir ${label}`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} className="size-11 rounded-full border border-border bg-surface text-xl font-bold active:scale-95">
        −
      </button>
      <span className="tabular min-w-14 text-center text-lg font-bold" aria-live="polite">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </span>
      <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} className="size-11 rounded-full border border-border bg-surface text-xl font-bold active:scale-95">
        +
      </button>
    </div>
  );
}

/** Deslizador 0–10 con número grande y palabra descriptiva. */
export function IntensitySlider({ value, onChange, label, word }: { value: number; onChange: (v: number) => void; label: string; word?: string }) {
  const id = useId();
  const tone: Tone = value <= 3 ? 'good' : value <= 6 ? 'mid' : 'bad';
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <span className={cx('tabular text-2xl font-extrabold', toneText[tone])}>
          {value}
          <span className="ml-1 text-sm font-semibold text-muted">/10 {word && `· ${word}`}</span>
        </span>
      </div>
      <input id={id} type="range" min={0} max={10} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="intensity w-full" aria-valuetext={`${value} de 10${word ? `, ${word}` : ''}`} />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>0 nada</span>
        <span>5</span>
        <span>10 máximo</span>
      </div>
    </div>
  );
}

// ───────── Hoja inferior (diálogo accesible) ─────────

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'full',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'full' | 'auto';
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cx(
            'animate-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-xl flex-col rounded-t-[28px] border border-border bg-bg shadow-2xl focus:outline-none sm:bottom-4 sm:rounded-[28px]',
            size === 'full' ? 'h-[94dvh] sm:h-[88dvh]' : 'max-h-[90dvh]',
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
            <div className="min-w-0">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-surface-3 sm:hidden" aria-hidden />
              <Dialog.Title className="text-xl font-extrabold tracking-tight">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-sm text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Formulario</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Cerrar">
                <X size={22} />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer && <div className="border-t border-border bg-bg px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ───────── Confirmación ─────────

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Si se define, la persona debe escribir esta palabra para confirmar. */
  typeToConfirm?: string;
}

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback((o: ConfirmOptions) => {
    setTyped('');
    setOpts(o);
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };
  const blocked = !!opts?.typeToConfirm && typed.trim().toUpperCase() !== opts.typeToConfirm.toUpperCase();
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog.Root open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="animate-fade fixed inset-0 z-[60] bg-black/45" />
          <Dialog.Content className="animate-pop fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-5 shadow-2xl">
            <Dialog.Title className="text-lg font-bold">{opts?.title}</Dialog.Title>
            <Dialog.Description asChild>
              <div className="mt-2 text-sm text-muted">{opts?.message}</div>
            </Dialog.Description>
            {opts?.typeToConfirm && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold" htmlFor="confirm-type">
                  Escribe <strong>{opts.typeToConfirm}</strong> para confirmar
                </label>
                <input id="confirm-type" autoComplete="off" className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} />
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" block onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button variant={opts?.danger ? 'danger' : 'primary'} block disabled={blocked} onClick={() => close(true)}>
                {opts?.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

// ───────── Avisos (toasts) ─────────

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error' | 'info';
  action?: { label: string; onClick: () => void };
}
type ToastFn = (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;
const ToastCtx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback<ToastFn>((message, opts) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? 'ok', action: opts?.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'animate-sheet pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl',
              t.tone === 'error' ? 'bg-bad text-white' : 'bg-text text-bg',
            )}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 font-bold underline underline-offset-2"
                onClick={() => {
                  t.action!.onClick();
                  setToasts((x) => x.filter((y) => y.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Mensaje de error legible. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'QuotaExceededError') return 'No hay espacio suficiente en el dispositivo. Libera espacio o elimina fotos antiguas.';
    return e.message;
  }
  return 'Ocurrió un error inesperado';
}
