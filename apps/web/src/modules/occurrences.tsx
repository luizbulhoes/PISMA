import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { displayLabel, roleLabel } from '../labels';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

export function OccurrencesPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canOpen = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  useEffect(() => {
    void api<unknown>('/occurrences', { token })
      .then((r) => setItems(emptyItems<Row>(r)))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Falha ao carregar ocorrências');
        setItems([]);
      });
  }, [token]);

  const title = user?.role === 'TECHNICIAN' ? 'Minhas Ocorrências RA/RQA' : 'Ocorrências RA / RQA';

  return (
    <>
      <PageHead
        title={title}
        subtitle="Registro de Acidente e Quase Acidente."
        actions={
          canOpen ? (
            <Link className="btn btn-primary" to="/ocorrencias/nova">
              Nova ocorrência
            </Link>
          ) : null
        }
      />
      <Err error={error} />
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Tipo</th>
              <th align="left">Título</th>
              <th align="left">Situação</th>
              <th align="left">Data</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhuma ocorrência.
                </td>
              </tr>
            ) : (
              items.map((o) => (
                <tr key={fieldOf(o, 'id')}>
                  <td>
                    <span className="badge">{displayLabel(fieldOf(o, 'type', 'kind'))}</span>
                  </td>
                  <td>{fieldOf(o, 'title', 'summary')}</td>
                  <td>{displayLabel(fieldOf(o, 'status'))}</td>
                  <td>{fieldOf(o, 'occurredAt', 'occurred_at', 'created_at')}</td>
                  <td>
                    <Link className="btn btn-ghost" to={`/ocorrencias/${fieldOf(o, 'id')}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function OccurrenceNewPage() {
  const { token, user } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'RQA',
    title: '',
    description: '',
    occurredAt: new Date().toISOString().slice(0, 16),
    location: '',
  });

  if (!['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '')) {
    return <Navigate to="/ocorrencias" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await api<Row>('/occurrences', {
        method: 'POST',
        token,
        body: JSON.stringify(form),
      });
      nav(`/ocorrencias/${fieldOf(created, 'id')}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir ocorrência');
    }
  }

  return (
    <>
      <PageHead title="Nova ocorrência" subtitle="Abertura por TST ou Gestor." />
      <Err error={error} />
      <form className="card" onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="RA">RA — Registro de Acidente</option>
            <option value="RQA">RQA — Quase Acidente</option>
          </select>
          <input
            className="field"
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
          />
          <input
            className="field"
            placeholder="Título"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="field"
            placeholder="Local"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div style={{ height: 8 }} />
        <textarea
          className="field"
          rows={4}
          required
          placeholder="Descrição inicial"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Abrir</button>{' '}
        <Link className="btn btn-ghost" to="/ocorrencias">
          Cancelar
        </Link>
      </form>
    </>
  );
}

export function OccurrenceDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [people, setPeople] = useState<Row[]>([]);
  const [participant, setParticipant] = useState({ userId: '', role: 'WITNESS' });
  const [statement, setStatement] = useState('');
  const [pin, setPin] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [catFileId, setCatFileId] = useState('');
  const canManage = ['TST', 'MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    if (!id) return;
    try {
      setError(null);
      setData(await api<Row>(`/occurrences/${id}`, { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  useEffect(() => {
    void api<{ items: Row[] }>('/technicians', { token })
      .then((r) => setPeople(r.items ?? []))
      .catch(() => setPeople([]));
  }, [token]);

  async function addParticipant(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/occurrences/${id}/participants`, {
        method: 'POST',
        token,
        body: JSON.stringify(participant),
      });
      setMsg('Participante adicionado');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar participante');
    }
  }

  async function saveStatement(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/occurrences/${id}/statements`, {
        method: 'POST',
        token,
        body: JSON.stringify({ body: statement }),
      });
      setMsg('Depoimento salvo (rascunho)');
      setStatement('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar depoimento');
    }
  }

  async function signStatement(statementId: string) {
    try {
      await api(`/occurrences/${id}/statements/${statementId}/sign`, {
        method: 'POST',
        token,
        body: JSON.stringify({ pin }),
      });
      setMsg('Depoimento assinado — conteúdo imutável');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao assinar depoimento');
    }
  }

  async function addEvidence() {
    try {
      await api(`/occurrences/${id}/evidences`, {
        method: 'POST',
        token,
        body: JSON.stringify({ note: 'Evidência anexada', visibility: 'SST_MANAGER_ONLY' }),
      });
      setMsg('Evidência registrada');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao anexar evidência');
    }
  }

  async function saveConclusion(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/occurrences/${id}/conclusion`, {
        method: 'POST',
        token,
        body: JSON.stringify({ text: conclusion, catFileId: catFileId || undefined }),
      });
      setMsg('Conclusão salva');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar conclusão');
    }
  }

  async function signConclusion(slot: string) {
    const type = fieldOf(data ?? {}, 'type', 'kind');
    if (type === 'RA' && !fieldOf(data ?? {}, 'catFileId', 'cat_file_id', 'catPdfId') && !catFileId) {
      setError('RA exige PDF da CAT anexado antes das assinaturas de conclusão.');
      return;
    }
    try {
      await api(`/occurrences/${id}/conclusion/sign`, {
        method: 'POST',
        token,
        body: JSON.stringify({ slot, pin, catFileId: catFileId || undefined }),
      });
      setMsg(`Conclusão assinada (${slot})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao assinar conclusão');
    }
  }

  if (!data && !error) return <p className="muted">Carregando…</p>;

  const participants = Array.isArray(data?.participants) ? (data!.participants as Row[]) : [];
  const statements = Array.isArray(data?.statements) ? (data!.statements as Row[]) : [];
  const evidences = Array.isArray(data?.evidences) ? (data!.evidences as Row[]) : [];
  const isRa = fieldOf(data ?? {}, 'type', 'kind') === 'RA';
  const catFromApi = fieldOf(data ?? {}, 'catFileId', 'cat_file_id', 'catPdfId');
  const hasCat = Boolean(catFileId || (catFromApi && catFromApi !== '—'));

  return (
    <>
      <PageHead
        title={`${displayLabel(fieldOf(data ?? {}, 'type', 'kind'))} — ${fieldOf(data ?? {}, 'title', 'summary')}`}
        subtitle={displayLabel(fieldOf(data ?? {}, 'status'))}
        actions={
          <Link className="btn btn-ghost" to="/ocorrencias">
            Voltar
          </Link>
        }
      />
      <Err error={error} />
      <Msg text={msg} />

      <div className="card" style={{ marginBottom: 12 }}>
        <p>{fieldOf(data ?? {}, 'description')}</p>
        <p className="muted">
          Local {fieldOf(data ?? {}, 'location')} •{' '}
          {fieldOf(data ?? {}, 'occurredAt', 'occurred_at')}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Participantes</h3>
        {participants.map((p) => (
          <div key={fieldOf(p, 'id')}>
            {fieldOf(p, 'name', 'full_name', 'userId')} — {displayLabel(fieldOf(p, 'role', 'process_role'))}
          </div>
        ))}
        {canManage ? (
          <form onSubmit={addParticipant} style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="field"
              required
              value={participant.userId}
              onChange={(e) => setParticipant({ ...participant, userId: e.target.value })}
              style={{ maxWidth: 280 }}
            >
              <option value="">Selecione o técnico…</option>
              {people.map((t) => (
                <option key={fieldOf(t, 'id')} value={fieldOf(t, 'id')}>
                  {fieldOf(t, 'full_name', 'fullName', 'name')}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={participant.role}
              onChange={(e) => setParticipant({ ...participant, role: e.target.value })}
              style={{ maxWidth: 200 }}
            >
              <option value="PRIMARY_INVOLVED">Principal envolvido</option>
              <option value="WITNESS">Testemunha</option>
              <option value="TECHNICIAN_DESIGNATED">Técnico designado</option>
              <option value="OTHER_INVOLVED">Outro</option>
            </select>
            <button className="btn btn-primary">Adicionar</button>
          </form>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Depoimentos</h3>
        <p className="muted">Após assinatura, o texto fica imutável.</p>
        {statements.map((s) => {
          const signed = ['SIGNED', 'IMMUTABLE'].includes(fieldOf(s, 'status'));
          return (
            <div key={fieldOf(s, 'id')} style={{ marginBottom: 10, borderTop: '1px solid #eee', paddingTop: 8 }}>
              <div className="muted">
                {fieldOf(s, 'authorName', 'author_id')} — {displayLabel(fieldOf(s, 'status'))}
              </div>
              <div>{fieldOf(s, 'body', 'text')}</div>
              {!signed ? (
                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                  <input
                    className="field"
                    placeholder="PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                  <CriticalActionButton type="button" onClick={() => void signStatement(fieldOf(s, 'id'))}>
                    Assinar
                  </CriticalActionButton>
                </div>
              ) : null}
            </div>
          );
        })}
        <form onSubmit={saveStatement} style={{ marginTop: 8 }}>
          <textarea
            className="field"
            rows={3}
            placeholder="Seu depoimento"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Salvar depoimento</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Evidências</h3>
        {evidences.map((ev) => (
          <div key={fieldOf(ev, 'id')}>
            {fieldOf(ev, 'note', 'description')}{' '}
            <span className="muted">({fieldOf(ev, 'visibility')})</span>
          </div>
        ))}
        {canManage ? (
          <button className="btn btn-ghost" type="button" onClick={() => void addEvidence()}>
            + Evidência
          </button>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Conclusão</h3>
        {isRa ? (
          <div style={{ marginBottom: 8 }}>
            <label className="muted">PDF da CAT (obrigatório para assinar conclusão de RA)</label>
            <input
              className="field"
              placeholder="Identificador do PDF da CAT"
              value={catFileId}
              onChange={(e) => setCatFileId(e.target.value)}
            />
            {!hasCat ? (
              <p className="error">Assinaturas de conclusão de RA bloqueadas sem o PDF da CAT.</p>
            ) : null}
          </div>
        ) : null}
        <form onSubmit={saveConclusion}>
          <textarea
            className="field"
            rows={4}
            value={conclusion || fieldOf(data ?? {}, 'conclusionText', 'conclusion_text')}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="Texto da conclusão"
          />
          <div style={{ height: 8 }} />
          {canManage ? <button className="btn btn-ghost">Salvar conclusão</button> : null}
        </form>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            className="field"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ maxWidth: 120 }}
          />
          {(['TECHNICIAN', 'TST', 'MANAGER'] as const).map((slot) => (
            <CriticalActionButton
              key={slot}
              type="button"
              disabled={isRa && !hasCat}
              onClick={() => void signConclusion(slot)}
            >
              Assinar como {roleLabel(slot)}
            </CriticalActionButton>
          ))}
        </div>
      </div>
    </>
  );
}
