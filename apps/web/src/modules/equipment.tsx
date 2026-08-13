import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { displayLabel } from '../labels';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Equipment = Record<string, unknown>;

export function EquipmentPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Equipment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    tag: '',
    name: '',
    status: 'ACTIVE',
    certificateNumber: '',
    certificateValidUntil: '',
  });
  const canCreate = ['TST', 'MANAGER', 'MASTER', 'SUPERVISOR'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/equipment', { token });
      setItems(emptyItems<Equipment>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar equipamentos');
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      setError(null);
      await api('/equipment', {
        method: 'POST',
        token,
        body: JSON.stringify(form),
      });
      setMsg(`Equipamento ${form.tag} cadastrado`);
      setForm({ tag: '', name: '', status: 'ACTIVE', certificateNumber: '', certificateValidUntil: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar');
    }
  }

  return (
    <>
      <PageHead title="Equipamentos" subtitle="Cadastro por TAG, status e certificados." />
      <Err error={error} />
      <Msg text={msg} />

      {canCreate ? (
        <form className="card" onSubmit={onCreate} style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Novo equipamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <input
              className="field"
              placeholder="TAG"
              required
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
            />
            <input
              className="field"
              placeholder="Descrição"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="MAINTENANCE">Manutenção</option>
              <option value="BLOCKED">Bloqueado</option>
            </select>
            <input
              className="field"
              placeholder="Nº certificado"
              value={form.certificateNumber}
              onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
            />
            <input
              className="field"
              type="date"
              value={form.certificateValidUntil}
              onChange={(e) => setForm({ ...form, certificateValidUntil: e.target.value })}
            />
          </div>
          <div style={{ height: 10 }} />
          <button className="btn btn-primary">Cadastrar</button>
        </form>
      ) : null}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">TAG</th>
              <th align="left">Nome</th>
              <th align="left">Situação</th>
              <th align="left">Certificado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum equipamento.
                </td>
              </tr>
            ) : (
              items.map((eq) => {
                const id = fieldOf(eq, 'id');
                return (
                  <tr key={id}>
                    <td>
                      <b>{fieldOf(eq, 'tag', 'equipment_tag')}</b>
                    </td>
                    <td>{fieldOf(eq, 'name', 'description')}</td>
                    <td>
                      <span className="badge">{displayLabel(fieldOf(eq, 'status'))}</span>
                    </td>
                    <td>
                      {fieldOf(eq, 'certificateNumber', 'certificate_number')}{' '}
                      {eq.certificateValidUntil || eq.certificate_valid_until
                        ? `até ${fieldOf(eq, 'certificateValidUntil', 'certificate_valid_until')}`
                        : ''}
                    </td>
                    <td>
                      <Link className="btn btn-ghost" to={`/equipamentos/${id}`}>
                        Checklist
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function EquipmentDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [checklists, setChecklists] = useState<Equipment[]>([]);
  const [items, setItems] = useState<Array<{ text: string; ok: boolean | null }>>([
    { text: '', ok: null },
  ]);
  const [runAnswers, setRunAnswers] = useState<Record<string, 'YES' | 'NO' | 'NA'>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState('Checklist diário');

  async function load() {
    if (!id) return;
    try {
      setError(null);
      const eq = await api<Equipment>(`/equipment/${id}`, { token }).catch(() => null);
      setEquipment(eq);
      const cl = await api<unknown>(`/equipment/${id}/checklists`, { token });
      setChecklists(emptyItems<Equipment>(cl));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  async function saveTemplate(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/equipment/${id}/checklists`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          title,
          items: items.filter((i) => i.text.trim()).map((i) => ({ text: i.text })),
        }),
      });
      setMsg('Checklist salvo');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar checklist');
    }
  }

  async function runChecklist(checklistId: string) {
    try {
      await api(`/equipment/${id}/checklists/${checklistId}/runs`, {
        method: 'POST',
        token,
        body: JSON.stringify({ answers: runAnswers }),
      });
      setMsg('Execução registrada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar checklist');
    }
  }

  return (
    <>
      <PageHead
        title={equipment ? `TAG ${fieldOf(equipment, 'tag')}` : 'Checklist do equipamento'}
        subtitle={equipment ? fieldOf(equipment, 'name', 'description') : `ID ${id}`}
        actions={
          <Link className="btn btn-ghost" to="/equipamentos">
            Voltar
          </Link>
        }
      />
      <Err error={error} />
      <Msg text={msg} />

      <form className="card" onSubmit={saveTemplate} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Montar checklist</h3>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ height: 8 }} />
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              className="field"
              placeholder={`Item ${idx + 1}`}
              value={it.text}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...it, text: e.target.value };
                setItems(next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setItems([...items, { text: '', ok: null }])}
        >
          + Item
        </button>{' '}
        <button className="btn btn-primary">Salvar modelo</button>
      </form>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Executar checklist</h3>
        {checklists.length === 0 ? (
          <p className="muted">Nenhum checklist cadastrado.</p>
        ) : (
          checklists.map((cl) => {
            const clId = fieldOf(cl, 'id');
            const clItems = Array.isArray(cl.items) ? (cl.items as Array<Record<string, unknown>>) : [];
            return (
              <div key={clId} style={{ marginBottom: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <b>{fieldOf(cl, 'title', 'name')}</b>
                {clItems.map((item, i) => {
                  const itemId = String(item.id ?? i);
                  return (
                    <div key={itemId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <span style={{ flex: 1 }}>{fieldOf(item, 'text', 'label')}</span>
                      {(['YES', 'NO', 'NA'] as const).map((v) => (
                        <label key={v} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`${clId}-${itemId}`}
                            checked={runAnswers[itemId] === v}
                            onChange={() => setRunAnswers({ ...runAnswers, [itemId]: v })}
                          />
                          {v === 'YES' ? 'Sim' : v === 'NO' ? 'Não' : 'N/A'}
                        </label>
                      ))}
                    </div>
                  );
                })}
                <div style={{ height: 8 }} />
                <button className="btn btn-primary" type="button" onClick={() => void runChecklist(clId)}>
                  Registrar execução
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
