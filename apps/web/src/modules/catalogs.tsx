import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

export function CatalogsPage() {
  const { token, user } = useAuth();
  const role = user?.role ?? '';
  const canLocations = ['MANAGER', 'TST', 'SUPERVISOR', 'MASTER'].includes(role);
  const canAudicamp = ['MANAGER', 'TST', 'MASTER'].includes(role);
  const canInspection = ['MANAGER', 'SUPERVISOR', 'TST', 'MASTER'].includes(role);
  const canWaste = ['MANAGER', 'TST', 'MASTER'].includes(role);

  const [locations, setLocations] = useState<Row[]>([]);
  const [audicamp, setAudicamp] = useState<Row[]>([]);
  const [inspections, setInspections] = useState<Row[]>([]);
  const [waste, setWaste] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [loc, setLoc] = useState({ code: '', name: '', description: '' });
  const [aud, setAud] = useState({ code: '', name: '', description: '' });
  const [ins, setIns] = useState({ code: '', name: '', description: '' });
  const [wst, setWst] = useState({ code: '', name: '' });

  async function load() {
    try {
      setError(null);
      const [l, a, i, w] = await Promise.all([
        api<unknown>('/locations', { token }),
        api<unknown>('/audicamp/categories', { token }),
        api<unknown>('/inspections/categories', { token }),
        api<unknown>('/waste/catalog', { token }),
      ]);
      setLocations(emptyItems<Row>(l));
      setAudicamp(emptyItems<Row>(a));
      setInspections(emptyItems<Row>(i));
      setWaste(emptyItems<Row>(w));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar cadastros');
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function create(
    path: string,
    body: Record<string, string>,
    okMsg: string,
    reset: () => void,
  ) {
    try {
      await api(path, { method: 'POST', token, body: JSON.stringify(body) });
      setMsg(okMsg);
      reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar');
    }
  }

  return (
    <>
      <PageHead
        title="Cadastros da Obra"
        subtitle="Locais, categorias Audicamp, categorias de Inspeções e tipos de resíduo."
      />
      <Err error={error} />
      <Msg text={msg} />

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Locais de trabalho</h3>
        <p className="muted">Cadastrados por Gestor, TST e Supervisor · usados em PT e Emergências Ambientais.</p>
        {canLocations ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void create('/locations', loc, 'Local cadastrado', () =>
                setLoc({ code: '', name: '', description: '' }),
              );
            }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: 8, marginBottom: 12 }}
          >
            <input className="field" placeholder="Código" required value={loc.code} onChange={(e) => setLoc({ ...loc, code: e.target.value })} />
            <input className="field" placeholder="Nome" required value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} />
            <input className="field" placeholder="Descrição" value={loc.description} onChange={(e) => setLoc({ ...loc, description: e.target.value })} />
            <button className="btn btn-primary">Adicionar</button>
          </form>
        ) : null}
        <ul>
          {locations.map((x) => (
            <li key={fieldOf(x, 'id')}>
              <b>{fieldOf(x, 'code')}</b> — {fieldOf(x, 'name')}
            </li>
          ))}
          {locations.length === 0 ? <li className="muted">Nenhum local.</li> : null}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Categorias Audicamp</h3>
        <p className="muted">Cadastradas por Gestor e TST.</p>
        {canAudicamp ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void create('/audicamp/categories', aud, 'Categoria Audicamp salva', () =>
                setAud({ code: '', name: '', description: '' }),
              );
            }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: 8, marginBottom: 12 }}
          >
            <input className="field" placeholder="Código" required value={aud.code} onChange={(e) => setAud({ ...aud, code: e.target.value })} />
            <input className="field" placeholder="Nome" required value={aud.name} onChange={(e) => setAud({ ...aud, name: e.target.value })} />
            <input className="field" placeholder="Descrição" value={aud.description} onChange={(e) => setAud({ ...aud, description: e.target.value })} />
            <button className="btn btn-primary">Adicionar</button>
          </form>
        ) : null}
        <ul>
          {audicamp.map((x) => (
            <li key={fieldOf(x, 'id')}>
              <b>{fieldOf(x, 'code')}</b> — {fieldOf(x, 'name')}
            </li>
          ))}
          {audicamp.length === 0 ? <li className="muted">Nenhuma categoria.</li> : null}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Categorias de Inspeções</h3>
        <p className="muted">Cadastradas por Gestor, Supervisor e TST.</p>
        {canInspection ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void create('/inspections/categories', ins, 'Categoria de inspeção salva', () =>
                setIns({ code: '', name: '', description: '' }),
              );
            }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr auto', gap: 8, marginBottom: 12 }}
          >
            <input className="field" placeholder="Código" required value={ins.code} onChange={(e) => setIns({ ...ins, code: e.target.value })} />
            <input className="field" placeholder="Nome" required value={ins.name} onChange={(e) => setIns({ ...ins, name: e.target.value })} />
            <input className="field" placeholder="Descrição" value={ins.description} onChange={(e) => setIns({ ...ins, description: e.target.value })} />
            <button className="btn btn-primary">Adicionar</button>
          </form>
        ) : null}
        <ul>
          {inspections.map((x) => (
            <li key={fieldOf(x, 'id')}>
              <b>{fieldOf(x, 'code')}</b> — {fieldOf(x, 'name')}
            </li>
          ))}
          {inspections.length === 0 ? <li className="muted">Nenhuma categoria.</li> : null}
        </ul>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Tipos de resíduo</h3>
        <p className="muted">Cadastrados por TST e Gestor · usados em Resíduos e Emergências Ambientais.</p>
        {canWaste ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void create('/waste/catalog', wst, 'Tipo de resíduo salvo', () => setWst({ code: '', name: '' }));
            }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, marginBottom: 12 }}
          >
            <input className="field" placeholder="Código" required value={wst.code} onChange={(e) => setWst({ ...wst, code: e.target.value })} />
            <input className="field" placeholder="Nome" required value={wst.name} onChange={(e) => setWst({ ...wst, name: e.target.value })} />
            <button className="btn btn-primary">Adicionar</button>
          </form>
        ) : null}
        <ul>
          {waste.map((x) => (
            <li key={fieldOf(x, 'id')}>
              <b>{fieldOf(x, 'code')}</b> — {fieldOf(x, 'name')}
            </li>
          ))}
          {waste.length === 0 ? <li className="muted">Nenhum tipo.</li> : null}
        </ul>
      </div>
    </>
  );
}
