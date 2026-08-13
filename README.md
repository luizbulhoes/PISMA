# PISMA — Plataforma Integrada de Segurança e Meio Ambiente

Versão **1.3**. Fonte canônica de requisitos: `PISMA_IA_Development_Package_v1.3_CONSOLIDADO/01_CANONICAL_SPEC/PISMA_PRD_v1.3.md`.

## Princípios

- O frontend orienta; o **backend decide**.
- Histórico assinado/aprovado **não é reescrito**.
- Técnico é o **único** perfil que emite PT.
- Assinaturas e atos críticos **nunca** concluem offline.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite (PWA) |
| Backend | NestJS + TypeScript (API versionada `/api/v1`) |
| Banco | PostgreSQL + migrations |
| Arquivos | Storage privado local (adapter S3/MinIO) |
| PDF | Worker dedicado |
| Deploy | Docker Compose (quando Docker disponível) |

## Estrutura

```text
apps/
  api/          # NestJS
  web/          # React PWA
  pdf-worker/   # geração PDF/snapshots
packages/
  domain/       # tipos e regras de domínio
  schemas/      # Zod / contratos
  security/     # hashing, crypto, RBAC helpers
  ui/           # design system
infra/
  docker/
  nginx/
  backup/
docs/
  DECISION_REQUIRED.md
```

## Pré-requisitos

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL 16+
- Docker (opcional; Compose em `infra/docker`)

## Setup rápido (sem Docker)

```bash
# 1. Variáveis
cp .env.example .env

# 2. Criar banco (ajuste usuário/senha)
# CREATE USER pisma WITH PASSWORD 'pisma';
# CREATE DATABASE pisma OWNER pisma;

# 3. Instalar
pnpm install

# 4. Migrar + seed fictício
pnpm db:migrate
pnpm db:seed

# 5. Subir API + Web
pnpm dev
```

- Web: http://localhost:5173  
- API/Swagger: http://localhost:3000/api/docs  

## Contas seed (somente desenvolvimento)

| Usuário | Senha | Papel |
|---|---|---|
| `master.demo` | `ChangeMe!123` | MASTER |
| `tecnico.demo` | `ChangeMe!123` | TECHNICIAN |
| `tst.demo` | `ChangeMe!123` | TST |
| `supervisor.demo` | `ChangeMe!123` | SUPERVISOR |
| `gestor.demo` | `ChangeMe!123` | MANAGER |
| `novo.demo` | `ChangeMe!123` | TECHNICIAN (primeiro acesso pendente) |

PIN de assinatura seed: `135790`

## Ondas implementadas (v1.3)

0 Fundação · 1 Pessoas · 2 Ativos/Docs · 3 APR/PGR/PT · 4 Audicamp/PAC/Inspeções · 5 RA/RQA · 6 PREA/Resíduos · 7 Dashboards/PWA · 8 Hardening

Operação: `docs/OPERATIONS.md` · Segurança: `docs/SECURITY_CHECKLIST.md` · Decisões: `docs/DECISION_REQUIRED.md`

Smoke: `pnpm --filter @pisma/api exec tsx test/smoke.e2e.ts`

## Decisões pendentes

Consulte `docs/DECISION_REQUIRED.md` antes de homologar regras parametrizáveis.

## Escopo fora da v1.3

DDS, emergências ampliadas, CAT/eSocial automático, QR operacional, copiloto de IA e metodologias extras de RA/RQA **não** entram nesta versão.
