import {
  OCCURRENCE_TYPES,
  OPERATIONAL_BLOCK_SCOPES,
  PT_APPROVAL_SLOTS,
  PT_STATUSES,
  ROLES,
  YES_NO_NA,
} from '@pisma/domain';
import { z } from 'zod';

export const roleSchema = z.enum(ROLES);

export const loginSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(8).max(128),
  workId: z.string().uuid().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Z]/, 'precisa de maiúscula')
    .regex(/[a-z]/, 'precisa de minúscula')
    .regex(/[0-9]/, 'precisa de número')
    .regex(/[^A-Za-z0-9]/, 'precisa de caractere especial'),
});

export const createWorkSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(160),
  clientName: z.string().min(2).max(160),
  companyName: z.string().min(2).max(160),
  timezone: z.string().default('America/Sao_Paulo'),
});

export const createUserSchema = z.object({
  username: z.string().min(3).max(80),
  temporaryPassword: z.string().min(10).max(128),
  fullName: z.string().min(3).max(160),
  workId: z.string().uuid(),
  role: roleSchema,
  jobFunction: z.string().max(120).optional(),
  employeeNumber: z.string().max(60).optional(),
  employer: z.string().max(160).optional(),
});

export const firstAccessProfileSchema = z.object({
  fullName: z.string().min(3).max(160),
  cpf: z.string().regex(/^\d{11}$/, 'CPF com 11 dígitos'),
  birthYear: z.number().int().min(1940).max(new Date().getFullYear() - 14),
  employeeNumber: z.string().min(1).max(60),
  jobFunction: z.string().min(2).max(120),
  employer: z.string().min(2).max(160),
  corporatePhone: z.string().max(40).optional(),
  corporateEmail: z.string().email().optional(),
});

export const firstAccessPrivacySchema = z.object({
  privacyNoticeVersion: z.string().min(1),
  accepted: z.literal(true),
});

export const firstAccessPinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
  confirmPin: z.string().regex(/^\d{6}$/),
});

export const signaturePinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
  documentHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedVersionId: z.string().uuid().optional(),
});

export const createTrainingSchema = z.object({
  technicianUserId: z.string().uuid(),
  trainingName: z.string().min(2).max(200),
  completedAt: z.string(),
  validityValue: z.number().int().positive().optional(),
  validityUnit: z.enum(['DAYS', 'MONTHS', 'YEARS']).optional(),
  validUntil: z.string().optional(),
  notes: z.string().max(500).optional(),
  certificateFileId: z.string().uuid().optional(),
});

export const createAsoSchema = z.object({
  technicianUserId: z.string().uuid(),
  asoDate: z.string(),
  validUntil: z.string(),
  administrativeNotes: z.string().max(500).optional(),
});

export const ppeItemSchema = z.object({
  description: z.string().min(2).max(200),
  caNumber: z.string().min(1).max(40),
  sizeValue: z.string().max(40).optional(),
  quantity: z.number().int().positive().default(1),
  manufacturer: z.string().max(120).optional(),
  notes: z.string().max(300).optional(),
});

export const createPpeDeliverySchema = z.object({
  technicianUserId: z.string().uuid(),
  deliveredAt: z.string(),
  reason: z.enum(['INITIAL', 'EXCHANGE', 'REPLACEMENT', 'LOSS', 'DAMAGE', 'OTHER']).default('INITIAL'),
  notes: z.string().max(500).optional(),
  oldPhotoFileId: z.string().uuid().optional(),
  newPhotoFileId: z.string().uuid().optional(),
  returnedCondition: z.string().max(200).optional(),
  oldItemDestination: z.string().max(200).optional(),
  items: z.array(ppeItemSchema).min(1),
});

