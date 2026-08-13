export type ValidityTone = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'MISSING' | 'NO_EXPIRY';

export function computeValidityTone(
  validUntil: string | Date | null | undefined,
  alertDays = 30,
  now = new Date(),
): ValidityTone {
  if (!validUntil) return 'MISSING';
  const end = typeof validUntil === 'string' ? new Date(validUntil) : validUntil;
  if (Number.isNaN(end.getTime())) return 'MISSING';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.ceil((endDay.getTime() - startOfToday.getTime()) / 86_400_000);
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= alertDays) return 'EXPIRING';
  return 'VALID';
}

export function addValidity(
  completedAt: Date,
  value: number | null | undefined,
  unit: 'DAYS' | 'MONTHS' | 'YEARS' | null | undefined,
): Date | null {
  if (!value || !unit) return null;
  const d = new Date(completedAt);
  if (unit === 'DAYS') d.setDate(d.getDate() + value);
  if (unit === 'MONTHS') d.setMonth(d.getMonth() + value);
  if (unit === 'YEARS') d.setFullYear(d.getFullYear() + value);
  return d;
}

export function validityLabel(tone: ValidityTone): string {
  switch (tone) {
    case 'VALID':
      return 'Válido';
    case 'EXPIRING':
      return 'Vence em breve';
    case 'EXPIRED':
      return 'Vencido';
    case 'NO_EXPIRY':
      return 'Sem validade';
    default:
      return 'Não informado';
  }
}
