/** Logotipo de DIGESTA: una hoja dentro de un círculo suave. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="var(--primary)" />
      <path d="M20 42c0-13 10-22 26-23-1 15-9 25-22 25-1.6 0-3-.7-4-2z" fill="var(--on-primary)" opacity="0.95" />
      <path d="M21 43c5-7 10-11 17-15" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
