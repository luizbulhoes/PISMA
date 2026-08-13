import { Injectable } from '@nestjs/common';
import { FilesService } from '../files/files.service';
import { DatabaseService } from '../database/database.module';
import { sha256 } from '@pisma/security';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly files: FilesService,
    private readonly db: DatabaseService,
  ) {}

  /** Gera um PDF mínimo + snapshot de metadados (placeholder Onda 0; worker dedicado na fila). */
  async generateSimplePdf(input: {
    workId: string;
    entityType: string;
    entityId: string;
    documentType: string;
    title: string;
    lines: string[];
    uploadedBy?: string;
  }) {
    const content = [
      '%PDF-1.4',
      '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
      '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj',
      `4 0 obj<< /Length ${120 + input.lines.join(' ').length} >>stream`,
      'BT /F1 16 Tf 50 780 Td (PISMA - ' + input.title.replace(/[()\\]/g, '') + ') Tj',
      ...input.lines.map(
        (l, i) =>
          `0 -${22} Td (${String(i + 1)}. ${l.replace(/[()\\]/g, '').slice(0, 80)}) Tj`,
      ),
      'ET',
      'endstream endobj',
      '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
      'xref',
      '0 6',
      '0000000000 65535 f ',
      'trailer<< /Size 6 /Root 1 0 R >>',
      'startxref',
      '0',
      '%%EOF',
    ].join('\n');

    const buffer = Buffer.from(content, 'utf8');
    const stored = await this.files.store({
      buffer,
      originalName: `${input.documentType}-${input.entityId}.pdf`,
      mimeType: 'application/pdf',
      uploadedBy: input.uploadedBy,
      workId: input.workId,
    });

    const metadata = {
      product: 'PISMA',
      version: '1.3.0',
      entityType: input.entityType,
      entityId: input.entityId,
      documentType: input.documentType,
      title: input.title,
      lines: input.lines,
      generatedAt: new Date().toISOString(),
      contentSha256: sha256(buffer),
    };

    await this.db.query(
      `INSERT INTO generated_documents
        (work_id, entity_type, entity_id, document_type, file_id, sha256, metadata_json, generator_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
      [
        input.workId,
        input.entityType,
        input.entityId,
        input.documentType,
        stored.id,
        stored.sha256,
        JSON.stringify(metadata),
        'pisma-pdf-inline-0.1',
      ],
    );

    return { file: stored, metadata };
  }
}
