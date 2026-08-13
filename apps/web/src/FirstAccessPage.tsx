import { FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';

const PRIVACY_VERSION = 'PISMA-PRIVACY-1.3';

export function FirstAccessPage() {
  const { token, user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const [pwd, setPwd] = useState({ currentPassword: 'ChangeMe!123', newPassword: '', confirm: '' });
  const [profile, setProfile] = useState({
    fullName: user?.fullName ?? '',
    cpf: '',
    birthYear: 1990,
    employeeNumber: '',
    jobFunction: 'Técnico Mecânico',
    employer: 'Empresa Demo PISMA',
  });
  const [pin, setPin] = useState({ pin: '', confirmPin: '' });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0F2744';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      drawing.current = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      drawing.current = false;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
    };
  }, [step]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.firstLoginCompleted) return <Navigate to="/" replace />;

  async function uploadPlaceholder(kind: 'selfie' | 'badge_front' | 'badge_back') {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e8eef3';
    ctx.fillRect(0, 0, 320, 240);
    ctx.fillStyle = '#0F2744';
    ctx.font = '16px sans-serif';
    ctx.fillText(`DEMO ${kind}`, 90, 120);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const fd = new FormData();
    fd.append('file', blob, `${kind}.png`);
    const res = await fetch('/api/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { id: string };
    await api(`/first-access/photo/${kind}`, {
      method: 'POST',
      token,
      body: JSON.stringify({ fileId: json.id }),
    });
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (step === 1) {
        if (pwd.newPassword !== pwd.confirm) throw new Error('Confirmação de senha diferente');
        await api('/first-access/password', {
          method: 'POST',
          token,
          body: JSON.stringify({
            currentPassword: pwd.currentPassword,
            newPassword: pwd.newPassword,
          }),
        });
      }
      if (step === 2) {
        await api('/first-access/profile', {
          method: 'POST',
          token,
          body: JSON.stringify({ ...profile, cpf: profile.cpf.replace(/\D/g, '') }),
        });
      }
      if (step === 3) {
        await api('/first-access/privacy', {
          method: 'POST',
          token,
          body: JSON.stringify({ privacyNoticeVersion: PRIVACY_VERSION, accepted: true }),
        });
      }
      if (step === 4) {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas ausente');
        const pngBase64 = canvas.toDataURL('image/png');
        await api('/first-access/signature-visual', {
          method: 'POST',
          token,
          body: JSON.stringify({ pngBase64 }),
        });
      }
      if (step === 5) {
        await api('/first-access/signature-pin', {
          method: 'POST',
          token,
          body: JSON.stringify(pin),
        });
      }
      if (step === 6) {
        await uploadPlaceholder('selfie');
        await uploadPlaceholder('badge_front');
        await uploadPlaceholder('badge_back');
        await api('/first-access/complete', { method: 'POST', token });
        await refreshUser();
        return;
      }
      setStep((s) => s + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={next} style={{ width: 'min(560px, 100%)' }}>
        <h1 style={{ marginTop: 0 }}>Ativação de conta</h1>
        <p className="muted">Etapa {step} de 6 — nenhuma outra função até concluir</p>

        {step === 1 && (
          <>
            <label className="muted">Senha temporária</label>
            <input className="field" type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
            <div style={{ height: 8 }} />
            <label className="muted">Nova senha</label>
            <input className="field" type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
            <div style={{ height: 8 }} />
            <label className="muted">Confirmar</label>
            <input className="field" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
          </>
        )}

        {step === 2 && (
          <>
            {(['fullName', 'cpf', 'employeeNumber', 'jobFunction', 'employer'] as const).map((k) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <label className="muted">{k}</label>
                <input
                  className="field"
                  value={String(profile[k])}
                  onChange={(e) => setProfile({ ...profile, [k]: e.target.value })}
                />
              </div>
            ))}
            <label className="muted">Ano nascimento</label>
            <input
              className="field"
              type="number"
              value={profile.birthYear}
              onChange={(e) => setProfile({ ...profile, birthYear: Number(e.target.value) })}
            />
          </>
        )}

        {step === 3 && (
          <div className="muted">
            <p>
              A PISMA coleta dados cadastrais, selfie, crachá e assinatura eletrônica interna para
              controle de segurança na Obra. Selfie não ativa reconhecimento facial automático.
            </p>
            <p>Versão do aviso: {PRIVACY_VERSION}</p>
            <p>Ao continuar, você declara ciência e concordância.</p>
          </div>
        )}

        {step === 4 && (
          <>
            <canvas
              ref={canvasRef}
              width={480}
              height={180}
              style={{ width: '100%', border: '1px solid #cbd5df', borderRadius: 8, touchAction: 'none', background: '#fff' }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                const c = canvasRef.current;
                const ctx = c?.getContext('2d');
                if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
              }}
            >
              Limpar
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <label className="muted">PIN de assinatura (6 dígitos)</label>
            <input className="field" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value })} />
            <div style={{ height: 8 }} />
            <label className="muted">Confirmar PIN</label>
            <input className="field" value={pin.confirmPin} onChange={(e) => setPin({ ...pin, confirmPin: e.target.value })} />
          </>
        )}

        {step === 6 && (
          <p className="muted">
            Em ambiente demo, selfie e crachá frente/verso serão gerados como imagens placeholder
            para concluir o cadastro. Em produção, use câmera/upload real.
          </p>
        )}

        {error ? <div className="error">{error}</div> : null}
        <div style={{ height: 12 }} />
        <button className="btn btn-primary" style={{ width: '100%' }}>
          {step === 6 ? 'Concluir cadastro' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}
