import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { CriticalActionButton } from '../offline';
import { Err, Msg, PageHead, emptyItems, fieldOf } from './shared';

type Row = Record<string, unknown>;

export function WastePage() {
  const { token, user } = useAuth();
  const [lots, setLots] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lot, setLot] = useState({ wasteType: '', weightKg: '', location: '' });
  const [req, setReq] = useState({ lotIds: '' as string, notes: '' });
  const [pin, setPin] = useState('');
  const isManager = ['MANAGER', 'MASTER'].includes(user?.role ?? '');

  async function load() {
    try {
      setError(null);
      const w = await api<unknown>('/waste', { token });
      setLots(emptyItems<Row>(w));
      const r = await api<unknown>('/waste/removal-requests', { token });
      setRequests(emptyItems<Row>(r));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar resíduos');
      setLots([]);
      setRequests([]);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function createLot(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/waste', {
        method: 'POST',
        token,
        body: JSON.stringify({
          wasteType: lot.wasteType,
          weightKg: Number(lot.weightKg),
          location: lot.location,
        }),
      });
      setMsg('Lote registrado');
      setLot({ wasteType: '', weightKg: '', location: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar lote');
    }
  }

  async function requestRemoval(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/waste/removal-requests', {
        method: 'POST',
        token,
        body: JSON.stringify({
          lotIds: req.lotIds.split(',').map((s) => s.trim()).filter(Boolean),
          notes: req.notes,
        }),
      });
      setMsg('Solicitação de retirada criada');
      setReq({ lotIds: '', notes: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na solicitação');
    }
  }

  async function signRequest(id: string) {
    try {
      await api(`/waste/removal-requests/${id}/sign`, {
        method: 'POST',
        token,
        body: JSON.stringify({ pin }),
      });
      setMsg('Solicitação assinada pelo Gestor');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na assinatura');
    }
  }

  return (
    <>
      <PageHead
        title="Gestão de Resíduos"
        subtitle="Lotes, solicitação de retirada e assinatura do Gestor."
      />
      <Err error={error} />
      <Msg text={msg} />

      <form className="card" onSubmit={createLot} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Novo lote</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input
            className="field"
            placeholder="Tipo de resíduo"
            required
            value={lot.wasteType}
            onChange={(e) => setLot({ ...lot, wasteType: e.target.value })}
          />
          <input
            className="field"
            placeholder="Peso (kg)"
            type="number"
            step="0.01"
            required
            value={lot.weightKg}
            onChange={(e) => setLot({ ...lot, weightKg: e.target.value })}
          />
          <input
            className="field"
            placeholder="Local / depósito"
            value={lot.location}
            onChange={(e) => setLot({ ...lot, location: e.target.value })}
          />
        </div>
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Registrar lote</button>
      </form>

      <div className="card" style={{ marginBottom: 12, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Lotes</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Tipo</th>
              <th align="left">Peso</th>
              <th align="left">Local</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {lots.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum lote.
                </td>
              </tr>
            ) : (
              lots.map((l) => (
                <tr key={fieldOf(l, 'id')}>
                  <td>
                    <code>{fieldOf(l, 'id').slice(0, 8)}</code>
                  </td>
                  <td>{fieldOf(l, 'wasteType', 'waste_type', 'type')}</td>
                  <td>{fieldOf(l, 'weightKg', 'weight_kg')} kg</td>
                  <td>{fieldOf(l, 'location')}</td>
                  <td>
                    <span className="badge">{fieldOf(l, 'status')}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={requestRemoval} style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Solicitar retirada</h3>
        <input
          className="field"
          placeholder="IDs dos lotes (vírgula)"
          required
          value={req.lotIds}
          onChange={(e) => setReq({ ...req, lotIds: e.target.value })}
        />
        <div style={{ height: 8 }} />
        <textarea
          className="field"
          rows={2}
          placeholder="Observações"
          value={req.notes}
          onChange={(e) => setReq({ ...req, notes: e.target.value })}
        />
        <div style={{ height: 8 }} />
        <button className="btn btn-primary">Solicitar</button>
      </form>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Solicitações de retirada</h3>
        {requests.length === 0 ? (
          <p className="muted">Nenhuma solicitação.</p>
        ) : (
          requests.map((r) => (
            <div key={fieldOf(r, 'id')} style={{ borderTop: '1px solid #e5e7eb', padding: '10px 0' }}>
              <b>Pedido {fieldOf(r, 'id').slice(0, 8)}</b>{' '}
              <span className="badge">{fieldOf(r, 'status')}</span>
              <div className="muted">{fieldOf(r, 'notes')}</div>
              {isManager && fieldOf(r, 'status') !== 'SIGNED' ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    className="field"
                    placeholder="PIN do Gestor"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={{ maxWidth: 140 }}
                  />
                  <CriticalActionButton type="button" onClick={() => void signRequest(fieldOf(r, 'id'))}>
                    Assinar retirada
                  </CriticalActionButton>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}
