import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  addValidity,
  computeValidityTone,
  validityLabel,
} from '@pisma/domain';
import {
  cpfSearchToken,
  encryptField,
  hashPassword,
  hashPin,
  verifyPassword,
  verifyPin,
} from '@pisma/security';
import { generateKeyPairSync } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.module';
import { DocumentsService } from '../documents/documents.service';
import { FilesService } from '../files/files.service';
import type { AuthUser } from '../auth/auth.types';

@Injectable()
export class PeopleService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    private readonly documents: DocumentsService,
    private readonly config: ConfigService,
  ) {}

  private encKey() {
    return this.config.getOrThrow<string>('FIELD_ENCRYPTION_KEY');
  }

  private pepper() {
    return this.config.getOrThrow<string>('SESSION_SECRET');
  }

  private assertSstOrManager(user: AuthUser) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException('Ação restrita a TST/Gestor/Master');
    }
  }

  private assertSameWork(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  async createUser(actor: AuthUser, input: {
    username: string;
    temporaryPassword: string;
    fullName: string;
    workId: string;
    role: string;
    jobFunction?: string;
    employeeNumber?: string;
    employer?: string;
  }) {
    if (actor.role !== 'MASTER') throw new ForbiddenException();
    const passwordHash = await hashPassword(input.temporaryPassword);
    const userRes = await this.db.query<{ id: string }>(
      `INSERT INTO users (username, password_hash, status, first_login_completed)
       VALUES ($1,$2,'PENDING_FIRST_LOGIN',FALSE)
       RETURNING id`,
      [input.username, passwordHash],
    );
    const userId = userRes.rows[0]!.id;
    await this.db.query(
      `INSERT INTO user_profiles (user_id, full_name, job_function, employee_number, employer)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        userId,
        input.fullName,
        input.jobFunction ?? null,
        input.employeeNumber ?? null,
        input.employer ?? null,
      ],
    );
    await this.db.query(
      `INSERT INTO user_work_roles (user_id, work_id, role, active, created_by)
       VALUES ($1,$2,$3,TRUE,$4)`,
      [userId, input.workId, input.role, actor.userId],
    );
    await this.audit.append({
      workId: input.workId,
      userId: actor.userId,
      entityType: 'user',
      entityId: userId,
      action: 'USER_CREATE',
      outcome: 'SUCCESS',
      payload: { username: input.username, role: input.role },
    });
    return { id: userId, username: input.username, status: 'PENDING_FIRST_LOGIN' };
  }

  async listUsers(actor: AuthUser) {
    const workId = this.assertSameWork(actor);
    if (!['MASTER', 'TST', 'MANAGER'].includes(actor.role ?? '')) {
      throw new ForbiddenException();
    }
    const res = await this.db.query(
      `SELECT u.id, u.username, u.status, u.first_login_completed, p.full_name,
              p.job_function, p.employee_number, uwr.role
       FROM users u
       JOIN user_work_roles uwr ON uwr.user_id = u.id AND uwr.work_id = $1 AND uwr.active
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ORDER BY p.full_name NULLS LAST, u.username`,
      [workId],
    );
    return { items: res.rows };
  }

  async listTechnicians(actor: AuthUser) {
    const workId = this.assertSameWork(actor);
    if (!['TST', 'MANAGER', 'MASTER', 'TECHNICIAN', 'SUPERVISOR'].includes(actor.role ?? '')) {
      throw new ForbiddenException();
    }
    const alertDaysRes = await this.db.query<{ alert_days_before_expiry: number }>(
      `SELECT alert_days_before_expiry FROM works WHERE id = $1`,
      [workId],
    );
    const alertDays = alertDaysRes.rows[0]?.alert_days_before_expiry ?? 30;

    const techs = await this.db.query<{
      id: string;
      username: string;
      full_name: string;
      job_function: string | null;
      employee_number: string | null;
      status: string;
    }>(
      `SELECT u.id, u.username, u.status, p.full_name, p.job_function, p.employee_number
       FROM users u
       JOIN user_work_roles uwr ON uwr.user_id = u.id AND uwr.work_id = $1 AND uwr.active
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE uwr.role = 'TECHNICIAN'
       ORDER BY p.full_name`,
      [workId],
    );

    const items = [];
    for (const t of techs.rows) {
      const aso = await this.db.query<{ valid_until: string }>(
        `SELECT valid_until::text FROM employee_aso_records
         WHERE work_id=$1 AND technician_user_id=$2 AND status='ACTIVE'
         ORDER BY valid_until DESC LIMIT 1`,
        [workId, t.id],
      );
      const trainings = await this.db.query<{ valid_until: string | null }>(
        `SELECT valid_until::text FROM employee_trainings
         WHERE work_id=$1 AND technician_user_id=$2 AND status='ACTIVE'`,
        [workId, t.id],
      );
      const ppe = await this.db.query<{ delivered_at: string; item_count: string }>(
        `SELECT d.delivered_at::text, COUNT(i.id)::text AS item_count
         FROM ppe_deliveries d
         LEFT JOIN ppe_delivery_items i ON i.ppe_delivery_id = d.id
         WHERE d.work_id=$1 AND d.technician_user_id=$2 AND d.status='ACTIVE'
         GROUP BY d.id
         ORDER BY d.delivered_at DESC LIMIT 1`,
        [workId, t.id],
      );
      const block = await this.db.query(
        `SELECT id FROM user_operational_blocks
         WHERE work_id=$1 AND user_id=$2 AND status='ACTIVE'
           AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW())
         LIMIT 1`,
        [workId, t.id],
      );

      let valid = 0;
      let expiring = 0;
      let expired = 0;
      for (const tr of trainings.rows) {
        const tone = tr.valid_until
          ? computeValidityTone(tr.valid_until, alertDays)
          : 'NO_EXPIRY';
        if (tone === 'VALID' || tone === 'NO_EXPIRY') valid += 1;
        if (tone === 'EXPIRING') expiring += 1;
        if (tone === 'EXPIRED') expired += 1;
      }

      const asoTone = aso.rows[0]
        ? computeValidityTone(aso.rows[0].valid_until, alertDays)
        : 'MISSING';

      items.push({
        ...t,
        aso: {
          tone: asoTone,
          label: validityLabel(asoTone),
          validUntil: aso.rows[0]?.valid_until ?? null,
        },
        trainings: { valid, expiring, expired, total: trainings.rows.length },
        lastPpe: ppe.rows[0]
          ? { deliveredAt: ppe.rows[0].delivered_at, itemCount: Number(ppe.rows[0].item_count) }
          : null,
        blocked: Boolean(block.rowCount),
      });
    }

    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'technician_list',
      action: 'TECH_LIST_VIEWED',
      outcome: 'SUCCESS',
    });
    return { items, alertDays };
  }

  async getTechnicianProfile(actor: AuthUser, technicianId: string) {
    const workId = this.assertSameWork(actor);
    const isSelf = actor.userId === technicianId;
    if (!isSelf) this.assertSstOrManager(actor);
    if (isSelf && actor.role !== 'TECHNICIAN' && !['TST', 'MANAGER', 'MASTER'].includes(actor.role ?? '')) {
      // allow self view for any role of own profile summary
    }

    const profile = await this.db.query(
      `SELECT u.id, u.username, u.status, u.first_login_completed,
              p.full_name, p.birth_year, p.employee_number, p.job_function, p.employer,
              p.selfie_file_id, p.badge_front_file_id, p.badge_back_file_id,
              p.privacy_notice_accepted_at, p.profile_validation_status,
              (SELECT status FROM signature_credentials sc
                WHERE sc.user_id = u.id AND sc.status='ACTIVE' ORDER BY key_version DESC LIMIT 1) AS signature_status
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [technicianId],
    );
    if (!profile.rows[0]) throw new NotFoundException('Técnico não encontrado');

    const work = await this.db.query(
      `SELECT id, code, name, alert_days_before_expiry FROM works WHERE id = $1`,
      [workId],
    );
    const alertDays = work.rows[0]?.alert_days_before_expiry ?? 30;

    const trainings = await this.db.query(
      `SELECT id, training_name, completed_at::text, validity_value, validity_unit,
              valid_until::text, notes, status, created_at
       FROM employee_trainings
       WHERE work_id=$1 AND technician_user_id=$2
       ORDER BY created_at DESC`,
      [workId, technicianId],
    );
    const asos = await this.db.query(
      `SELECT id, aso_date::text, valid_until::text, administrative_notes, status, created_at
       FROM employee_aso_records
       WHERE work_id=$1 AND technician_user_id=$2
       ORDER BY created_at DESC`,
      [workId, technicianId],
    );
    const ppes = await this.db.query(
      `SELECT d.*, 
        (SELECT json_agg(json_build_object(
           'id', i.id, 'description', i.description, 'caNumber', i.ca_number,
           'sizeValue', i.size_value, 'quantity', i.quantity, 'manufacturer', i.manufacturer
         )) FROM ppe_delivery_items i WHERE i.ppe_delivery_id = d.id) AS items
       FROM ppe_deliveries d
       WHERE d.work_id=$1 AND d.technician_user_id=$2
       ORDER BY d.delivered_at DESC, d.created_at DESC`,
      [workId, technicianId],
    );
    const blocks = await this.db.query(
      `SELECT id, scope, reason, status, starts_at, ends_at, created_at
       FROM user_operational_blocks
       WHERE work_id=$1 AND user_id=$2
       ORDER BY created_at DESC`,
      [workId, technicianId],
    );

    const trainingCards = trainings.rows.map((t) => {
      const tone = t.valid_until
        ? computeValidityTone(t.valid_until as string, alertDays)
        : t.status === 'ACTIVE'
          ? 'NO_EXPIRY'
          : 'MISSING';
      return { ...t, tone, toneLabel: validityLabel(tone as never) };
    });
    const asoCards = asos.rows.map((a) => {
      const tone = computeValidityTone(a.valid_until as string, alertDays);
      return { ...a, tone, toneLabel: validityLabel(tone) };
    });

    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'technician_profile',
      entityId: technicianId,
      action: 'TECH_PROFILE_VIEWED',
      outcome: 'SUCCESS',
    });

    return {
      profile: profile.rows[0],
      work: work.rows[0],
      trainings: trainingCards,
      asos: asoCards,
      ppeDeliveries: ppes.rows,
      blocks: blocks.rows,
      alertDays,
    };
  }

  async changePassword(actor: AuthUser, currentPassword: string, newPassword: string) {
    const user = await this.db.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [actor.userId],
    );
    const ok = await verifyPassword(currentPassword, user.rows[0]!.password_hash);
    if (!ok) throw new BadRequestException('Senha atual inválida');
    const hash = await hashPassword(newPassword);
    await this.db.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      hash,
      actor.userId,
    ]);
    await this.audit.append({
      workId: actor.workId,
      userId: actor.userId,
      entityType: 'user',
      entityId: actor.userId,
      action: 'PASSWORD_CHANGED',
      outcome: 'SUCCESS',
    });
    return { ok: true };
  }

  async saveFirstAccessProfile(actor: AuthUser, input: {
    fullName: string;
    cpf: string;
    birthYear: number;
    employeeNumber: string;
    jobFunction: string;
    employer: string;
    corporatePhone?: string;
    corporateEmail?: string;
  }) {
    const cpfEnc = encryptField(input.cpf, this.encKey());
    const token = cpfSearchToken(input.cpf, this.pepper());
    await this.db.query(
      `INSERT INTO user_profiles (
         user_id, full_name, cpf_encrypted, cpf_search_token, birth_year,
         employee_number, job_function, employer, corporate_phone, corporate_email
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         cpf_encrypted = EXCLUDED.cpf_encrypted,
         cpf_search_token = EXCLUDED.cpf_search_token,
         birth_year = EXCLUDED.birth_year,
         employee_number = EXCLUDED.employee_number,
         job_function = EXCLUDED.job_function,
         employer = EXCLUDED.employer,
         corporate_phone = EXCLUDED.corporate_phone,
         corporate_email = EXCLUDED.corporate_email,
         updated_at = NOW()`,
      [
        actor.userId,
        input.fullName,
        cpfEnc,
        token,
        input.birthYear,
        input.employeeNumber,
        input.jobFunction,
        input.employer,
        input.corporatePhone ?? null,
        input.corporateEmail ?? null,
      ],
    );
    return { ok: true };
  }

  async acceptPrivacy(actor: AuthUser, version: string) {
    await this.db.query(
      `UPDATE user_profiles
       SET privacy_notice_version = $2, privacy_notice_accepted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [actor.userId, version],
    );
    await this.audit.append({
      workId: actor.workId,
      userId: actor.userId,
      entityType: 'user',
      entityId: actor.userId,
      action: 'PRIVACY_ACCEPTED',
      outcome: 'SUCCESS',
      payload: { version },
    });
    return { ok: true };
  }

  async saveVisualSignature(actor: AuthUser, pngBase64: string) {
    const raw = pngBase64.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length < 100) throw new BadRequestException('Assinatura inválida');
    const stored = await this.files.store({
      buffer,
      originalName: `signature-${actor.userId}.png`,
      mimeType: 'image/png',
      uploadedBy: actor.userId,
      workId: actor.workId ?? undefined,
      confidentiality: 'RESTRICTED',
    });
    await this.db.query(
      `UPDATE signature_credentials SET visual_signature_file_id = $2
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [actor.userId, stored.id],
    );
    // if no credential yet, create placeholder without pin
    const exists = await this.db.query(
      `SELECT id FROM signature_credentials WHERE user_id = $1 AND status='ACTIVE'`,
      [actor.userId],
    );
    if (!exists.rowCount) {
      await this.db.query(
        `INSERT INTO signature_credentials
          (user_id, public_key, encrypted_private_key_blob, pin_hash, visual_signature_file_id, status)
         VALUES ($1,'PENDING','PENDING','PENDING',$2,'ACTIVE')`,
        [actor.userId, stored.id],
      );
    }
    return { fileId: stored.id };
  }

  async setupSignatureCredential(actor: AuthUser, pin: string, confirmPin: string) {
    if (pin !== confirmPin) throw new BadRequestException('PIN de confirmação diferente');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const pinHash = await hashPin(pin);
    const blob = encryptField(privateKey, this.encKey());
    await this.db.query(
      `UPDATE signature_credentials SET status='REVOKED', revoked_at=NOW(), revoked_reason='REPLACED'
       WHERE user_id=$1 AND status='ACTIVE'`,
      [actor.userId],
    );
    const visual = await this.db.query<{ visual_signature_file_id: string | null }>(
      `SELECT visual_signature_file_id FROM signature_credentials
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [actor.userId],
    );
    await this.db.query(
      `INSERT INTO signature_credentials
        (user_id, public_key, encrypted_private_key_blob, pin_hash, visual_signature_file_id, status, key_version)
       VALUES ($1,$2,$3,$4,$5,'ACTIVE', COALESCE((SELECT MAX(key_version)+1 FROM signature_credentials WHERE user_id=$1),1))`,
      [
        actor.userId,
        publicKey,
        blob,
        pinHash,
        visual.rows[0]?.visual_signature_file_id ?? null,
      ],
    );
    await this.audit.append({
      workId: actor.workId,
      userId: actor.userId,
      entityType: 'signature_credential',
      entityId: actor.userId,
      action: 'SIGNATURE_CREDENTIAL_CREATED',
      outcome: 'SUCCESS',
    });
    return { ok: true };
  }

  async attachIdentityPhoto(
    actor: AuthUser,
    kind: 'selfie' | 'badge_front' | 'badge_back',
    fileId: string,
  ) {
    const col =
      kind === 'selfie'
        ? 'selfie_file_id'
        : kind === 'badge_front'
          ? 'badge_front_file_id'
          : 'badge_back_file_id';
    await this.db.query(
      `UPDATE user_profiles SET ${col} = $2, updated_at = NOW() WHERE user_id = $1`,
      [actor.userId, fileId],
    );
    return { ok: true };
  }

  async completeFirstAccess(actor: AuthUser) {
    const p = await this.db.query(
      `SELECT full_name, cpf_encrypted, birth_year, employee_number, job_function, employer,
              selfie_file_id, badge_front_file_id, badge_back_file_id, privacy_notice_accepted_at
       FROM user_profiles WHERE user_id = $1`,
      [actor.userId],
    );
    const row = p.rows[0];
    if (!row?.full_name || !row.cpf_encrypted || !row.privacy_notice_accepted_at) {
      throw new BadRequestException('Cadastro incompleto');
    }
    if (!row.selfie_file_id || !row.badge_front_file_id || !row.badge_back_file_id) {
      throw new BadRequestException('Selfie e crachá (frente/verso) são obrigatórios');
    }
    const cred = await this.db.query(
      `SELECT id, pin_hash, visual_signature_file_id FROM signature_credentials
       WHERE user_id=$1 AND status='ACTIVE' AND pin_hash <> 'PENDING'`,
      [actor.userId],
    );
    if (!cred.rows[0]?.visual_signature_file_id) {
      throw new BadRequestException('Assinatura visual e PIN obrigatórios');
    }
    await this.db.query(
      `UPDATE users SET first_login_completed=TRUE, status='ACTIVE', updated_at=NOW() WHERE id=$1`,
      [actor.userId],
    );
    await this.db.query(
      `UPDATE user_profiles SET profile_validation_status='PENDING_VALIDATION', updated_at=NOW()
       WHERE user_id=$1`,
      [actor.userId],
    );
    await this.audit.append({
      workId: actor.workId,
      userId: actor.userId,
      entityType: 'user',
      entityId: actor.userId,
      action: 'FIRST_ACCESS_COMPLETED',
      outcome: 'SUCCESS',
    });
    return { ok: true, status: 'ACTIVE', validation: 'PENDING_VALIDATION' };
  }

  async createTraining(actor: AuthUser, input: {
    technicianUserId: string;
    trainingName: string;
    completedAt: string;
    validityValue?: number;
    validityUnit?: 'DAYS' | 'MONTHS' | 'YEARS';
    validUntil?: string;
    notes?: string;
    certificateFileId?: string;
  }) {
    const workId = this.assertSameWork(actor);
    this.assertSstOrManager(actor);
    let validUntil = input.validUntil ?? null;
    if (!validUntil && input.validityValue && input.validityUnit) {
      const calc = addValidity(new Date(input.completedAt), input.validityValue, input.validityUnit);
      validUntil = calc ? calc.toISOString().slice(0, 10) : null;
    }
    const res = await this.db.query(
      `INSERT INTO employee_trainings
        (work_id, technician_user_id, training_name, completed_at, validity_value, validity_unit,
         valid_until, notes, certificate_file_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, valid_until::text`,
      [
        workId,
        input.technicianUserId,
        input.trainingName,
        input.completedAt,
        input.validityValue ?? null,
        input.validityUnit ?? null,
        validUntil,
        input.notes ?? null,
        input.certificateFileId ?? null,
        actor.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'employee_training',
      entityId: res.rows[0].id,
      action: 'TRAINING_CREATE',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async createAso(actor: AuthUser, input: {
    technicianUserId: string;
    asoDate: string;
    validUntil: string;
    administrativeNotes?: string;
  }) {
    const workId = this.assertSameWork(actor);
    this.assertSstOrManager(actor);
    await this.db.query(
      `UPDATE employee_aso_records SET status='SUPERSEDED'
       WHERE work_id=$1 AND technician_user_id=$2 AND status='ACTIVE'`,
      [workId, input.technicianUserId],
    );
    const res = await this.db.query(
      `INSERT INTO employee_aso_records
        (work_id, technician_user_id, aso_date, valid_until, administrative_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [
        workId,
        input.technicianUserId,
        input.asoDate,
        input.validUntil,
        input.administrativeNotes ?? null,
        actor.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'employee_aso',
      entityId: res.rows[0].id,
      action: 'ASO_CREATE',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async createPpeDelivery(actor: AuthUser, input: {
    technicianUserId: string;
    deliveredAt: string;
    reason: string;
    notes?: string;
    oldPhotoFileId?: string;
    newPhotoFileId?: string;
    returnedCondition?: string;
    oldItemDestination?: string;
    items: Array<{
      description: string;
      caNumber: string;
      sizeValue?: string;
      quantity?: number;
      manufacturer?: string;
      notes?: string;
    }>;
  }) {
    const workId = this.assertSameWork(actor);
    this.assertSstOrManager(actor);
    const delivery = await this.db.query<{ id: string }>(
      `INSERT INTO ppe_deliveries
        (work_id, technician_user_id, delivered_at, reason, notes, old_photo_file_id,
         new_photo_file_id, returned_condition, old_item_destination, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        workId,
        input.technicianUserId,
        input.deliveredAt,
        input.reason,
        input.notes ?? null,
        input.oldPhotoFileId ?? null,
        input.newPhotoFileId ?? null,
        input.returnedCondition ?? null,
        input.oldItemDestination ?? null,
        actor.userId,
      ],
    );
    const deliveryId = delivery.rows[0]!.id;
    for (const item of input.items) {
      await this.db.query(
        `INSERT INTO ppe_delivery_items
          (ppe_delivery_id, description, ca_number, size_value, quantity, manufacturer, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          deliveryId,
          item.description,
          item.caNumber,
          item.sizeValue ?? null,
          item.quantity ?? 1,
          item.manufacturer ?? null,
          item.notes ?? null,
        ],
      );
    }

    const lines = input.items.map(
      (i) => `${i.description} | CA ${i.caNumber} | tam ${i.sizeValue ?? '-'} | qtd ${i.quantity ?? 1}`,
    );
    const pdf = await this.documents.generateSimplePdf({
      workId,
      entityType: 'ppe_delivery',
      entityId: deliveryId,
      documentType: 'PPE_TERM',
      title: 'Termo Eletrônico de EPI',
      lines: [
        `Técnico: ${input.technicianUserId}`,
        `Data: ${input.deliveredAt}`,
        `Motivo: ${input.reason}`,
        ...lines,
      ],
      uploadedBy: actor.userId,
    });

    await this.db.query(
      `UPDATE ppe_deliveries
       SET term_file_id=$2, term_document_hash=$3, term_status='PENDING_SIGNATURE'
       WHERE id=$1`,
      [deliveryId, pdf.file.id, pdf.file.sha256],
    );

    await this.db.query(
      `INSERT INTO technician_tasks
        (work_id, technician_user_id, task_type, reference_type, reference_id, title)
       VALUES ($1,$2,'SIGN_PPE_TERM','ppe_delivery',$3,'Assinar Termo de EPI')`,
      [workId, input.technicianUserId, deliveryId],
    );

    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'ppe_delivery',
      entityId: deliveryId,
      action: 'PPE_DELIVERY_CREATE',
      outcome: 'SUCCESS',
    });

    return { id: deliveryId, termFileId: pdf.file.id, termHash: pdf.file.sha256 };
  }

  async signPpeTerm(actor: AuthUser, deliveryId: string, pin: string) {
    const workId = this.assertSameWork(actor);
    const delivery = await this.db.query<{
      id: string;
      technician_user_id: string;
      term_status: string;
      term_document_hash: string;
    }>(
      `SELECT id, technician_user_id, term_status, term_document_hash
       FROM ppe_deliveries WHERE id=$1 AND work_id=$2`,
      [deliveryId, workId],
    );
    const row = delivery.rows[0];
    if (!row) throw new NotFoundException();
    if (row.technician_user_id !== actor.userId) {
      throw new ForbiddenException('Somente o Técnico destinatário assina o termo');
    }
    if (row.term_status !== 'PENDING_SIGNATURE') {
      throw new BadRequestException('Termo não está pendente de assinatura');
    }
    const cred = await this.db.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash FROM signature_credentials WHERE user_id=$1 AND status='ACTIVE'`,
      [actor.userId],
    );
    if (!cred.rows[0]) throw new BadRequestException('Credencial de assinatura ausente');
    const ok = await verifyPin(pin, cred.rows[0].pin_hash);
    if (!ok) {
      await this.audit.append({
        workId,
        userId: actor.userId,
        entityType: 'ppe_delivery',
        entityId: deliveryId,
        action: 'PPE_TERM_SIGN',
        outcome: 'DENIED',
        payload: { reason: 'BAD_PIN' },
      });
      throw new ForbiddenException('PIN inválido');
    }
    await this.db.query(
      `UPDATE ppe_deliveries
       SET term_status='SIGNED', term_signed_at=NOW(), term_signature_credential_id=$2
       WHERE id=$1`,
      [deliveryId, cred.rows[0].id],
    );
    await this.db.query(
      `UPDATE technician_tasks SET status='DONE', completed_at=NOW()
       WHERE reference_id=$1 AND technician_user_id=$2 AND task_type='SIGN_PPE_TERM' AND status='OPEN'`,
      [deliveryId, actor.userId],
    );
    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'ppe_delivery',
      entityId: deliveryId,
      action: 'PPE_TERM_SIGN',
      outcome: 'SUCCESS',
      payload: { documentHash: row.term_document_hash },
    });
    return { ok: true, documentHash: row.term_document_hash };
  }

  async createBlock(actor: AuthUser, input: {
    userId: string;
    scope: string;
    reason: string;
    notes?: string;
    startsAt?: string;
    endsAt?: string;
  }) {
    const workId = this.assertSameWork(actor);
    if (actor.role !== 'MANAGER' && actor.role !== 'MASTER') {
      throw new ForbiddenException('Somente Gestor/Master aplica bloqueio operacional');
    }
    const res = await this.db.query(
      `INSERT INTO user_operational_blocks
        (work_id, user_id, scope, reason, notes, starts_at, ends_at, created_by_manager_id)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW()),$7::timestamptz,$8)
       RETURNING id`,
      [
        workId,
        input.userId,
        input.scope,
        input.reason,
        input.notes ?? null,
        input.startsAt ?? null,
        input.endsAt ?? null,
        actor.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'operational_block',
      entityId: res.rows[0].id,
      action: 'OPERATIONAL_BLOCK_CREATE',
      outcome: 'SUCCESS',
      payload: { scope: input.scope, targetUserId: input.userId },
    });
    return res.rows[0];
  }

  async releaseBlock(actor: AuthUser, blockId: string, reason: string) {
    const workId = this.assertSameWork(actor);
    if (actor.role !== 'MANAGER' && actor.role !== 'MASTER') {
      throw new ForbiddenException();
    }
    await this.db.query(
      `UPDATE user_operational_blocks
       SET status='RELEASED', released_by=$3, released_at=NOW(), release_reason=$4
       WHERE id=$1 AND work_id=$2 AND status='ACTIVE'`,
      [blockId, workId, actor.userId, reason],
    );
    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'operational_block',
      entityId: blockId,
      action: 'OPERATIONAL_BLOCK_RELEASE',
      outcome: 'SUCCESS',
    });
    return { ok: true };
  }

  async listCompetencyRules(actor: AuthUser) {
    const workId = this.assertSameWork(actor);
    const res = await this.db.query(
      `SELECT * FROM competency_rules WHERE work_id=$1 ORDER BY created_at DESC`,
      [workId],
    );
    return { items: res.rows };
  }

  async createCompetencyRule(actor: AuthUser, input: {
    name: string;
    jobFunction?: string;
    activityNature?: string;
    equipmentClass?: string;
    requirementType: string;
    requirementKey: string;
    blocking: boolean;
    notes?: string;
  }) {
    const workId = this.assertSameWork(actor);
    this.assertSstOrManager(actor);
    const res = await this.db.query(
      `INSERT INTO competency_rules
        (work_id, name, job_function, activity_nature, equipment_class,
         requirement_type, requirement_key, blocking, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        workId,
        input.name,
        input.jobFunction ?? null,
        input.activityNature ?? null,
        input.equipmentClass ?? null,
        input.requirementType,
        input.requirementKey,
        input.blocking,
        actor.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'competency_rule',
      entityId: res.rows[0].id,
      action: 'COMPETENCY_RULE_CREATE',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async evaluateCompetency(actor: AuthUser, input: {
    technicianUserId: string;
    activityNature?: string;
    jobFunction?: string;
  }) {
    const workId = this.assertSameWork(actor);
    const alert = await this.db.query<{ alert_days_before_expiry: number }>(
      `SELECT alert_days_before_expiry FROM works WHERE id=$1`,
      [workId],
    );
    const alertDays = alert.rows[0]?.alert_days_before_expiry ?? 30;
    const rules = await this.db.query<{
      id: string;
      name: string;
      requirement_type: string;
      requirement_key: string;
      blocking: boolean;
      job_function: string | null;
      activity_nature: string | null;
    }>(
      `SELECT * FROM competency_rules WHERE work_id=$1 AND active=TRUE`,
      [workId],
    );

    const findings: Array<{
      ruleId: string;
      ruleName: string;
      ok: boolean;
      blocking: boolean;
      detail: string;
    }> = [];

    for (const rule of rules.rows) {
      if (rule.job_function && input.jobFunction && rule.job_function !== input.jobFunction) continue;
      if (rule.activity_nature && input.activityNature && rule.activity_nature !== input.activityNature) {
        continue;
      }

      if (rule.requirement_type === 'ASO') {
        const aso = await this.db.query<{ valid_until: string }>(
          `SELECT valid_until::text FROM employee_aso_records
           WHERE work_id=$1 AND technician_user_id=$2 AND status='ACTIVE'
           ORDER BY valid_until DESC LIMIT 1`,
          [workId, input.technicianUserId],
        );
        const tone = aso.rows[0]
          ? computeValidityTone(aso.rows[0].valid_until, alertDays)
          : 'MISSING';
        const ok = tone === 'VALID' || tone === 'EXPIRING';
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ok,
          blocking: rule.blocking,
          detail: ok
            ? `ASO ${validityLabel(tone)} até ${aso.rows[0]!.valid_until}`
            : `ASO ${validityLabel(tone)}`,
        });
      }

      if (rule.requirement_type === 'TRAINING') {
        const tr = await this.db.query<{ valid_until: string | null; training_name: string }>(
          `SELECT valid_until::text, training_name FROM employee_trainings
           WHERE work_id=$1 AND technician_user_id=$2 AND status='ACTIVE'
             AND lower(training_name) LIKE lower($3)
           ORDER BY valid_until DESC NULLS LAST LIMIT 1`,
          [workId, input.technicianUserId, `%${rule.requirement_key}%`],
        );
        if (!tr.rows[0]) {
          findings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ok: false,
            blocking: rule.blocking,
            detail: `Treinamento "${rule.requirement_key}" não encontrado`,
          });
        } else {
          const tone = tr.rows[0].valid_until
            ? computeValidityTone(tr.rows[0].valid_until, alertDays)
            : 'NO_EXPIRY';
          const ok = tone !== 'EXPIRED' && tone !== 'MISSING';
          findings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            ok,
            blocking: rule.blocking,
            detail: `${tr.rows[0].training_name}: ${validityLabel(tone)}`,
          });
        }
      }

      if (rule.requirement_type === 'OPERATIONAL_BLOCK') {
        const block = await this.db.query(
          `SELECT id FROM user_operational_blocks
           WHERE work_id=$1 AND user_id=$2 AND status='ACTIVE'
             AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW())
             AND (scope='ALL_OPERATIONAL' OR scope='EMIT_PT' OR scope=$3)
           LIMIT 1`,
          [workId, input.technicianUserId, rule.requirement_key],
        );
        const blocked = Boolean(block.rowCount);
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ok: !blocked,
          blocking: rule.blocking,
          detail: blocked ? 'Bloqueio operacional ativo' : 'Sem bloqueio operacional',
        });
      }
    }

    const blockedBy = findings.filter((f) => !f.ok && f.blocking);
    return {
      ready: blockedBy.length === 0,
      findings,
      blockedBy,
    };
  }

  async generateProfilePdf(actor: AuthUser, technicianId: string) {
    const workId = this.assertSameWork(actor);
    const isSelf = actor.userId === technicianId;
    if (!isSelf) this.assertSstOrManager(actor);
    const data = await this.getTechnicianProfile(actor, technicianId);
    const lines = [
      `Nome: ${data.profile.full_name}`,
      `Matrícula: ${data.profile.employee_number ?? '-'}`,
      `Função: ${data.profile.job_function ?? '-'}`,
      `Empresa: ${data.profile.employer ?? '-'}`,
      `Obra: ${data.work?.name ?? '-'}`,
      `ASO ativos: ${(data.asos as any[]).filter((a) => a.status === 'ACTIVE').length}`,
      `Treinamentos: ${(data.trainings as any[]).filter((t) => t.status === 'ACTIVE').length}`,
      `Entregas EPI: ${data.ppeDeliveries.length}`,
      'Uso interno - contém dados pessoais',
    ];
    const pdf = await this.documents.generateSimplePdf({
      workId,
      entityType: 'technician_profile',
      entityId: technicianId,
      documentType: 'TECH_PROFILE',
      title: 'Ficha de Informações do Técnico',
      lines,
      uploadedBy: actor.userId,
    });
    await this.audit.append({
      workId,
      userId: actor.userId,
      entityType: 'technician_profile',
      entityId: technicianId,
      action: 'TECH_PROFILE_PDF_GENERATED',
      outcome: 'SUCCESS',
      payload: { sha256: pdf.file.sha256 },
    });
    return pdf;
  }

  async listMyTasks(actor: AuthUser) {
    const workId = this.assertSameWork(actor);
    const res = await this.db.query(
      `SELECT * FROM technician_tasks
       WHERE work_id=$1 AND technician_user_id=$2
       ORDER BY created_at DESC`,
      [workId, actor.userId],
    );
    return { items: res.rows };
  }
}
