import type { Role } from './roles';

/** Rótulos em português para exibição (enums internos permanecem em inglês). */
export const ROLE_LABELS: Record<Role, string> = {
  MASTER: 'Master',
  TECHNICIAN: 'Técnico',
  TST: 'TST',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Gestor',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role as Role] ?? role;
}

/** Naturezas de atividade — todas disponíveis; cada uma pode ser N/A. */
export const ACTIVITY_NATURES = [
  { code: 'QUENTE', label: 'Trabalho a quente' },
  { code: 'ALTURA', label: 'Trabalho em altura' },
  { code: 'ICAMENTO', label: 'Içamento' },
  { code: 'ELETRICA', label: 'Eletricidade' },
  { code: 'ESCAVACAO', label: 'Escavação' },
  { code: 'ESPACO_CONFINADO', label: 'Espaço confinado' },
  { code: 'FRIO', label: 'Trabalho a frio' },
  { code: 'ABERTURA_LINHA', label: 'Abertura de linha' },
  { code: 'OUTRO', label: 'Outro crítico' },
] as const;

export type ActivityNatureCode = (typeof ACTIVITY_NATURES)[number]['code'];

/** Status por natureza na PT/APR */
export type NatureFill = 'APPLICABLE' | 'NA';

export function defaultNaturesMap(): Record<ActivityNatureCode, NatureFill> {
  return Object.fromEntries(
    ACTIVITY_NATURES.map((n) => [n.code, 'NA' as NatureFill]),
  ) as Record<ActivityNatureCode, NatureFill>;
}
