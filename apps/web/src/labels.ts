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

/** Tradução de códigos internos exibidos na interface. */
export const DISPLAY_LABELS: Record<string, string> = {
  ...ROLE_LABELS,
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviada',
  PARTIALLY_APPROVED: 'Parcialmente aprovada',
  APPROVED: 'Aprovada',
  REJECTED: 'Reprovada',
  EDIT_AUTHORIZED: 'Edição autorizada',
  IN_EXECUTION: 'Em execução',
  SUSPENDED: 'Suspensa',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  MAINTENANCE: 'Manutenção',
  ARCHIVED: 'Arquivado',
  PENDING: 'Pendente',
  PENDING_FIRST_LOGIN: 'Primeiro acesso pendente',
  PENDING_SIGNATURE: 'Assinatura pendente',
  LOCKED: 'Bloqueado',
  DISABLED: 'Desativado',
  SIGNED: 'Assinado',
  IMMUTABLE: 'Imutável',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  VERIFIED: 'Verificado',
  REGISTER_ONLY: 'Somente registro',
  GUIDANCE: 'Orientação',
  PAC_SUGGESTED: 'PAC sugerido',
  PAC_REQUIRED: 'PAC obrigatório',
  IMMINENT_RISK: 'Risco iminente',
  DEVIATION: 'Desvio',
  GOOD_PRACTICE: 'Boa prática',
  INCIDENT_WITNESSED: 'Risco / incidente observado',
  ENVIRONMENTAL: 'Ambiental',
  RA: 'Registro de acidente',
  RQA: 'Registro de quase acidente',
  ACCIDENT: 'Acidente',
  NEAR_MISS: 'Quase acidente',
  YES: 'Sim',
  NO: 'Não',
  NA: 'N/A',
  NOK: 'Não conforme',
  OK: 'Conforme',
  TEMPLATE: 'Modelo',
  RUN: 'Execução',
  EMIT_PT: 'Emitir PT',
  SIGN: 'Assinar',
  ALL_OPERATIONAL: 'Todas as operações',
  APPROVE_PT: 'Aprovar PT',
  MANAGE_TECHNICIANS: 'Gerir técnicos',
  PRIMARY_INVOLVED: 'Principal envolvido',
  WITNESS: 'Testemunha',
  TECHNICIAN_DESIGNATED: 'Técnico designado',
  TECHNICIAN_1: 'Técnico 1',
  TECHNICIAN_2: 'Técnico 2',
  TECHNICIAN_3: 'Técnico 3',
  TECHNICIAN_4: 'Técnico 4',
  OTHER_INVOLVED: 'Outro envolvido',
  APPLICABLE: 'Aplicável',
  ONLINE: 'Conectado',
  OFFLINE: 'Desconectado',
  VALID: 'Válido',
  EXPIRING: 'Vence em breve',
  EXPIRED: 'Vencido',
  MISSING: 'Não informado',
  NO_EXPIRY: 'Sem validade',
  TRAINING: 'Treinamento',
  ASO: 'ASO',
  PPE: 'EPI',
  SUCCESS: 'Sucesso',
  FAILURE: 'Falha',
  DENIED: 'Negado',
  INFO: 'Informação',
  WARNING: 'Atenção',
  CRITICAL: 'Crítico',
  ALERT: 'Alerta',
  HIGH: 'Alto',
  MEDIUM: 'Médio',
  LOW: 'Baixo',
  DONE: 'Concluído',
  RELEASED: 'Liberado',
  SUPERSEDED: 'Substituído',
  CONSUMED: 'Consumido',
  AUTHORIZED: 'Autorizado',
  REVOKED: 'Revogado',
  PENDING_VALIDATION: 'Validação pendente',
  ORIENTAR: 'Orientar',
  ENCERRAR: 'Encerrar',
  GERAR_PAC: 'Gerar PAC',
  ESCALAR_RQA: 'Escalar RQA',
  BLOCKED: 'Bloqueado',
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
};

export function displayLabel(value: string | null | undefined): string {
  if (value == null || value === '' || value === '—') return '—';
  return DISPLAY_LABELS[value] ?? DISPLAY_LABELS[value.toUpperCase()] ?? value;
}
