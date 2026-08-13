export const statusTone = {
  success: 'var(--pisma-success-600)',
  warning: 'var(--pisma-warning-500)',
  danger: 'var(--pisma-danger-600)',
  info: 'var(--pisma-action-600)',
  neutral: 'var(--pisma-neutral-600)',
} as const;

export type StatusTone = keyof typeof statusTone;
