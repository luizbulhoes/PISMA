/** Rótulos e naturezas — cópia local para o browser (evita CJS de @pisma/domain). */

export const ROLE_LABELS: Record<string, string> = {
  MASTER: 'Master',
  TECHNICIAN: 'Técnico',
  TST: 'TST',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Gestor',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? role;
}

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

export type NatureFill = 'APPLICABLE' | 'NA';

export function defaultNaturesMap(): Record<string, NatureFill> {
  return Object.fromEntries(ACTIVITY_NATURES.map((n) => [n.code, 'NA' as NatureFill]));
}

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  fullName: 'Nome completo',
  cpf: 'CPF',
  employeeNumber: 'Matrícula',
  jobFunction: 'Função',
  employer: 'Empresa',
  birthYear: 'Ano de nascimento',
};
