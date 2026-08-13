import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { displayLabel } from '../labels';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

export function PacPage() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const fromAudicamp = params.get('fromAudicamp') ?? '';
  const [items, setItems] = useState<Row[]>([]);
  const [people, setPeople] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    responsibleUserId: '',
    deadline: '',
    audicampId: fromAudicamp,
    evidenceNote: '',
  });
  const canCreate = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/pac', { token });
      setItems(emptyItems<Row>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar PACs');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    void api<{ items: Row[] }>('/technicians', { token })
      .then((r) => setPeople(r.items ?? []))
      .catch(() => setPeople([]));
  }, [token]);

  useEffect(() => {
    if (fromAudicamp) setForm((f) => ({ ...f, audicampId: fromAudicamp }));
  }, [fromAudicamp]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/pac', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...form,
          // Linguagem sem culpa — reforço de produto
          description: form.description,
        }),
      });
      setMsg('PAC criado');
      setForm({
        title: '',
        description: '',
        responsibleUserId: '',
        deadline: '',
        audicampId: '',
        evidenceNote: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar PAC');
    }
  }

  async function verify(id: string) {
    try {
      await api(`/pac/${id}/verify`, {
        method: 'POST',
        token,
        body: JSON.stringify({ ok: true }),
      });
      setMsg('PAC verificado');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na verificação');
    }
  }

  async function addEvidence(id: string, note: string) {
    try {
      await api(`/pac/${id}/evidence`, {
        method: 'POST',
        token,
        body: JSON.stringify({ note }),
      });
      setMsg('Evidência anexada');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao anexar evidência');
    }
  }

  return (
    <>
      <PageHead
        title="PAC — Plano de Ação Corretiva"
        subtitle="Foco em correção e melhoria. Sem linguagem de culpa."
      />
      <Err error={error} />
      <Msg text={msg} />

      {canCreate ? (
        <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>
            Novo PAC{form.audicampId ? ` (origem Audicamp ${form.audicampId.slice(0, 8)}…)` : ''}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              className="field"
              placeholder="Título da ação"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="field"
              type="date"
              required
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
            <select
              className="field"
              required
              value={form.responsibleUserId}
              onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })}
            >
              <option value="">Responsável…</option>
              {people.map((t) => (
                <option key={fieldOf(t, 'id')} value={fieldOf(t, 'id')}>
                  {fieldOf(t, 'full_name', 'fullName', 'name')}
                </option>
              ))}
            </select>
            <input
              className="field"
              placeholder="Audicamp origem (opcional)"
              value={form.audicampId}
              onChange={(e) => setForm({ ...form, audicampId: e.target.value })}
            />
          </div>
          <div style={{ height: 8 }} />
          <textarea
            className="field"
            rows={3}
            required
            placeholder="O que precisa ser corrigido / melhorado (sem atribuir culpa)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Criar PAC</button>
        </form>
      ) : null}

      <div className="card">
        {items.length === 0 ? (
          <p className="muted">Nenhum PAC.</p>
        ) : (
          items.map((p) => {
            const id = fieldOf(p, 'id');
            return (
              <div key={id} style={{ borderTop: '1px solid #e5e7eb', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <b>{fieldOf(p, 'title')}</b>{' '}
                    <span className="badge">{displayLabel(fieldOf(p, 'status'))}</span>
                    <div className="muted">
                      Prazo {fieldOf(p, 'deadline')} • Resp. {fieldOf(p, 'responsibleName', 'responsible_user_id')}
                    </div>
                    <div>{fieldOf(p, 'description')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => void addEvidence(id, 'Evidência registrada em campo')}
                    >
                      Evidência
                    </button>
                    <CriticalActionButton type="button" onClick={() => void verify(id)}>
                      Verificar
                    </CriticalActionButton>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
