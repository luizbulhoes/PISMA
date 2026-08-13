import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

export function InspectionsPage() {
  const { token, user } = useAuth();
  const [templates, setTemplates] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplItems, setTplItems] = useState('Item 1\nItem 2');
  const [selectedTpl, setSelectedTpl] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const canManage = ['TST', 'MANAGER', 'MASTER', 'SUPERVISOR'].includes(user?.role ?? '');
  const [categories, setCategories] = useState<Row[]>([]);
  const [categoryId, setCategoryId] = useState('');

  async function load() {
    try {
      setError(null);
      const r = await api<unknown>('/inspections', { token });
      const all = emptyItems<Row>(r);
      setTemplates(all.filter((x) => fieldOf(x, 'kind', 'type') !== 'RUN'));
      setRuns(all.filter((x) => fieldOf(x, 'kind', 'type') === 'RUN' || fieldOf(x, 'status')));
      const tplOnly = await api<unknown>('/inspections/templates', { token }).catch(() => null);
      if (tplOnly) setTemplates(emptyItems<Row>(tplOnly));
      const runOnly = await api<unknown>('/inspections/runs', { token }).catch(() => null);
      if (runOnly) setRuns(emptyItems<Row>(runOnly));
      const cats = await api<unknown>('/inspections/categories', { token }).catch(() => null);
      if (cats) setCategories(emptyItems<Row>(cats));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar inspeções');
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function createTemplate(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/inspections', {
        method: 'POST',
        token,
        body: JSON.stringify({
          kind: 'TEMPLATE',
          name: tplName,
          items: tplItems.split('\n').filter(Boolean).map((text) => ({ text })),
        }),
      });
      setMsg('Modelo de inspeção criado');
      setTplName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar modelo');
    }
  }

  async function execute(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/inspections', {
        method: 'POST',
        token,
        body: JSON.stringify({
          kind: 'RUN',
          templateId: selectedTpl,
          answers,
        }),
      });
      setMsg('Inspeção executada');
      setAnswers({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar inspeção');
    }
  }

  const title = 'Inspeções';

  return (
    <>
      <PageHead title={title} subtitle="Modelos e execução de inspeções de campo." />
      <Err error={error} />
      <Msg text={msg} />

      {canManage ? (
        <form className="card" onSubmit={createTemplate} style={{ marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>Novo modelo</h3>
          <select
            className="field"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={{ marginBottom: 8 }}
          >
            <option value="">Categoria…</option>
            {categories.map((c) => (
              <option key={fieldOf(c, 'id')} value={fieldOf(c, 'id')}>
                {fieldOf(c, 'code')} — {fieldOf(c, 'name')}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Nome do modelo"
            required
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
          />
          <div style={{ height: 8 }} />
          <textarea
            className="field"
            rows={4}
            placeholder="Itens (um por linha)"
            value={tplItems}
            onChange={(e) => setTplItems(e.target.value)}
          />
          <div style={{ height: 8 }} />
          <button className="btn btn-primary">Salvar modelo</button>
        </form>
      ) : null}

      <form className="card" onSubmit={execute} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Executar inspeção</h3>
        <select
          className="field"
          required
          value={selectedTpl}
          onChange={(e) => setSelectedTpl(e.target.value)}
        >
          <option value="">Selecione o modelo…</option>
          {templates.map((t) => (
            <option key={fieldOf(t, 'id')} value={fieldOf(t, 'id')}>
              {fieldOf(t, 'name', 'title')}
            </option>
          ))}
        </select>
        <div style={{ height: 8 }} />
        {(
          templates.find((t) => fieldOf(t, 'id') === selectedTpl)?.items as
            | Array<Record<string, unknown>>
            | undefined
        )?.map((item, i) => {
          const key = String(item.id ?? i);
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <label className="muted">{fieldOf(item, 'text', 'label')}</label>
              <select
                className="field"
                value={answers[key] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })}
              >
                <option value="">—</option>
                <option value="OK">Conforme</option>
                <option value="NOK">Não conforme</option>
                <option value="NA">N/A</option>
              </select>
            </div>
          );
        }) ?? <p className="muted">Selecione um modelo com itens.</p>}
        <button className="btn btn-primary">Registrar execução</button>
      </form>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Execuções recentes</h3>
        {runs.length === 0 ? (
          <p className="muted">Nenhuma execução.</p>
        ) : (
          runs.map((r) => (
            <div key={fieldOf(r, 'id')} style={{ marginBottom: 8 }}>
              <b>{fieldOf(r, 'name', 'template_name', 'title')}</b> —{' '}
              <span className="badge">{fieldOf(r, 'status')}</span>{' '}
              <span className="muted">{fieldOf(r, 'createdAt', 'created_at')}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
