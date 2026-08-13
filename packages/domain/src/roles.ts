/** Papéis do sistema — PRD §5 */
export const ROLES = [
  'MASTER',
  'TECHNICIAN',
  'TST',
  'SUPERVISOR',
  'MANAGER',
] as const;

export type Role = (typeof ROLES)[number];
