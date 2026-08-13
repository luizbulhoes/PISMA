import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Doc = Record<string, unknown>;

export function DocumentsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [summary, setSummary] = useState('');
  const [create, setCreate] = useState({ code: '', title: '', category: 'PROCEDIMENTO' });
  const canPublish = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/documents', { token });
      setItems(emptyItems<Doc>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar documentos');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/documents', { method: 'POST', token, body: JSON.stringify(create) });
      setMsg('Documento criado');
      setCreate({ code: '', title: '', category: 'PROCEDIMENTO' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar documento');
    }
  }

  async function publishRevision(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!summary.trim()) {
      setError('Resumo da revisão é obrigatório — gera aviso no mural.');
      return;
    }
    try {
      setError(null);
      await api(`/documents/${selected}/revisions`, {
        method: 'POST',
        token,
        body: JSON.stringify({ summary, publish: true, createNotice: true }),
      });
      setMsg('Revisão publicada e aviso criado no mural.');
      setSummary('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao publicar revisão');
    }
  }

  return (
    <>
      <PageHead
        title="Documentos controlados"
        subtitle="Procedimentos e revisões. Publicar revisão exige resumo e gera aviso no mural."
      />
      <Err error={error} />
      <Msg text={msg} />

      {canPublish ? (
        <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Novo documento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 8 }}>
            <input
              className="field"
              placeholder="Código"
              required
              value={create.code}
              onChange={(e) => setCreate({ ...create, code: e.target.value })}
            />
            <input
              className="field"
              placeholder="Título"
              required
              value={create.title}
              onChange={(e) => setCreate({ ...create, title: e.target.value })}
            />
            <select
              className="field"
              value={create.category}
              onChange={(e) => setCreate({ ...create, category: e.target.value })}
            >
              <option value="PROCEDIMENTO">Procedimento</option>
              <option value="INSTRUCAO">Instrução</option>
              <option value="FORMULARIO">Formulário</option>
              <option value="POLITICA">Política</option>
            </select>
          </div>
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Criar</button>
        </form>
      ) : null}

      <div className="card" style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Código</th>
              <th align="left">Título</th>
              <th align="left">Rev.</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhum documento.
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={fieldOf(d, 'id')}>
                  <td>
                    <b>{fieldOf(d, 'code')}</b>
                  </td>
                  <td>{fieldOf(d, 'title', 'name')}</td>
                  <td>{fieldOf(d, 'revision', 'current_revision', 'rev')}</td>
                  <td>
                    <span className="badge">{fieldOf(d, 'status', 'state')}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canPublish ? (
        <form className="card" onSubmit={publishRevision}>
          <h3 style={{ marginTop: 0 }}>Publicar revisão</h3>
          <select className="field" value={selected} onChange={(e) => setSelected(e.target.value)} required>
            <option value="">Selecione o documento…</option>
            {items.map((d) => (
              <option key={fieldOf(d, 'id')} value={fieldOf(d, 'id')}>
                {fieldOf(d, 'code')} — {fieldOf(d, 'title', 'name')}
              </option>
            ))}
          </select>
          <div style={{ height: 8 }} />
          <textarea
            className="field"
            rows={3}
            required
            placeholder="Resumo obrigatório da revisão (vai para o mural)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Publicar e avisar no mural</button>
        </form>
      ) : null}
    </>
  );
}
