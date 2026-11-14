/**
 * Ilustraciones simples y sobrias: escala de Bristol y mapa abdominal.
 */
import type { AbdomenZone, BristolType } from '@/domain/types';
import { ABDOMEN_ZONES } from '@/domain/labels';
import { cx } from './ui';

/** Ilustración esquemática de cada tipo de Bristol (80×40). */
export function BristolIcon({ type, className, title }: { type: BristolType; className?: string; title?: string }) {
  const fill = 'var(--stool)';
  const hi = 'rgb(255 255 255 / 0.18)';
  const shapes: Record<BristolType, React.ReactNode> = {
    1: (
      <>
        {[
          [12, 22, 6],
          [27, 16, 5.5],
          [39, 25, 6.5],
          [53, 17, 5],
          [66, 23, 6],
        ].map(([cx_, cy, r], i) => (
          <g key={i}>
            <circle cx={cx_} cy={cy} r={r} fill={fill} />
            <circle cx={cx_ - r / 3} cy={cy - r / 3} r={r / 3} fill={hi} />
          </g>
        ))}
      </>
    ),
    2: (
      <>
        {[14, 24, 34, 44, 54, 64].map((x, i) => (
          <circle key={i} cx={x} cy={20 + (i % 2 ? -2 : 2)} r={7.5} fill={fill} />
        ))}
        <circle cx={22} cy={16} r={2} fill={hi} />
        <circle cx={46} cy={16} r={2} fill={hi} />
      </>
    ),
    3: (
      <>
        <rect x={6} y={12} width={68} height={16} rx={8} fill={fill} />
        {[18, 30, 42, 54, 64].map((x, i) => (
          <path key={i} d={`M${x} 13 l2 5 l-2 4`} stroke="var(--surface)" strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.8} />
        ))}
      </>
    ),
    4: (
      <>
        <path d="M8 24 C 20 10, 32 10, 42 20 S 64 30, 72 16" stroke={fill} strokeWidth={12} fill="none" strokeLinecap="round" />
        <path d="M14 19 C 22 13, 30 13, 36 17" stroke={hi} strokeWidth={3} fill="none" strokeLinecap="round" />
      </>
    ),
    5: (
      <>
        {[
          [14, 20, 9, 6],
          [34, 23, 8, 5.5],
          [52, 18, 9, 6],
          [68, 24, 6.5, 5],
        ].map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={fill} />
        ))}
      </>
    ),
    6: (
      <>
        <path
          d="M8 22 q4 -9 10 -4 q3 -7 9 -2 q5 -6 9 1 q6 -5 9 2 q6 -4 8 3 q7 -2 7 4 q5 3 1 7 q-4 4 -10 1 q-5 4 -10 0 q-6 4 -10 -1 q-6 3 -9 -2 q-7 2 -9 -3 q-6 -1 -5 -6 z"
          fill={fill}
          opacity={0.92}
        />
        <circle cx={70} cy={14} r={2.5} fill={fill} opacity={0.8} />
        <circle cx={6} cy={14} r={2} fill={fill} opacity={0.7} />
      </>
    ),
    7: (
      <>
        <path d="M6 26 q8 -8 18 -3 q10 -6 20 0 q10 -6 18 0 q8 -2 12 4 q-2 6 -12 5 q-10 3 -20 0 q-10 3 -20 0 q-12 2 -16 -6 z" fill={fill} opacity={0.75} />
        <circle cx={20} cy={14} r={2.5} fill={fill} opacity={0.55} />
        <circle cx={48} cy={12} r={2} fill={fill} opacity={0.55} />
        <circle cx={62} cy={16} r={1.6} fill={fill} opacity={0.55} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 80 40" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {shapes[type]}
    </svg>
  );
}

const ZONE_GRID: AbdomenZone[] = [
  'hipocondrio_derecho',
  'epigastrio',
  'hipocondrio_izquierdo',
  'flanco_derecho',
  'periumbilical',
  'flanco_izquierdo',
  'fosa_iliaca_derecha',
  'hipogastrio',
  'fosa_iliaca_izquierda',
];

/**
 * Mapa abdominal de 9 zonas. Se muestra como lo vería otra persona mirándote
 * de frente: tu derecha está a la izquierda de la imagen (se indica en pantalla).
 */
export function AbdomenMap({ value, onChange }: { value?: AbdomenZone; onChange: (z: AbdomenZone | undefined) => void }) {
  const label = (z: AbdomenZone) => ABDOMEN_ZONES.find((x) => x.value === z)!.label;
  return (
    <div>
      <div className="relative mx-auto w-full max-w-[260px]">
        <svg viewBox="0 0 200 230" className="w-full" aria-hidden>
          <path d="M40 10 Q100 -6 160 10 L172 120 Q176 200 150 222 L50 222 Q24 200 28 120 Z" fill="var(--surface-2)" stroke="var(--border)" strokeWidth={2} />
          <circle cx={100} cy={118} r={4} fill="var(--muted)" opacity={0.5} />
        </svg>
        <div className="absolute inset-x-[16%] bottom-[5%] top-[6%] grid grid-cols-3 grid-rows-3 gap-1" role="radiogroup" aria-label="Ubicación del dolor">
          {ZONE_GRID.map((z) => {
            const sel = value === z;
            return (
              <button
                key={z}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={label(z)}
                title={label(z)}
                onClick={() => onChange(sel ? undefined : z)}
                className={cx('rounded-xl border-2 transition', sel ? 'border-bad bg-bad/30' : 'border-transparent bg-text/5 hover:bg-text/10')}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex justify-between px-6 text-[11px] text-muted">
        <span>Tu derecha</span>
        <span>Tu izquierda</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          aria-pressed={value === 'general'}
          onClick={() => onChange(value === 'general' ? undefined : 'general')}
          className={cx('rounded-full border px-3 py-1.5 text-sm font-medium', value === 'general' ? 'border-bad bg-bad-soft text-bad' : 'border-border')}
        >
          Todo el abdomen
        </button>
        <span className="text-sm font-semibold text-text">{value ? label(value) : 'Toca una zona (opcional)'}</span>
      </div>
    </div>
  );
}
