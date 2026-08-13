import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  canSubmitConclusionForSignatures,
  type OccurrenceType,
} from '@pisma/domain';
import { verifyPin } from '@pisma/security';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.module';

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  private workId(user: AuthUser) {
    if (!user.workId) throw new ForbiddenException('Obra ativa obrigatória');
    return user.workId;
  }

  async list(user: AuthUser) {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT id, occurrence_type, display_number, occurred_at, location, status,
              primary_involved_user_id, cat_pdf_file_id, opened_at
       FROM occurrences WHERE work_id = $1 ORDER BY opened_at DESC LIMIT 200`,
      [workId],
    );
    return { items: res.rows };
  }

  async create(
    user: AuthUser,
    input: {
      occurrenceType: OccurrenceType;
      occurredAt: string;
      location: string;
      equipmentTag?: string;
      relatedOsNumber?: string;
      relatedPtId?: string;
      initialDescription: string;
      immediateConsequences?: string;
      immediateActions?: string;
      initialClassification?: string;
      primaryInvolvedUserId?: string;
      catApplicability?: string;
    },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const workId = this.workId(user);
    const seq = await this.db.query<{ n: number }>(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS n
       FROM occurrences WHERE work_id = $1 AND occurrence_type = $2`,
      [workId, input.occurrenceType],
    );
    const sequenceNumber = seq.rows[0].n;
    const year = new Date().getFullYear();
    const displayNumber = `${input.occurrenceType}-${year}-${String(sequenceNumber).padStart(6, '0')}`;
    const catApplicability =
      input.catApplicability ??
      (input.occurrenceType === 'RA' ? 'UNDER_REVIEW' : 'NO');
    const res = await this.db.query(
      `INSERT INTO occurrences
        (work_id, occurrence_type, display_number, sequence_number, occurred_at, location,
         equipment_tag, related_os_number, related_pt_id, initial_description,
         immediate_consequences, immediate_actions, initial_classification,
         primary_involved_user_id, responsible_tst_user_id, status, cat_applicability, opened_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'OPEN',$16,$17)
       RETURNING *`,
      [
        workId,
        input.occurrenceType,
        displayNumber,
        sequenceNumber,
        input.occurredAt,
        input.location,
        input.equipmentTag ?? null,
        input.relatedOsNumber ?? null,
        input.relatedPtId ?? null,
        input.initialDescription,
        input.immediateConsequences ?? null,
        input.immediateActions ?? null,
        input.initialClassification ?? null,
        input.primaryInvolvedUserId ?? null,
        user.role === 'TST' ? user.userId : null,
        catApplicability,
        user.userId,
      ],
    );
    await this.audit.append({
      workId,
      userId: user.userId,
      entityType: 'occurrence',
      entityId: res.rows[0].id,
      action: 'OCCURRENCE_OPEN',
      outcome: 'SUCCESS',
      payload: { displayNumber, type: input.occurrenceType },
    });
    return res.rows[0];
  }

  async get(user: AuthUser, id: string): Promise<any> {
    const workId = this.workId(user);
    const res = await this.db.query(
      `SELECT * FROM occurrences WHERE id = $1 AND work_id = $2`,
      [id, workId],
    );
    if (!res.rowCount) throw new NotFoundException();
    const [participants, tasks, statements, evidence, conclusions] = await Promise.all([
      this.db.query(`SELECT * FROM occurrence_participants WHERE occurrence_id = $1`, [id]),
      this.db.query(`SELECT * FROM occurrence_tasks WHERE occurrence_id = $1`, [id]),
      this.db.query(
        `SELECT id, statement_number, statement_type, author_user_id, status, signed_at, immutable, snapshot_sha256, created_at
         FROM occurrence_statements WHERE occurrence_id = $1 ORDER BY statement_number`,
        [id],
      ),
      this.db.query(`SELECT * FROM occurrence_evidence WHERE occurrence_id = $1`, [id]),
      this.db.query(
        `SELECT * FROM occurrence_conclusions WHERE occurrence_id = $1 ORDER BY version_number`,
        [id],
      ),
    ]);
    return {
      ...res.rows[0],
      participants: participants.rows,
      tasks: tasks.rows,
      statements: statements.rows,
      evidence: evidence.rows,
      conclusions: conclusions.rows,
    };
  }

  async patch(user: AuthUser, id: string, patch: Record<string, unknown>) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    await this.get(user, id);
    const res = await this.db.query(
      `UPDATE occurrences SET
         location = COALESCE($1, location),
         immediate_consequences = COALESCE($2, immediate_consequences),
         immediate_actions = COALESCE($3, immediate_actions),
         initial_classification = COALESCE($4, initial_classification),
         status = COALESCE($5, status),
         cat_applicability = COALESCE($6, cat_applicability),
         cat_number = COALESCE($7, cat_number)
       WHERE id = $8 RETURNING *`,
      [
        (patch.location as string) ?? null,
        (patch.immediateConsequences as string) ?? null,
        (patch.immediateActions as string) ?? null,
        (patch.initialClassification as string) ?? null,
        (patch.status as string) ?? null,
        (patch.catApplicability as string) ?? null,
        (patch.catNumber as string) ?? null,
        id,
      ],
    );
    return res.rows[0];
  }

  async addParticipant(
    user: AuthUser,
    id: string,
    input: { userId: string; processRole: string },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    await this.get(user, id);
    const res = await this.db.query(
      `INSERT INTO occurrence_participants
        (occurrence_id, user_id, process_role, added_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, input.userId, input.processRole, user.userId],
    );
    return res.rows[0];
  }

  async addTask(
    user: AuthUser,
    id: string,
    input: {
      assignedUserId: string;
      taskType: string;
      instructions?: string;
      dueAt?: string;
    },
  ) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    await this.get(user, id);
    const res = await this.db.query(
      `INSERT INTO occurrence_tasks
        (occurrence_id, assigned_user_id, task_type, instructions, due_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        id,
        input.assignedUserId,
        input.taskType,
        input.instructions ?? null,
        input.dueAt ?? null,
        user.userId,
      ],
    );
    await this.db.query(
      `UPDATE occurrences SET status = 'AWAITING_STATEMENTS' WHERE id = $1 AND status = 'OPEN'`,
      [id],
    );
    return res.rows[0];
  }

  async saveStatementDraft(
    user: AuthUser,
    id: string,
    input: {
      taskId?: string;
      statementType?: string;
      content: Record<string, unknown>;
    },
  ) {
    await this.get(user, id);
    const num = await this.db.query<{ n: number }>(
      `SELECT COALESCE(MAX(statement_number), 0) + 1 AS n
       FROM occurrence_statements WHERE occurrence_id = $1`,
      [id],
    );
    const sha = createHash('sha256').update(JSON.stringify(input.content)).digest('hex');
    const res = await this.db.query(
      `INSERT INTO occurrence_statements
        (occurrence_id, task_id, author_user_id, statement_number, statement_type,
         content_jsonb, snapshot_sha256, status, immutable)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'DRAFT',FALSE) RETURNING *`,
      [
        id,
        input.taskId ?? null,
        user.userId,
        num.rows[0].n,
        input.statementType ?? 'INITIAL',
        JSON.stringify(input.content),
        sha,
      ],
    );
    return res.rows[0];
  }

  async signStatement(
    user: AuthUser,
    id: string,
    statementId: string,
    pin: string,
  ) {
    const st = await this.db.query(
      `SELECT * FROM occurrence_statements WHERE id = $1 AND occurrence_id = $2`,
      [statementId, id],
    );
    if (!st.rowCount) throw new NotFoundException();
    if (st.rows[0].immutable || st.rows[0].status === 'SIGNED') {
      throw new BadRequestException('Depoimento já assinado e imutável');
    }
    if (st.rows[0].author_user_id !== user.userId) {
      throw new ForbiddenException();
    }
    const cred = await this.db.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash FROM signature_credentials
       WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
      [user.userId],
    );
    if (!cred.rowCount) throw new BadRequestException('Credencial ausente');
    if (!(await verifyPin(pin, cred.rows[0].pin_hash))) {
      throw new ForbiddenException('PIN inválido');
    }
    const res = await this.db.query(
      `UPDATE occurrence_statements
       SET status = 'SIGNED', immutable = TRUE, signed_at = NOW(),
           signature_credential_id = $1
       WHERE id = $2 RETURNING *`,
      [cred.rows[0].id, statementId],
    );
    if (st.rows[0].task_id) {
      await this.db.query(
        `UPDATE occurrence_tasks SET status = 'DONE', completed_at = NOW() WHERE id = $1`,
        [st.rows[0].task_id],
      );
    }
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'occurrence_statement',
      entityId: statementId,
      action: 'STATEMENT_SIGNED',
      outcome: 'SUCCESS',
    });
    return res.rows[0];
  }

  async attachCatPdf(user: AuthUser, id: string, fileId: string, catNumber?: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const occ = await this.get(user, id);
    if (occ.occurrence_type !== 'RA') {
      throw new BadRequestException('CAT PDF só é obrigatória/aplicável a RA');
    }
    // preserve previous as evidence if replacing
    if (occ.cat_pdf_file_id) {
      await this.db.query(
        `INSERT INTO occurrence_evidence
          (occurrence_id, category, title, description, file_id, confidentiality_level, status, uploaded_by)
         VALUES ($1,'CAT','CAT anterior (substituída)','Preservada por substituição',$2,'RESTRICTED','SUPERSEDED',$3)`,
        [id, occ.cat_pdf_file_id, user.userId],
      );
    }
    const res = await this.db.query(
      `UPDATE occurrences
       SET cat_pdf_file_id = $1, cat_pdf_uploaded_by = $2, cat_pdf_uploaded_at = NOW(),
           cat_applicability = 'YES', cat_number = COALESCE($3, cat_number)
       WHERE id = $4 RETURNING *`,
      [fileId, user.userId, catNumber ?? null, id],
    );
    await this.db.query(
      `INSERT INTO occurrence_evidence
        (occurrence_id, category, title, file_id, confidentiality_level, uploaded_by)
       VALUES ($1,'CAT','PDF CAT',$2,'RESTRICTED',$3)`,
      [id, fileId, user.userId],
    );
    return res.rows[0];
  }

  async saveAnalysis(user: AuthUser, id: string, content: Record<string, unknown>) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    await this.get(user, id);
    const ver = await this.db.query<{ n: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS n
       FROM occurrence_analysis_versions WHERE occurrence_id = $1`,
      [id],
    );
    const res = await this.db.query(
      `INSERT INTO occurrence_analysis_versions
        (occurrence_id, version_number, content_jsonb, created_by)
       VALUES ($1,$2,$3::jsonb,$4) RETURNING *`,
      [id, ver.rows[0].n, JSON.stringify(content), user.userId],
    );
    await this.db.query(
      `UPDATE occurrences SET status = 'IN_ANALYSIS' WHERE id = $1`,
      [id],
    );
    return res.rows[0];
  }

  async addAction(
    user: AuthUser,
    id: string,
    input: {
      actionType: string;
      description: string;
      responsibleUserId?: string;
      responsibleText?: string;
      dueAt?: string;
    },
  ) {
    await this.get(user, id);
    const res = await this.db.query(
      `INSERT INTO occurrence_actions
        (occurrence_id, action_type, description, responsible_user_id, responsible_text, due_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        id,
        input.actionType,
        input.description,
        input.responsibleUserId ?? null,
        input.responsibleText ?? null,
        input.dueAt ?? null,
      ],
    );
    return res.rows[0];
  }

  async openConclusion(user: AuthUser, id: string) {
    await this.get(user, id);
    await this.db.query(
      `UPDATE occurrences SET status = 'CONCLUSION_DRAFT' WHERE id = $1`,
      [id],
    );
    return this.get(user, id);
  }

  async upsertConclusionDraft(
    user: AuthUser,
    id: string,
    input: {
      summary: string;
      confirmedFacts?: string;
      evidenceBasis?: string;
      chronologyBasis?: string;
      contributingFactors?: string;
      reasoning?: string;
      conclusionText: string;
      measuresTaken?: string;
      futureActions?: string;
      openItems?: string;
    },
  ) {
    const occ = await this.get(user, id);
    const draft = occ.conclusions.find(
      (c: { status: string }) => c.status === 'DRAFT',
    );
    if (draft) {
      const res = await this.db.query(
        `UPDATE occurrence_conclusions SET
           summary = $1, confirmed_facts = $2, evidence_basis = $3, chronology_basis = $4,
           contributing_factors = $5, reasoning = $6, conclusion_text = $7,
           measures_taken = $8, future_actions = $9, open_items = $10
         WHERE id = $11 RETURNING *`,
        [
          input.summary,
          input.confirmedFacts ?? null,
          input.evidenceBasis ?? null,
          input.chronologyBasis ?? null,
          input.contributingFactors ?? null,
          input.reasoning ?? null,
          input.conclusionText,
          input.measuresTaken ?? null,
          input.futureActions ?? null,
          input.openItems ?? null,
          draft.id,
        ],
      );
      return res.rows[0];
    }
    const ver = await this.db.query<{ n: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS n
       FROM occurrence_conclusions WHERE occurrence_id = $1`,
      [id],
    );
    const res = await this.db.query(
      `INSERT INTO occurrence_conclusions
        (occurrence_id, version_number, summary, confirmed_facts, evidence_basis,
         chronology_basis, contributing_factors, reasoning, conclusion_text,
         measures_taken, future_actions, open_items, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'DRAFT',$13) RETURNING *`,
      [
        id,
        ver.rows[0].n,
        input.summary,
        input.confirmedFacts ?? null,
        input.evidenceBasis ?? null,
        input.chronologyBasis ?? null,
        input.contributingFactors ?? null,
        input.reasoning ?? null,
        input.conclusionText,
        input.measuresTaken ?? null,
        input.futureActions ?? null,
        input.openItems ?? null,
        user.userId,
      ],
    );
    return res.rows[0];
  }

  async submitConclusionForSignatures(user: AuthUser, id: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const occ = await this.get(user, id);
    const gate = canSubmitConclusionForSignatures({
      occurrenceType: occ.occurrence_type as OccurrenceType,
      hasCatPdf: !!occ.cat_pdf_file_id,
    });
    if (!gate.ok) {
      throw new BadRequestException(gate.reason);
    }
    const draft = occ.conclusions.find(
      (c: { status: string }) => c.status === 'DRAFT',
    );
    if (!draft) throw new BadRequestException('Conclusão em rascunho ausente');
    const sha = createHash('sha256')
      .update(
        JSON.stringify({
          summary: draft.summary,
          conclusionText: draft.conclusion_text,
        }),
      )
      .digest('hex');
    await this.db.query(
      `UPDATE occurrence_conclusions
       SET status = 'AWAITING_SIGNATURES', snapshot_sha256 = $1
       WHERE id = $2`,
      [sha, draft.id],
    );
    await this.db.query(
      `UPDATE occurrences SET status = 'AWAITING_SIGNATURES' WHERE id = $1`,
      [id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'occurrence',
      entityId: id,
      action: 'CONCLUSION_SUBMIT_SIGNATURES',
      outcome: 'SUCCESS',
    });
    return this.get(user, id);
  }

  async signConclusion(
    user: AuthUser,
    id: string,
    slot: 'TECHNICIAN' | 'TST' | 'MANAGER',
    pin: string,
  ) {
    const roleOk =
      (slot === 'TECHNICIAN' && user.role === 'TECHNICIAN') ||
      (slot === 'TST' && (user.role === 'TST' || user.role === 'MANAGER')) ||
      (slot === 'MANAGER' && user.role === 'MANAGER');
    if (!roleOk) throw new ForbiddenException(`Não pode assinar slot ${slot}`);

    const occ = await this.get(user, id);
    const conclusion = occ.conclusions.find(
      (c: { status: string }) => c.status === 'AWAITING_SIGNATURES',
    );
    if (!conclusion) throw new BadRequestException('Nenhuma conclusão aguardando assinaturas');

    const cred = await this.db.query<{ id: string; pin_hash: string }>(
      `SELECT id, pin_hash FROM signature_credentials
       WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
      [user.userId],
    );
    if (!cred.rowCount) throw new BadRequestException('Credencial ausente');
    if (!(await verifyPin(pin, cred.rows[0].pin_hash))) {
      throw new ForbiddenException('PIN inválido');
    }

    await this.db.query(
      `INSERT INTO occurrence_conclusion_signatures
        (conclusion_id, slot, signer_user_id, signature_credential_id, document_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        conclusion.id,
        slot,
        user.userId,
        cred.rows[0].id,
        conclusion.snapshot_sha256,
      ],
    );

    const sigs = await this.db.query(
      `SELECT slot FROM occurrence_conclusion_signatures WHERE conclusion_id = $1`,
      [conclusion.id],
    );
    if (sigs.rowCount === 3) {
      await this.db.query(
        `UPDATE occurrence_conclusions SET status = 'SIGNED' WHERE id = $1`,
        [conclusion.id],
      );
      await this.db.query(
        `UPDATE occurrences SET status = 'CONCLUDED', concluded_at = NOW() WHERE id = $1`,
        [id],
      );
    }
    return this.get(user, id);
  }

  async addAddendum(
    user: AuthUser,
    id: string,
    input: { type: string; description: string; fileId?: string },
  ) {
    await this.get(user, id);
    const res = await this.db.query(
      `INSERT INTO occurrence_addenda
        (occurrence_id, type, description, file_id, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, input.type, input.description, input.fileId ?? null, user.userId],
    );
    return res.rows[0];
  }

  async reopen(user: AuthUser, id: string, reason: string) {
    if (!['TST', 'MANAGER', 'MASTER'].includes(user.role ?? '')) {
      throw new ForbiddenException();
    }
    const occ = await this.get(user, id);
    if (occ.status !== 'CONCLUDED') {
      throw new BadRequestException('Somente processos concluídos podem ser reabertos');
    }
    for (const c of occ.conclusions) {
      if (c.status === 'SIGNED') {
        await this.db.query(
          `UPDATE occurrence_conclusions SET status = 'SUPERSEDED' WHERE id = $1`,
          [c.id],
        );
      }
    }
    await this.db.query(
      `UPDATE occurrences SET status = 'REOPENED', reopened_at = NOW() WHERE id = $1`,
      [id],
    );
    await this.audit.append({
      workId: this.workId(user),
      userId: user.userId,
      entityType: 'occurrence',
      entityId: id,
      action: 'OCCURRENCE_REOPEN',
      outcome: 'SUCCESS',
      payload: { reason },
    });
    return this.get(user, id);
  }
}
