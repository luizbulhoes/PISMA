/** Tipos e estados RA/RQA — PRD §8B / §86 */

export const OCCURRENCE_TYPES = ['RA', 'RQA'] as const;
export type OccurrenceType = (typeof OCCURRENCE_TYPES)[number];

export const OCCURRENCE_STATUSES = [
  'OPEN',
  'COLLECTING_INFO',
  'AWAITING_STATEMENTS',
  'IN_ANALYSIS',
  'CONCLUSION_DRAFT',
  'AWAITING_SIGNATURES',
  'CONCLUDED',
  'REOPENED',
  'CANCELLED',
  'ARCHIVED',
  'AWAITING_DOCUMENTS',
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const CAT_APPLICABILITY = ['YES', 'NO', 'UNDER_REVIEW'] as const;
export type CatApplicability = (typeof CAT_APPLICABILITY)[number];

/**
 * Gate CAT PDF para RA — PRD §86.1
 * RQA não exige CAT por padrão.
 */
export function canSubmitConclusionForSignatures(params: {
  occurrenceType: OccurrenceType;
  hasCatPdf: boolean;
}): { ok: boolean; reason?: string } {
  if (params.occurrenceType === 'RA' && !params.hasCatPdf) {
    return {
      ok: false,
      reason: 'RA exige PDF da CAT anexado antes de enviar conclusão para assinaturas',
    };
  }
  return { ok: true };
}

export function requiresCatPdf(occurrenceType: OccurrenceType): boolean {
  return occurrenceType === 'RA';
}
