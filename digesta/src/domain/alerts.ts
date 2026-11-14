/**
 * Señales de alarma. DIGESTA no diagnostica: sólo muestra recomendaciones
 * prudentes para buscar atención médica cuando se registran signos que
 * merecen valoración profesional.
 */
import { DAY, HOUR } from './dates';
import type { Stool, Symptom } from './types';

export type AlertLevel = 'urgente' | 'pronto' | 'atencion';

export interface MedicalAlert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  at: number;
}

export const EMERGENCY_LINE = '123';

export const ALERT_LEVEL_INFO: Record<AlertLevel, { label: string; tone: 'bad' | 'mid' }> = {
  urgente: { label: 'Busca atención médica hoy', tone: 'bad' },
  pronto: { label: 'Consulta pronto', tone: 'mid' },
  atencion: { label: 'Para tener en cuenta', tone: 'mid' },
};

const LEVEL_ORDER: Record<AlertLevel, number> = { urgente: 0, pronto: 1, atencion: 2 };

/** Alertas derivadas de una sola deposición. */
export function stoolAlerts(s: Stool): MedicalAlert[] {
  const out: MedicalAlert[] = [];
  if (s.color === 'negro') {
    out.push({
      id: `${s.id}-negro`,
      level: 'urgente',
      title: 'Heces negras o como alquitrán',
      message:
        'Las heces negras, pegajosas y con mal olor pueden indicar sangrado en el tracto digestivo alto. Busca atención médica hoy mismo. ' +
        'Algunos suplementos de hierro o el subsalicilato de bismuto también oscurecen las heces: coméntalo al profesional. ' +
        `Si hay mareo, desmayo, vómito con sangre o dolor fuerte, llama a la línea de emergencias ${EMERGENCY_LINE}.`,
      at: s.at,
    });
  }
  if (s.blood === 'abundante') {
    out.push({
      id: `${s.id}-sangre-abundante`,
      level: 'urgente',
      title: 'Sangre abundante en la deposición',
      message: `Una cantidad abundante de sangre requiere valoración médica urgente. Acude a urgencias o llama al ${EMERGENCY_LINE}, sobre todo si sientes mareo, debilidad o palpitaciones.`,
      at: s.at,
    });
  } else if (s.blood === 'heces') {
    out.push({
      id: `${s.id}-sangre`,
      level: 'pronto',
      title: 'Sangre en las heces',
      message:
        'Observar sangre mezclada con las heces debe ser valorado por un médico en los próximos días. Si se repite, aumenta o se acompaña de dolor, fiebre o mareo, busca atención el mismo día.',
      at: s.at,
    });
  } else if (s.blood === 'papel') {
    out.push({
      id: `${s.id}-sangre-papel`,
      level: 'atencion',
      title: 'Rastros de sangre en el papel',
      message:
        'Puede deberse a causas leves como fisuras o hemorroides, pero conviene comentarlo con un médico, especialmente si se repite o cambia tu hábito intestinal.',
      at: s.at,
    });
  }
  if (s.color === 'rojo' && s.blood === 'no') {
    out.push({
      id: `${s.id}-rojo`,
      level: 'atencion',
      title: 'Heces de color rojizo',
      message:
        'Alimentos como remolacha o colorantes pueden teñir las heces. Si no comiste nada que lo explique o se repite, consulta con un médico.',
      at: s.at,
    });
  }
  if (s.color === 'gris_claro') {
    out.push({
      id: `${s.id}-acolia`,
      level: 'pronto',
      title: 'Heces muy claras, grises o color arcilla',
      message: 'Las heces persistentemente pálidas pueden relacionarse con la vía biliar o el hígado. Consulta con un médico, sobre todo si notas piel u ojos amarillos u orina oscura.',
      at: s.at,
    });
  }
  if ((s.painIntensity ?? 0) >= 8) {
    out.push({
      id: `${s.id}-dolor`,
      level: 'pronto',
      title: 'Dolor fuerte al evacuar',
      message: 'Un dolor fuerte relacionado con la evacuación merece valoración médica, en especial si persiste o se repite.',
      at: s.at,
    });
  }
  return out;
}

/** Alertas derivadas de un síntoma. */
export function symptomAlerts(s: Symptom, now = Date.now()): MedicalAlert[] {
  const out: MedicalAlert[] = [];
  const end = s.endedAt ?? (s.durationMin ? s.startedAt + s.durationMin * 60_000 : now);
  const hours = (end - s.startedAt) / HOUR;
  const isPain = s.type === 'dolor' || s.type === 'retortijones';
  if (isPain && s.intensity >= 8 && hours >= 6) {
    out.push({
      id: `${s.id}-dolor-persistente`,
      level: 'urgente',
      title: 'Dolor abdominal intenso y persistente',
      message: `Un dolor abdominal fuerte que dura varias horas debe valorarse hoy en un servicio de urgencias, más aún si hay fiebre, vómito, abdomen duro o sangre. Línea de emergencias: ${EMERGENCY_LINE}.`,
      at: s.startedAt,
    });
  } else if (isPain && s.intensity >= 8) {
    out.push({
      id: `${s.id}-dolor-intenso`,
      level: 'pronto',
      title: 'Dolor abdominal intenso',
      message:
        'Si el dolor intenso no cede en pocas horas, empeora, o se acompaña de fiebre, vómito persistente, abdomen rígido o sangre, busca atención médica de inmediato.',
      at: s.startedAt,
    });
  }
  if (s.type === 'vomito' && s.intensity >= 7) {
    out.push({
      id: `${s.id}-vomito`,
      level: 'pronto',
      title: 'Vómito intenso',
      message: 'Si no logras retener líquidos, hay sangre o aspecto de "cuncho de café", o sientes mucha debilidad, busca atención médica. Mantente hidratado con sorbos pequeños.',
      at: s.startedAt,
    });
  }
  return out;
}

/**
 * Alertas de patrón en un conjunto de registros recientes:
 * diarrea muy frecuente o persistente.
 */
export function patternAlerts(stools: Stool[], now = Date.now()): MedicalAlert[] {
  const out: MedicalAlert[] = [];
  const last24 = stools.filter((s) => s.at > now - DAY && s.at <= now && s.bristol >= 6);
  if (last24.length >= 6) {
    out.push({
      id: `patron-diarrea-24h-${Math.floor(now / DAY)}`,
      level: 'pronto',
      title: 'Muchas deposiciones líquidas hoy',
      message: `Registraste ${last24.length} deposiciones blandas o líquidas en 24 horas. Hidrátate con suero oral y consulta si hay fiebre, sangre, mareo, poca orina o si continúa.`,
      at: now,
    });
  }
  // Diarrea (Bristol 6–7 ≥3 veces al día) durante 3 días seguidos o más
  const byDay = new Map<number, number>();
  for (const s of stools) {
    if (s.bristol >= 6 && s.at > now - 14 * DAY) {
      const d = Math.floor((now - s.at) / DAY);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
  }
  let streak = 0;
  for (let d = 0; d < 14; d++) {
    if ((byDay.get(d) ?? 0) >= 3) streak++;
    else break;
  }
  if (streak >= 3) {
    out.push({
      id: `patron-diarrea-persistente-${Math.floor(now / DAY)}`,
      level: 'pronto',
      title: 'Diarrea durante varios días',
      message: `Llevas ${streak} días con deposiciones líquidas frecuentes. Conviene consultar con un médico, especialmente si hay pérdida de peso, fiebre o sangre.`,
      at: now,
    });
  }
  return out;
}

export function sortAlerts(a: MedicalAlert[]): MedicalAlert[] {
  return [...a].sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level] || y.at - x.at);
}
