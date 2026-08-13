import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from 'node:crypto';
import bcrypt from 'bcryptjs';

const AES_ALGO = 'aes-256-gcm';

export async function hashPassword(plain: string, rounds = 12): Promise<string> {
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPin(pin: string, rounds = 12): Promise<string> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits');
  }
  return bcrypt.hash(pin, rounds);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Token de busca irreversível para CPF (HMAC), sem armazenar o CPF em claro. */
export function cpfSearchToken(cpfDigits: string, pepper: string): string {
  const normalized = cpfDigits.replace(/\D/g, '');
  return hmacSha256(pepper, `cpf:${normalized}`);
}

export function encryptField(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptField(payload: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const [version, ivHex, tagHex, dataHex] = payload.split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !dataHex) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = createDecipheriv(AES_ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** Cadeia de auditoria append-only — PRD §45.5 */
export function computeAuditEventHash(input: {
  previousEventHash: string | null;
  workId: string | null;
  userId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  outcome: string;
  createdAtIso: string;
  payloadJson: string;
}): string {
  const material = [
    input.previousEventHash ?? 'GENESIS',
    input.workId ?? '',
    input.userId ?? '',
    input.entityType,
    input.entityId ?? '',
    input.action,
    input.outcome,
    input.createdAtIso,
    sha256(input.payloadJson),
  ].join('|');
  return sha256(material);
}

export function deriveKeyFromSecret(secret: string, salt: string): Buffer {
  return scryptSync(secret, salt, 32);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
