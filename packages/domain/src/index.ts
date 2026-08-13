/** Papéis do sistema — PRD §5 */
export { ROLES, type Role } from './roles';

/** Slots / estados / regras de PT */
export {
  PT_APPROVAL_SLOTS,
  PT_STATUSES,
  canActAsApprovalSlot,
  canEmitPt,
  canTransitionPt,
  assertPtTransition,
  nextStatusAfterApproval,
  type PtApprovalSlot,
  type PtStatus,
} from './pt';

/** Escopos de bloqueio operacional — PRD §5.5.2 / §42 */
export const OPERATIONAL_BLOCK_SCOPES = [
  'EMIT_PT',
  'APPROVE_PT',
  'SIGN',
  'MANAGE_TECHNICIANS',
  'ALL_OPERATIONAL',
  'CUSTOM',
] as const;
export type OperationalBlockScope = (typeof OPERATIONAL_BLOCK_SCOPES)[number];

export const USER_STATUSES = [
  'PENDING_FIRST_LOGIN',
  'ACTIVE',
  'LOCKED',
  'DISABLED',
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const WORK_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

/** Checklist SIM/NÃO/N/A — PRD §4.1 */
export const YES_NO_NA = ['YES', 'NO', 'NA'] as const;
export type YesNoNa = (typeof YES_NO_NA)[number];

export const RECORD_VERSION_STATUSES = [
  'ACTIVE',
  'SUPERSEDED',
  'CANCELLED',
] as const;
export type RecordVersionStatus = (typeof RECORD_VERSION_STATUSES)[number];

export function isBlockingChecklistAnswer(
  value: YesNoNa | null | undefined,
): boolean {
  return value === null || value === undefined || value === 'NO';
}

/** RA/RQA + gate CAT */
export {
  OCCURRENCE_TYPES,
  OCCURRENCE_STATUSES,
  CAT_APPLICABILITY,
  canSubmitConclusionForSignatures,
  requiresCatPdf,
  type OccurrenceType,
  type OccurrenceStatus,
  type CatApplicability,
} from './occurrence';

/** Triagem Audicamp/PAC — sem linguagem de culpa */
export const AUDICAMP_TRIAGE = [
  'REGISTER_ONLY',
  'GUIDANCE',
  'PAC_SUGGESTED',
  'PAC_REQUIRED',
  'IMMINENT_RISK',
] as const;
export type AudicampTriage = (typeof AUDICAMP_TRIAGE)[number];

export function suggestAudicampTriage(params: {
  riskImminent: boolean;
  goodPractice: boolean;
  deviationsCount: number;
}): AudicampTriage {
  if (params.riskImminent) return 'IMMINENT_RISK';
  if (params.goodPractice && params.deviationsCount === 0) return 'REGISTER_ONLY';
  if (params.deviationsCount >= 3) return 'PAC_REQUIRED';
  if (params.deviationsCount >= 1) return 'PAC_SUGGESTED';
  return 'GUIDANCE';
}

export * from './validity';
