import type { Role } from './roles';

/** Slots de aprovação da PT — PRD §24 */
export const PT_APPROVAL_SLOTS = ['TST', 'SUPERVISOR'] as const;
export type PtApprovalSlot = (typeof PT_APPROVAL_SLOTS)[number];

/** Estados da PT — PRD §30 (+ EDIT_AUTHORIZED §25) */
export const PT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REJECTED',
  'EDIT_AUTHORIZED',
  'IN_EXECUTION',
  'SUSPENDED',
  'CLOSED',
  'CANCELLED',
] as const;
export type PtStatus = (typeof PT_STATUSES)[number];

/** Transições permitidas — backend decide (PRD §30.1) */
const PT_TRANSITIONS: Record<PtStatus, readonly PtStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: [
    'PARTIALLY_APPROVED',
    'APPROVED',
    'REJECTED',
    'EDIT_AUTHORIZED',
    'CANCELLED',
  ],
  PARTIALLY_APPROVED: ['APPROVED', 'REJECTED', 'EDIT_AUTHORIZED', 'CANCELLED'],
  APPROVED: ['IN_EXECUTION', 'EDIT_AUTHORIZED', 'CANCELLED'],
  REJECTED: ['EDIT_AUTHORIZED', 'CANCELLED'],
  EDIT_AUTHORIZED: ['DRAFT', 'CANCELLED'],
  IN_EXECUTION: ['SUSPENDED', 'CLOSED', 'CANCELLED'],
  SUSPENDED: ['IN_EXECUTION', 'CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransitionPt(from: PtStatus, to: PtStatus): boolean {
  return (PT_TRANSITIONS[from] ?? []).includes(to);
}

export function assertPtTransition(from: PtStatus, to: PtStatus): void {
  if (!canTransitionPt(from, to)) {
    throw new Error(`Transição de PT inválida: ${from} -> ${to}`);
  }
}

/** Após decisão de um slot, qual status operacional? */
export function nextStatusAfterApproval(params: {
  current: PtStatus;
  tstApproved: boolean;
  supervisorApproved: boolean;
  decision: 'APPROVED' | 'REJECTED';
}): PtStatus {
  if (params.decision === 'REJECTED') return 'REJECTED';
  if (params.tstApproved && params.supervisorApproved) return 'APPROVED';
  if (params.tstApproved || params.supervisorApproved) return 'PARTIALLY_APPROVED';
  return params.current === 'DRAFT' ? 'SUBMITTED' : params.current;
}

/** Quem pode emitir PT — regra não negociável */
export function canEmitPt(role: Role): boolean {
  return role === 'TECHNICIAN';
}

/** Gestor pode atuar em slots TST/Supervisor, mas não emite PT */
export function canActAsApprovalSlot(role: Role, slot: PtApprovalSlot): boolean {
  if (role === 'MANAGER') return true;
  if (slot === 'TST') return role === 'TST';
  if (slot === 'SUPERVISOR') return role === 'SUPERVISOR';
  return false;
}
