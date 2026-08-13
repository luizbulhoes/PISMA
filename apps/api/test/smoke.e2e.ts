/**
 * Smoke E2E crítico — Onda 8
 * Executar com API no ar: pnpm --filter @pisma/api exec tsx test/smoke.e2e.ts
 */
const BASE = process.env.API_URL ?? 'http://localhost:3000/api/v1';

async function req(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return json;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function login(username: string) {
  const r = await req('POST', '/auth/login', { username, password: 'ChangeMe!123' });
  return r as { accessToken: string; user: { id: string; role: string; canEmitPt: boolean } };
}

async function main() {
  const health = await req('GET', '/health');
  assert(health.status === 'ok', 'health');

  const tecnico = await login('tecnico.demo');
  const tst = await login('tst.demo');
  const gestor = await login('gestor.demo');
  assert(tecnico.user.canEmitPt === true, 'tecnico emite');
  assert(tst.user.canEmitPt === false, 'tst não emite');
  assert(gestor.user.canEmitPt === false, 'gestor não emite');

  let denied = false;
  try {
    await req('POST', '/pts', { osNumber: 'X', description: 'negado' }, tst.accessToken);
  } catch {
    denied = true;
  }
  assert(denied, 'TST blocked from PT create');

  const equipment = await req('GET', '/equipment', undefined, tst.accessToken);
  assert(Array.isArray(equipment.items), 'equipment list');

  const pts = await req('GET', '/pts', undefined, tecnico.accessToken);
  assert(Array.isArray(pts.items), 'pts list');

  const dash = await req('GET', '/dashboards/summary', undefined, gestor.accessToken);
  assert(dash && typeof dash === 'object', 'dashboard');

  const audicamp = await req(
    'POST',
    '/audicamp',
    {
      recordType: 'DEVIATION',
      categoryCode: 'F',
      subcategoryCode: 'F3',
      area: 'Casa de bombas',
      description: 'Smoke test vazamento controlado',
    },
    tecnico.accessToken,
  );
  assert(audicamp.id, 'audicamp created');

  const prea = await req('GET', '/prea', undefined, tecnico.accessToken);
  assert(Array.isArray(prea.items) || Array.isArray(prea), 'prea list');

  const occ = await req('GET', '/occurrences', undefined, tst.accessToken);
  assert(Array.isArray(occ.items) || Array.isArray(occ), 'occurrences');

  console.log('SMOKE OK');
  console.log(
    JSON.stringify(
      {
        health: health.version,
        equipment: equipment.items?.length ?? 0,
        pts: pts.items?.length ?? 0,
        audicamp: audicamp.id,
        dashboardKeys: Object.keys(dash).slice(0, 8),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('SMOKE FAIL', e);
  process.exit(1);
});
