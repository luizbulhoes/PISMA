import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { DatabaseService } from '../database/database.module';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FilesService {
  private readonly root: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.root = config.get<string>('STORAGE_LOCAL_PATH') ?? './storage';
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true });
  }

  async store(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    uploadedBy?: string;
    workId?: string;
    confidentiality?: 'PUBLIC_INTERNAL' | 'INTERNAL' | 'RESTRICTED' | 'MEDICAL';
  }) {
    const id = randomUUID();
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const storageKey = `${input.workId ?? 'global'}/${id}`;
    const fullPath = join(this.root, storageKey);
    mkdirSync(dirname(fullPath), { recursive: true });
    await pipeline(Readable.from(input.buffer), createWriteStream(fullPath));

    const result = await this.db.query(
      `INSERT INTO files
        (id, storage_key, original_name, mime_type, size_bytes, sha256, confidentiality, uploaded_by, work_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, sha256, mime_type, size_bytes, confidentiality, created_at`,
      [
        id,
        storageKey,
        input.originalName,
        input.mimeType,
        input.buffer.length,
        sha256,
        input.confidentiality ?? 'INTERNAL',
        input.uploadedBy ?? null,
        input.workId ?? null,
      ],
    );

    await this.audit.append({
      workId: input.workId,
      userId: input.uploadedBy,
      entityType: 'file',
      entityId: id,
      action: 'FILE_UPLOAD',
      outcome: 'SUCCESS',
      payload: {
        mimeType: input.mimeType,
        size: input.buffer.length,
        sha256,
        confidentiality: input.confidentiality ?? 'INTERNAL',
      },
    });

    return result.rows[0];
  }

  async openStream(fileId: string) {
    const res = await this.db.query<{
      storage_key: string;
      mime_type: string;
      original_name: string;
      confidentiality: string;
    }>(`SELECT storage_key, mime_type, original_name, confidentiality FROM files WHERE id = $1`, [
      fileId,
    ]);
    const row = res.rows[0];
    if (!row) return null;
    const fullPath = join(this.root, row.storage_key);
    return {
      stream: createReadStream(fullPath),
      mimeType: row.mime_type,
      originalName: row.original_name,
      confidentiality: row.confidentiality,
    };
  }
}
