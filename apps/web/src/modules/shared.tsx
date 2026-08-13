import { type ReactNode } from 'react';
import { displayLabel } from '../labels';

export function Err({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="error" style={{ marginBottom: 12 }}>{error}</div>;
}

export function Msg({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="card" style={{ marginBottom: 12, background: '#eaf5f0' }}>{text}</div>;
}

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
      <div>
        <h1 style={{ margin: '0 0 4px' }}>{title}</h1>
        {subtitle ? <p className="muted" style={{ margin: 0 }}>{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  );
}

export function emptyItems<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === 'object' && payload !== null && 'items' in payload) {
    const items = (payload as { items: unknown }).items;
    return Array.isArray(items) ? (items as T[]) : [];
  }
  return [];
}

export function fieldOf(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== '') return String(v);
  }
  return '—';
}

export function labeledField(row: Record<string, unknown>, ...keys: string[]): string {
  return displayLabel(fieldOf(row, ...keys));
}
