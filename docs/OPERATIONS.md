# Operação — PISMA v1.3

## Ambientes

| Ambiente | Uso |
|---|---|
| development | local (este README) |
| homologation | rede interna com usuários reais controlados |
| production | somente após Acceptance Gate + SECURITY_CHECKLIST |

## Subir local

```bash
cp .env.example .env
node apps/api/scripts/setup-db.js   # cria role/db pisma (requer postgres admin)
pnpm install
pnpm --filter @pisma/domain build && pnpm --filter @pisma/schemas build && pnpm --filter @pisma/security build
pnpm db:migrate
pnpm db:seed
pnpm --filter @pisma/api dev
pnpm --filter @pisma/web dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs

## Backup / restore

```bash
# backup
export DATABASE_URL=postgresql://pisma:pisma@localhost:5432/pisma
bash infra/backup/backup.sh ./backups

# restore (homologação)
gunzip -c backups/pisma_YYYYMMDD_HHMMSS.sql.gz | psql "$DATABASE_URL"
```

Também faça backup do diretório `STORAGE_LOCAL_PATH` (anexos).

## Health

`GET /api/v1/health` — DB + versão.

## Observabilidade (mínimo v1.3)

- Logs Nest estruturados no stdout
- Auditoria append-only + `GET /api/v1/audit/verify` (Master)
- OTel desligado até aprovação DR-10

## Offline / PWA

- Rascunhos permitidos offline
- Assinar / aprovar / concluir = **somente online** (UI bloqueia + backend decide)
- Conflito de versão: cliente deve reenviar com `expectedVersionId`

## Troubleshooting

| Sintoma | Ação |
|---|---|
| Login 401 | seed: `ChangeMe!123`; conferir `users.status` |
| 403 em PT create | somente TECHNICIAN emite |
| Migração falha | conferir `DATABASE_URL` e extensões pgcrypto |
| Upload falha | MIME permitido: jpeg/png/webp/pdf; max 15MB |
| Termo EPI | Técnico assina com PIN `135790` (seed) |

## Produção (checklist curto)

Ver `docs/SECURITY_CHECKLIST.md` e `ACCEPTANCE_GATE.md` do pacote canônico.
Desativar contas `*.demo` antes de produção.