export const createBlockSchema = z.object({
  userId: z.string().uuid(),
  scope: z.enum(OPERATIONAL_BLOCK_SCOPES),
  reason: z.string().min(5).max(500),
  notes: z.string().max(500).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export const createCompetencyRuleSchema = z.object({
  name: z.string().min(3).max(160),
  jobFunction: z.string().max(120).optional(),
  activityNature: z.string().max(120).optional(),
  equipmentClass: z.string().max(120).optional(),
  requirementType: z.enum(['TRAINING', 'ASO', 'AUTHORIZATION', 'DOCUMENT', 'OPERATIONAL_BLOCK']),
  requirementKey: z.string().min(2).max(160),
  blocking: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

export const yesNoNaSchema = z.enum(YES_NO_NA);
export const ptStatusSchema = z.enum(PT_STATUSES);
export const ptApprovalSlotSchema = z.enum(PT_APPROVAL_SLOTS);

export const createEquipmentSchema = z.object({
  tag: z.string().min(2).max(80),
  name: z.string().min(2).max(200),
  category: z.string().min(2).max(120),
  manufacturer: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  serialNumber: z.string().max(120).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const createEquipmentCertificateSchema = z.object({
  certificateType: z.string().min(2).max(120),
  issuedAt: z.string(),
  validUntil: z.string().optional(),
  issuer: z.string().max(160).optional(),
  fileId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const runChecklistSchema = z.object({
  templateId: z.string().uuid(),
  answers: z.array(
    z.object({
      questionKey: z.string().min(1),
      value: yesNoNaSchema,
      comment: z.string().max(500).optional(),
    }),
  ),
  ptId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const createControlledDocumentSchema = z.object({
  code: z.string().min(2).max(80),
  title: z.string().min(2).max(200),
  applicability: z.string().max(300).optional(),
  fileId: z.string().uuid().optional(),
  summary: z.string().max(1000).optional(),
});

export const publishDocumentRevisionSchema = z.object({
  revision: z.string().min(1).max(40),
  fileId: z.string().uuid(),
  changeSummary: z.string().min(3).max(1000),
  notifyRoles: z.array(roleSchema).optional(),
});

export const createRiskAnalysisSchema = z.object({
  type: z.enum(['BASE_AR', 'TASK_APR']),
  code: z.string().min(2).max(80),
  title: z.string().min(2).max(200),
  activity: z.string().min(2).max(300),
  areaId: z.string().max(80).optional(),
  processId: z.string().max(80).optional(),
  content: z.record(z.string(), z.unknown()).default({}),
});

export const createRiskInventoryItemSchema = z.object({
  code: z.string().min(2).max(80),
  hazardGroup: z.string().min(2).max(120),
  hazardDescription: z.string().min(2).max(500),
  consequences: z.string().max(500).optional(),
  exposure: z.record(z.string(), z.unknown()).optional(),
  controls: z.record(z.string(), z.unknown()).optional(),
  assessment: z.record(z.string(), z.unknown()).optional(),
});

const createPtBodySchema = z.object({
  osNumber: z.string().min(1).max(60),
  templateId: z.string().uuid().optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
  riskAnalysisId: z.string().uuid().optional(),
  equipmentAssetIds: z.array(z.string().uuid()).optional(),
  teamMembers: z
    .array(
      z.object({
        linkedUserId: z.string().uuid().optional(),
        name: z.string().min(2).max(160),
        jobFunction: z.string().max(120).optional(),
        employeeNumber: z.string().max(60).optional(),
        employer: z.string().max(160).optional(),
      }),
    )
    .optional(),
  maxValidityHours: z.number().int().positive().max(24).optional(),
});

/** Aceita payload canônico ou formulário web (os, naturezas, equipe…). */
export const createPtSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  const b = raw as Record<string, unknown>;
  if (typeof b.osNumber === 'string') return b;
  const os = b.os ?? b.os_number;
  if (typeof os !== 'string') return b;
  const teamUserIds = Array.isArray(b.teamUserIds)
    ? (b.teamUserIds as string[])
    : [];
  const aprId = (b.riskAnalysisId ?? b.aprId) as string | undefined;
  return {
    osNumber: os,
    templateId: b.templateId,
    riskAnalysisId: aprId,
    maxValidityHours: b.maxValidityHours,
    equipmentAssetIds: b.equipmentAssetIds,
    answers: {
      description: b.description,
      natures: b.natures,
      natureChecklists: b.natureChecklists,
      hazards: b.hazards,
      precautions: b.precautions,
      equipmentTags: b.equipmentTags,
      locationId: b.locationId,
      authorizeSignature: b.authorizeSignature,
      linkedAprId: aprId,
      ...(typeof b.answers === 'object' && b.answers
        ? (b.answers as Record<string, unknown>)
        : {}),
    },
    teamMembers: Array.isArray(b.teamMembers)
      ? b.teamMembers
      : teamUserIds.map((id) => ({
          linkedUserId: id,
          name: 'Técnico incluído',
        })),
  };
}, createPtBodySchema);

export const updatePtDraftSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  expectedVersionId: z.string().uuid(),
  equipmentAssetIds: z.array(z.string().uuid()).optional(),
  teamMembers: z
    .array(
      z.object({
        linkedUserId: z.string().uuid().optional(),
        name: z.string().min(2).max(160),
        jobFunction: z.string().max(120).optional(),
        employeeNumber: z.string().max(60).optional(),
        employer: z.string().max(160).optional(),
      }),
    )
    .optional(),
});

export const ptApproveSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  const b = { ...(raw as Record<string, unknown>) };
  if (b.decision === 'APPROVE') b.decision = 'APPROVED';
  if (b.decision === 'REJECT') b.decision = 'REJECTED';
  return b;
}, z.object({
  slot: ptApprovalSlotSchema,
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(500).optional(),
  pin: z.string().regex(/^\d{6}$/),
  documentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  expectedVersionId: z.string().uuid().optional(),
}));

export const ptEditAuthSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const ptEditAuthSlotSchema = z.object({
  slot: ptApprovalSlotSchema,
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(500).optional(),
  pin: z.string().regex(/^\d{6}$/),
});

export const reasonSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const createAudicampSchema = z.object({
  categoryCode: z.string().min(1).max(10),
  subcategoryCode: z.string().min(1).max(20),
  recordType: z.enum([
    'DEVIATION',
    'INCIDENT_WITNESSED',
    'GOOD_PRACTICE',
    'ENVIRONMENTAL',
    'IMPROVEMENT',
  ]),
  area: z.string().min(1).max(160),
  teamText: z.string().max(300).optional(),
  peopleObserved: z.number().int().nonnegative().optional(),
  deviationsCount: z.number().int().nonnegative().default(0),
  description: z.string().min(3).max(2000),
  riskImminent: z.boolean().default(false),
  goodPractice: z.boolean().default(false),
});

export const audicampTriageSchema = z.object({
  triageStatus: z.enum([
    'REGISTER_ONLY',
    'GUIDANCE',
    'PAC_SUGGESTED',
    'PAC_REQUIRED',
    'IMMINENT_RISK',
  ]),
  notes: z.string().max(500).optional(),
});

export const createPacSchema = z.object({
  originType: z.enum(['AUDICAMP', 'INSPECTION', 'OCCURRENCE', 'PT', 'MANUAL', 'OTHER']),
  originId: z.string().uuid().optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  action: z.string().min(3).max(2000),
  ownerUserId: z.string().uuid().optional(),
  ownerText: z.string().max(160).optional(),
  dueAt: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

export const createInspectionSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(2).max(200).optional(),
  area: z.string().max(160).optional(),
  answers: z.record(z.string(), z.unknown()).default({}),
});

export const createOccurrenceSchema = z.object({
  occurrenceType: z.enum(OCCURRENCE_TYPES),
  occurredAt: z.string(),
  location: z.string().min(2).max(200),
  equipmentTag: z.string().max(80).optional(),
  relatedOsNumber: z.string().max(60).optional(),
  relatedPtId: z.string().uuid().optional(),
  initialDescription: z.string().min(5).max(4000),
  immediateConsequences: z.string().max(2000).optional(),
  immediateActions: z.string().max(2000).optional(),
  initialClassification: z.string().max(120).optional(),
  primaryInvolvedUserId: z.string().uuid().optional(),
  catApplicability: z.enum(['YES', 'NO', 'UNDER_REVIEW']).optional(),
});

export const occurrenceStatementDraftSchema = z.object({
  taskId: z.string().uuid().optional(),
  statementType: z.enum(['INITIAL', 'SUPPLEMENTAL', 'CLARIFICATION']).default('INITIAL'),
  content: z.record(z.string(), z.unknown()),
});

export const occurrenceConclusionSchema = z.object({
  summary: z.string().min(5).max(4000),
  confirmedFacts: z.string().max(4000).optional(),
  evidenceBasis: z.string().max(4000).optional(),
  chronologyBasis: z.string().max(4000).optional(),
  contributingFactors: z.string().max(4000).optional(),
  reasoning: z.string().max(4000).optional(),
  conclusionText: z.string().min(5).max(4000),
  measuresTaken: z.string().max(4000).optional(),
  futureActions: z.string().max(4000).optional(),
  openItems: z.string().max(4000).optional(),
});

export const createPreaSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  const b = raw as Record<string, unknown>;
  if (b.content) return b;
  return {
    title: b.title,
    location: b.location,
    description: b.description,
    content: {
      waste: b.waste,
      photos: b.photos,
      locationId: b.locationId,
      wasteCatalogIds: b.wasteCatalogIds,
    },
  };
}, z.object({
  title: z.string().min(3).max(200),
  location: z.string().min(2).max(200),
  description: z.string().min(5).max(4000),
  content: z.record(z.string(), z.unknown()).default({}),
}));

export const createWasteCatalogSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(2).max(200),
  hazardClass: z.string().max(80).optional(),
  unit: z.enum(['KG', 'L', 'UN', 'M3']).default('KG'),
  notes: z.string().max(500).optional(),
});

export const createWasteLotSchema = z.object({
  catalogId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.enum(['KG', 'L', 'UN', 'M3']).default('KG'),
  originArea: z.string().max(160).optional(),
  storageLocation: z.string().max(160).optional(),
  notes: z.string().max(500).optional(),
});

export const createWasteRemovalRequestSchema = z.object({
  scheduledAt: z.string().optional(),
  destination: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        wasteLotId: z.string().uuid(),
        quantity: z.number().positive(),
        unit: z.enum(['KG', 'L', 'UN', 'M3']).default('KG'),
      }),
    )
    .min(1),
});

export const syncPushSchema = z.object({
  clientMutationId: z.string().min(8).max(80),
  entityType: z.string().min(2).max(80),
  entityId: z.string().uuid().optional(),
  expectedVersionId: z.string().uuid().optional(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  payload: z.record(z.string(), z.unknown()),
  createdOfflineAt: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkInput = z.infer<typeof createWorkSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreatePtInput = z.infer<typeof createPtSchema>;
