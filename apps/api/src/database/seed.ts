import { config as loadEnv } from 'dotenv';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import {
  encryptField,
  hashPassword,
  hashPin,
} from '@pisma/security';

function loadEnvFile() {
  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      loadEnv({ path: p });
      return;
    }
  }
  loadEnv();
}

async function upsertUser(
  client: Client,
  input: {
    username: string;
    password: string;
    fullName: string;
    workId: string;
    role: string;
    jobFunction?: string;
  },
) {
  const passwordHash = await hashPassword(input.password, 12);
  const userRes = await client.query(
    `INSERT INTO users (username, password_hash, status, first_login_completed)
     VALUES ($1, $2, 'ACTIVE', TRUE)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [input.username, passwordHash],
  );
  const userId = userRes.rows[0].id as string;

  await client.query(
    `INSERT INTO user_profiles (user_id, full_name, job_function, employer, employee_number)
     VALUES ($1, $2, $3, 'Empresa Demo PISMA', $4)
     ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name`,
    [userId, input.fullName, input.jobFunction ?? null, `EMP-${input.username}`],
  );

  await client.query(
    `INSERT INTO user_work_roles (user_id, work_id, role, active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (user_id, work_id, role) DO UPDATE SET active = TRUE`,
    [userId, input.workId, input.role],
  );

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const encKey = process.env.FIELD_ENCRYPTION_KEY!;
  const pinHash = await hashPin('135790', 12);

  await client.query(
    `UPDATE signature_credentials SET status = 'REVOKED', revoked_at = NOW(), revoked_reason = 'seed rotate'
     WHERE user_id = $1 AND status = 'ACTIVE'`,
    [userId],
  );
  await client.query(
    `INSERT INTO signature_credentials
      (user_id, public_key, encrypted_private_key_blob, pin_hash, status, key_version)
     VALUES ($1, $2, $3, $4, 'ACTIVE', 1)`,
    [userId, publicKey, encryptField(privateKey, encKey), pinHash],
  );

  return userId;
}

async function main() {
  loadEnvFile();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  if (!process.env.FIELD_ENCRYPTION_KEY) {
    throw new Error('FIELD_ENCRYPTION_KEY is required');
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const work = await client.query(
    `INSERT INTO works (code, name, client_name, company_name, status, timezone)
     VALUES ('OBRA-DEMO', 'Contrato Ilhéus (Demo)', 'Cliente Demo', 'Empresa Demo PISMA', 'ACTIVE', 'America/Sao_Paulo')
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const workId = work.rows[0].id as string;

  await client.query(
    `INSERT INTO contract_features (work_id, feature_key, enabled)
     VALUES ($1, 'THIRD_PARTY', FALSE)
     ON CONFLICT (work_id, feature_key) DO NOTHING`,
    [workId],
  );

  const password = 'ChangeMe!123';
  const users = [
    { username: 'master.demo', fullName: 'Master Demo', role: 'MASTER' },
    {
      username: 'tecnico.demo',
      fullName: 'Técnico Demo',
      role: 'TECHNICIAN',
      jobFunction: 'Técnico Mecânico',
    },
    { username: 'tst.demo', fullName: 'TST Demo', role: 'TST' },
    { username: 'supervisor.demo', fullName: 'Supervisor Demo', role: 'SUPERVISOR' },
    { username: 'gestor.demo', fullName: 'Gestor Demo', role: 'MANAGER' },
  ] as const;

  for (const u of users) {
    await upsertUser(client, {
      username: u.username,
      password,
      fullName: u.fullName,
      workId,
      role: u.role,
      jobFunction: 'jobFunction' in u ? u.jobFunction : undefined,
    });
  }

  // Master também na obra
  const master = await client.query(`SELECT id FROM users WHERE username = 'master.demo'`);
  const tecnico = await client.query(`SELECT id FROM users WHERE username = 'tecnico.demo'`);
  const tst = await client.query(`SELECT id FROM users WHERE username = 'tst.demo'`);
  const supervisor = await client.query(`SELECT id FROM users WHERE username = 'supervisor.demo'`);
  const gestor = await client.query(`SELECT id FROM users WHERE username = 'gestor.demo'`);
  const supervisorId = supervisor.rows[0].id as string;
  const gestorId = gestor.rows[0].id as string;
  const existingNotice = await client.query(
    `SELECT 1 FROM notice_items WHERE work_id = $1 AND title = $2 LIMIT 1`,
    [workId, 'Ambiente de demonstração'],
  );
  if (!existingNotice.rowCount) {
    await client.query(
      `INSERT INTO notice_items (work_id, user_id, severity, title, body, source_type)
       VALUES ($1, $2, 'INFO', 'Ambiente de demonstração', 'Dados fictícios. Não use em produção.', 'SYSTEM')`,
      [workId, master.rows[0].id],
    );
  }

  // Dados de conformidade demo (idempotente por nome)
  const techId = tecnico.rows[0].id as string;
  const tstId = tst.rows[0].id as string;

  const hasTraining = await client.query(
    `SELECT 1 FROM employee_trainings WHERE work_id=$1 AND technician_user_id=$2 AND training_name=$3 LIMIT 1`,
    [workId, techId, 'NR-35 Trabalho em Altura'],
  );
  if (!hasTraining.rowCount) {
    await client.query(
      `INSERT INTO employee_trainings
        (work_id, technician_user_id, training_name, completed_at, validity_value, validity_unit, valid_until, created_by)
       VALUES
        ($1,$2,'NR-35 Trabalho em Altura', CURRENT_DATE - 100, 12, 'MONTHS', CURRENT_DATE + 265, $3),
        ($1,$2,'NR-10 Básico', CURRENT_DATE - 400, 24, 'MONTHS', CURRENT_DATE - 30, $3)`,
      [workId, techId, tstId],
    );
  }

  const hasAso = await client.query(
    `SELECT 1 FROM employee_aso_records WHERE work_id=$1 AND technician_user_id=$2 AND status='ACTIVE' LIMIT 1`,
    [workId, techId],
  );
  if (!hasAso.rowCount) {
    await client.query(
      `INSERT INTO employee_aso_records
        (work_id, technician_user_id, aso_date, valid_until, administrative_notes, created_by)
       VALUES ($1,$2, CURRENT_DATE - 60, CURRENT_DATE + 305, 'Registro administrativo demo', $3)`,
      [workId, techId, tstId],
    );
  }

  const hasRule = await client.query(
    `SELECT 1 FROM competency_rules WHERE work_id=$1 AND name=$2 LIMIT 1`,
    [workId, 'NR-35 obrigatória para Altura'],
  );
  if (!hasRule.rowCount) {
    await client.query(
      `INSERT INTO competency_rules
        (work_id, name, job_function, activity_nature, requirement_type, requirement_key, blocking, created_by)
       VALUES
        ($1,'NR-35 obrigatória para Altura','Técnico Mecânico','ALTURA','TRAINING','NR-35',TRUE,$2),
        ($1,'ASO válido para atividade crítica',NULL,'CRITICA','ASO','ASO',TRUE,$2)`,
      [workId, tstId],
    );
  }

  // Usuário para testar primeiro acesso
  const pendingPass = await hashPassword(password, 12);
  const pending = await client.query(
    `INSERT INTO users (username, password_hash, status, first_login_completed)
     VALUES ('novo.demo', $1, 'PENDING_FIRST_LOGIN', FALSE)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [pendingPass],
  );
  await client.query(
    `INSERT INTO user_profiles (user_id, full_name, job_function, employer)
     VALUES ($1, 'Técnico Novo Demo', 'Técnico Elétrico', 'Empresa Demo PISMA')
     ON CONFLICT (user_id) DO NOTHING`,
    [pending.rows[0].id],
  );
  await client.query(
    `INSERT INTO user_work_roles (user_id, work_id, role, active)
     VALUES ($1, $2, 'TECHNICIAN', TRUE)
     ON CONFLICT (user_id, work_id, role) DO UPDATE SET active = TRUE`,
    [pending.rows[0].id, workId],
  );

  // --- Wave 2-8 demo data ---
  const ptSchema = {
    revision: '05',
    maxValidityHours: 12,
    sections: [
      {
        key: 'emission',
        title: 'Emissão',
        questions: [
          {
            key: 'emission.area_prepared',
            text: 'Área liberada e sinalizada?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: true,
          },
          {
            key: 'emission.team_briefed',
            text: 'Equipe orientada sobre a atividade?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: true,
          },
        ],
      },
      {
        key: 'hazards',
        title: 'Perigos',
        questions: [
          {
            key: 'hazards.height',
            text: 'Trabalho em altura aplicável?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: false,
          },
          {
            key: 'hazards.hot_work',
            text: 'Trabalho a quente aplicável?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: false,
          },
          {
            key: 'hazards.energized',
            text: 'Sistema energizado/risco elétrico?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: false,
          },
        ],
      },
      {
        key: 'precautions',
        title: 'Precauções',
        questions: [
          {
            key: 'precautions.ppe_ok',
            text: 'EPIs adequados disponíveis e em uso?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: true,
          },
          {
            key: 'precautions.escape_routes_clear',
            text: 'Rotas de fuga desimpedidas?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: true,
          },
          {
            key: 'precautions.emergency_ready',
            text: 'Meios de emergência disponíveis?',
            type: 'YES_NO_NA',
            required: true,
            blockingOnNo: true,
          },
        ],
      },
    ],
  };

  const hasPtTpl = await client.query(
    `SELECT id FROM pt_templates WHERE work_id = $1 AND code = 'PT-GERAL' AND revision = '05' LIMIT 1`,
    [workId],
  );
  let ptTemplateId: string;
  if (!hasPtTpl.rowCount) {
    const tpl = await client.query(
      `INSERT INTO pt_templates
        (work_id, code, revision, name, schema_json, max_validity_hours, status, created_by)
       VALUES ($1,'PT-GERAL','05','Permissão de Trabalho Geral (Rev.05-like)',$2::jsonb,12,'ACTIVE',$3)
       RETURNING id`,
      [workId, JSON.stringify(ptSchema), tstId],
    );
    ptTemplateId = tpl.rows[0].id as string;
  } else {
    ptTemplateId = hasPtTpl.rows[0].id as string;
  }

  const hasEquip = await client.query(
    `SELECT id FROM equipment_assets WHERE work_id = $1 AND tag = 'TAG-SOL-044' LIMIT 1`,
    [workId],
  );
  let equipmentId: string;
  if (!hasEquip.rowCount) {
    const clTpl = await client.query(
      `INSERT INTO equipment_checklist_templates
        (work_id, code, name, equipment_category, revision, status, created_by)
       VALUES ($1,'CHK-SOL','Checklist Solda/Equipamento','SOLDAGEM','01','ACTIVE',$2)
       ON CONFLICT (work_id, code, revision) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [workId, tstId],
    );
    const checklistTemplateId = clTpl.rows[0].id as string;
    const qCount = await client.query(
      `SELECT 1 FROM equipment_checklist_questions WHERE template_id = $1 LIMIT 1`,
      [checklistTemplateId],
    );
    if (!qCount.rowCount) {
      await client.query(
        `INSERT INTO equipment_checklist_questions
          (template_id, question_key, section, text, answer_type, required, blocking_on_no, sort_order)
         VALUES
          ($1,'chk.visual','geral','Inspeção visual sem danos?','YES_NO_NA',TRUE,TRUE,1),
          ($1,'chk.guards','geral','Proteções instaladas?','YES_NO_NA',TRUE,TRUE,2),
          ($1,'chk.cables','geral','Cabos/conexões íntegros?','YES_NO_NA',TRUE,TRUE,3)`,
        [checklistTemplateId],
      );
    }
    const eq = await client.query(
      `INSERT INTO equipment_assets
        (work_id, tag, name, category, manufacturer, model, location, status,
         current_checklist_template_id, created_by)
       VALUES ($1,'TAG-SOL-044','Máquina de Solda MIG Demo','SOLDAGEM','DemoWeld','MW-200','Oficina',$2,$3,$4)
       RETURNING id`,
      [workId, 'ACTIVE', checklistTemplateId, tstId],
    );
    equipmentId = eq.rows[0].id as string;
  } else {
    equipmentId = hasEquip.rows[0].id as string;
  }

  const hasApr = await client.query(
    `SELECT 1 FROM risk_analyses WHERE work_id = $1 AND code = 'APR-DEMO-001' LIMIT 1`,
    [workId],
  );
  if (!hasApr.rowCount) {
    const apr = await client.query(
      `INSERT INTO risk_analyses
        (work_id, type, code, title, activity, created_by, status)
       VALUES ($1,'TASK_APR','APR-DEMO-001','APR Soldagem Oficina','Soldagem estrutural',$2,'APPROVED')
       RETURNING id`,
      [workId, tstId],
    );
    const ver = await client.query(
      `INSERT INTO risk_analysis_versions
        (risk_analysis_id, version_number, content_jsonb, sha256, created_by, approved_by, approved_at)
       VALUES ($1,1,$2::jsonb,'seed', $3,$3,NOW()) RETURNING id`,
      [
        apr.rows[0].id,
        JSON.stringify({
          hazards: ['queimadura', 'fumaça', 'radiação UV'],
          controls: ['EPI', 'ventilação', 'isolamento de área'],
        }),
        tstId,
      ],
    );
    await client.query(
      `UPDATE risk_analyses SET current_version_id = $1 WHERE id = $2`,
      [ver.rows[0].id, apr.rows[0].id],
    );
  }

  // Catálogo Audicamp FS 02-04 A-F (configurável via notice/document metadata)
  const hasAudCatalog = await client.query(
    `SELECT 1 FROM notice_items WHERE work_id = $1 AND title = 'Catálogo Audicamp FS 02-04' LIMIT 1`,
    [workId],
  );
  if (!hasAudCatalog.rowCount) {
    const catalog = {
      source: 'FS 02-04 AUDCAMPO Rev.02',
      categories: [
        {
          code: 'A',
          name: 'Reação das Pessoas',
          sub: ['A1', 'A2', 'A3', 'A4'],
        },
        {
          code: 'B',
          name: 'Falta de EPI ou Uso Inadequado',
          sub: ['cabeça', 'sistema respiratório', 'olhos e rosto', 'ouvidos', 'mãos e braços', 'tronco', 'pés e pernas'],
        },
        {
          code: 'C',
          name: 'Posicionamento Errado',
          sub: [
            'bater contra / ser atingido por',
            'ficar preso',
            'risco de queda',
            'risco de queimadura',
            'risco de choque elétrico',
            'inalar contaminantes',
            'absorver contaminantes',
            'ingerir contaminantes',
            'postura inadequada',
            'esforço inadequado',
          ],
        },
        {
          code: 'D',
          name: 'Ferramentas e Equipamentos Inadequados',
          sub: [
            'impróprios para o serviço',
            'usados incorretamente',
            'em condições inseguras',
            'equipamento com vazamento ou poluição ambiental',
          ],
        },
        {
          code: 'E',
          name: 'Falha de Procedimento',
          sub: [
            'procedimento inadequado',
            'inexistência de procedimento escrito',
            'descumprimento de procedimento',
          ],
        },
        {
          code: 'F',
          name: 'Ambiente de Trabalho Inadequado',
          sub: [
            'ordem e limpeza deficiente',
            'coleta seletiva inadequada',
            'vazamento ou derramamento',
            'isolamento inexistente ou deficiente',
            'falta de sinalização ou identificação',
          ],
        },
      ],
    };
    await client.query(
      `INSERT INTO notice_items (work_id, user_id, severity, title, body, source_type, source_id)
       VALUES ($1,$2,'INFO','Catálogo Audicamp FS 02-04',$3,'SYSTEM','AUDICAMP_CATALOG')`,
      [workId, master.rows[0].id, JSON.stringify(catalog)],
    );
    await client.query(
      `INSERT INTO contract_features (work_id, feature_key, enabled, config_json)
       VALUES ($1,'AUDICAMP_CATALOG',TRUE,$2::jsonb)
       ON CONFLICT (work_id, feature_key)
       DO UPDATE SET config_json = EXCLUDED.config_json, enabled = TRUE`,
      [workId, JSON.stringify(catalog)],
    );
  }

  const wasteItems = [
    { code: 'RES-OLEO', name: 'Óleo usado', hazardClass: 'Classe I', unit: 'L' },
    { code: 'RES-EPIs', name: 'EPIs contaminados', hazardClass: 'Classe I', unit: 'KG' },
    { code: 'RES-METAL', name: 'Sucata metálica', hazardClass: 'Classe II', unit: 'KG' },
    { code: 'RES-SOLV', name: 'Solvente residual', hazardClass: 'Classe I', unit: 'L' },
  ];
  for (const w of wasteItems) {
    await client.query(
      `INSERT INTO waste_catalog (work_id, code, name, hazard_class, unit, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (work_id, code) DO NOTHING`,
      [workId, w.code, w.name, w.hazardClass, w.unit, tstId],
    );
  }

  const locations = [
    { code: 'LOC-01', name: 'Área de Solda' },
    { code: 'LOC-02', name: 'Subestação' },
    { code: 'LOC-03', name: 'Pátio de Resíduos' },
  ];
  for (const loc of locations) {
    await client.query(
      `INSERT INTO work_locations (work_id, code, name, created_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (work_id, code) DO NOTHING`,
      [workId, loc.code, loc.name, gestorId],
    );
  }

  const audCats = [
    { code: 'A', name: 'Reação das Pessoas' },
    { code: 'B', name: 'EPI' },
    { code: 'C', name: 'Posicionamento' },
    { code: 'D', name: 'Ferramentas' },
    { code: 'E', name: 'Procedimentos' },
    { code: 'F', name: 'Ambiente' },
  ];
  for (const c of audCats) {
    await client.query(
      `INSERT INTO audicamp_categories (work_id, code, name, created_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (work_id, code) DO NOTHING`,
      [workId, c.code, c.name, tstId],
    );
  }

  const inspCats = [
    { code: 'INSP-GERAL', name: 'Inspeção geral de área' },
    { code: 'INSP-EPI', name: 'Inspeção de EPI' },
    { code: 'INSP-EQP', name: 'Inspeção de equipamentos' },
  ];
  for (const c of inspCats) {
    await client.query(
      `INSERT INTO inspection_categories (work_id, code, name, created_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (work_id, code) DO NOTHING`,
      [workId, c.code, c.name, supervisorId],
    );
  }

  void equipmentId;
  void ptTemplateId;

  console.log('seed complete');
  console.log(`workId=${workId}`);
  console.log('PIN assinatura seed: 135790');
  console.log('senha: ChangeMe!123');
  console.log('primeiro acesso: novo.demo / ChangeMe!123');
  console.log('PT template: PT-GERAL Rev.05 | equipment: TAG-SOL-044');

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
