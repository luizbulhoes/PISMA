# memory.md — Registro permanente de melhorias e decisões (PISMA)

**Produto:** PISMA — Plataforma Integrada de Segurança e Meio Ambiente  
**Versão:** 1.3  
**Repositório canônico:** https://github.com/luizbulhoes/PISMA  
**Fonte de requisitos:** `PISMA_IA_Development_Package_v1.3_CONSOLIDADO/01_CANONICAL_SPEC/PISMA_PRD_v1.3.md`  
**Última atualização deste arquivo:** 2026-08-13 (PT assinatura do emissor, equipe e bloqueio em Não)

---

## Protocolo de sincronização com GitHub

Manter **sempre** o remoto `origin/main` alinhado ao trabalho local:

1. Após qualquer entrega relevante (onda, correção, docs), executar commit + `git push origin main`.
2. Nunca versionar `.env`, `storage/`, `node_modules/`, `dist/`.
3. Atualizar **este** `memory.md` em toda melhoria aprovada ou implementada.
4. Decisões pendentes de PO ficam em `docs/DECISION_REQUIRED.md` e são espelhadas aqui.

Remote: `https://github.com/luizbulhoes/PISMA.git`

---

### 2026-08-13 — PT: assinatura do emissor, equipe e bloqueio em Não

**Tipo:** correção / melhoria · **Status:** feito · **Git:** (push `main`)

- Após o técnico emitir/submeter a PT, a assinatura digital do **emissor** aparece na lista (não mais “sem assinaturas” enquanto aguarda TST/Supervisor).
- Técnicos envolvidos: lista da Obra com técnicos e supervisor, **exceto o próprio emissor**.
- Qualquer item marcado como **Não** impede avançar/emitir a PT (UI + API). Precauções obrigatórias não têm N/A — só Sim/Não.
- Menu: ao abrir Nova PT, só esse item fica destacado (`end` no NavLink). O campo APR deixou de ser o primeiro da tela e só recebe foco ao ser clicado.

**Por quê:** a emissão já é uma assinatura; a equipe da atividade não inclui o emissor; Não é bloqueante de segurança; o destaque do menu/campo não pode induzir seleção de APR.

### 2026-08-13 — Técnicos envolvidos na PT + interface em português

**Tipo:** melhoria de produto · **Status:** feito · **Git:** (push `main`)

- Removido o texto instrutivo das naturezas na emissão da PT (“Selecione a aplicabilidade…”).
- “Novo colaborador” substituído por **Técnicos envolvidos**: inclusão via modal “Novo técnico envolvido na atividade” (lista da Obra, quantos forem necessários) e exclusão via modal “Remover técnico da atividade”.
- Linguagem padrão da UI em **português do Brasil**: papéis, situações (rascunho/aprovada/etc.), sincronização, bloqueios, ocorrências, PAC, Audicamp e demais códigos internos passam por `displayLabel` / `roleLabel`.

**Por quê:** o fluxo de equipe da PT é de técnicos da Obra, não de “colaborador” genérico; o operador de campo não deve ver códigos em inglês.

### 2026-08-13 — Melhorias Perfil Técnico / UX SSTA (lote operacional)

**Tipo:** melhoria de produto · **Status:** feito · **Git:** (push `main`)

- **Mural** passou a ser a tela inicial (`/`) de todos os papéis; Resumo ficou em `/resumo`.
- **Paleta verde SSTA** em tokens UI + shell (sidebar, badges, fundos).
- Papéis em português na UI (`Técnico`, `Gestor`, etc.) via `roleLabel` / `@pisma/domain`.
- **PT — naturezas:** todas as 9 naturezas disponíveis; cada uma com Aplicável / Não aplicável (N/A indisponibiliza o item).
- **PT — vínculo APR:** etapa inicial vincula APR existente; naturezas aplicáveis da APR são automarcadas e travadas.
- **APR:** só TST / Supervisor / Gestor cadastram; define naturezas do local; aprovação até 4 técnicos + Gestor.
- **Assinatura digital local:** cadastro inicial exige selfie + CPF + crachá frente/verso + assinatura visual + PIN; PT exige autorização de assinatura; aprovação e check-in usam PIN e registram assinatura no documento.
- **Incluir técnicos + check-in:** equipe convidada faz check-in com assinatura após PT autorizada.
- **Impressão PT + APR:** `GET /pts/:id/print-bundle` após autorização.
- **Cadastros:** locais (Gestor/TST/Supervisor), categorias Audicamp (Gestor/TST), categorias Inspeções (Gestor/Supervisor/TST), tipos de resíduo (TST/Gestor) — tela `/cadastros` + migration `008`.
- **Inspeções:** título unificado “Inspeções”; removido “Tarefas”.
- **Emergências Ambientais:** título correto; PREA construído dentro; locais e tipos de resíduo cadastrados; fotos com upload + descrição; introdução no início do formulário.
- **Resíduos:** tipo e local por lista cadastrada.
- Revisão de placeholders com texto entre parênteses sem sentido.

**Por quê:** alinhar o fluxo de campo do Técnico e a linguagem SSTA ao uso real em obra (múltiplas naturezas, APR como fonte de verdade, assinatura formal e cadastros mestres).

### 2026-08-13 — Correção 500 PT + FS 13-01 + APR assinatura
- **Tipo:** correção / melhoria · **Status:** feito
- 500 em PT/print/get: `full_name` vinha de `users` — corrigido para `user_profiles`.
- Técnico passa a listar pares em `/technicians` para incluir na PT.
- Naturezas da PT com checklists FS 13-01: N/A oculta; Aplicável abre Sim/Não/N/A.
- APR: técnico aprova/reprova com assinatura digital da sessão (sem PIN); impressão PDF.
- Copy PT: observação de aprovação TST/Supervisor no passo 5.

---

## Princípios não negociáveis (já implementados)

| # | Princípio | Onde |
|---|---|---|
| 1 | Frontend orienta; backend decide | Guards NestJS + RBAC/ABAC por Obra |
| 2 | Histórico assinado não é reescrito | Versões, supersessão, auditoria append-only |
| 3 | Somente Técnico emite PT | `canEmitPt`, `@Roles('TECHNICIAN')` em `POST /pts` |
| 4 | TST / Supervisor / Gestor não emitem PT | Testes de domínio + smoke E2E |
| 5 | Gestor preenche slots TST/Supervisor em ações separadas | `POST /pts/:id/approve` com um `slot` por chamada |
| 6 | Assinatura/aprovação/atos críticos nunca offline | UI `CriticalActionButton` + servidor |
| 7 | RA exige CAT PDF antes das assinaturas da conclusão | Gate no módulo occurrences |
| 8 | PAC/Audicamp sem linguagem de culpa por padrão | Copy UX + triagem proporcional |
| 9 | Escopo v1.3 respeita adiados | Sem DDS, CAT/eSocial auto, QR ops, IA copiloto |

---

## Linha do tempo de implementação

### 2026-08-13 — Bootstrap e Onda 0 (Fundação)

**Melhoria / entrega**

- Monorepo pnpm: `apps/api`, `apps/web`, `apps/pdf-worker`, `packages/*`, `infra/*`
- NestJS API `/api/v1` + Swagger
- React + Vite + PWA shell
- PostgreSQL migrations `001_foundation.sql`
- Auth por sessão (token hash), isolamento por Obra
- Auditoria append-only com cadeia de hashes
- Upload privado com SHA-256 + confidencialidade
- Mural de avisos, PDF stub, health check
- Docker Compose preparado (Docker Desktop ausente no host → fallback local)
- Seed fictício de perfis e obra demo
- `.env.example` sem segredos; `.gitignore` reforçado

**Justificativa comercial:** base industrial multi-obra para escala de clientes sem reescrever identidade/auditoria depois.

**Defaults adotados:** sessão em PostgreSQL; storage local plugável; `contract_features` criado cedo (DR-11).

---

### 2026-08-13 — Onda 1 (Pessoas e conformidade)

**Melhoria / entrega**

- Migration `002_people_compliance.sql`
- Assistente de primeiro acesso (senha, dados, privacidade, assinatura visual, PIN, selfie/crachá)
- Ficha do Técnico + PDF
- Treinamentos / ASO / EPI (tamanho, troca, termo eletrônico + assinatura PIN)
- Bloqueios operacionais do Gestor
- Matriz de competência + avaliação bloqueante
- Cadastro de usuários pelo Master
- Usuário seed `novo.demo` para testar primeiro acesso

**Justificativa:** conformidade documental e competência são pré-requisito de PT e de venda B2B em obras.

---

### 2026-08-13 — Ondas 2–8 (plataforma completa v1.3)

**Onda 2 — Ativos e documentos**

- Equipamentos por TAG, certificados, checklists executáveis
- Documentos/procedimentos versionados com resumo de revisão → aviso no Mural

**Onda 3 — Risco e PT**

- APR Digital + GRO/PGR inventário
- PT Digital: rascunho, submissão, aprovação/reprovação, edição única, cancelamento, reemissão, início, suspensão, revalidação, encerramento
- Pesquisa/filtros; painel operacional
- Bloqueios por checklist de equipamento / competência conforme regras

**Onda 4 — Prevenção de campo**

- Audicamp (categorias A–F), triagem TST/Gestor
- Inspeções digitais (templates + execução)
- PAC proporcional (responsável, prazo, evidência, verificação)

**Onda 5 — Ocorrências**

- RA/RQA com participantes, depoimentos imutáveis, evidências
- Gate CAT PDF no RA antes de assinaturas da conclusão

**Onda 6 — Meio ambiente**

- PREA com evidências e dupla aprovação
- Gestão de resíduos + solicitação de retirada + assinatura do Gestor
- Resíduos de PREA alimentam gestão de resíduos

**Onda 7 — Gestão e mobilidade**

- Dashboards/KPIs consolidados
- Sync status / fila offline
- Banner offline; bloqueio de ações críticas sem rede

**Onda 8 — Hardening**

- Smoke E2E (`apps/api/test/smoke.e2e.ts`)
- `docs/OPERATIONS.md`, `docs/SECURITY_CHECKLIST.md`
- Aliases de API para alinhar frontend ↔ backend canônico
- Publicação inicial no GitHub (`main` / commit inicial)

**Justificativa:** transformar o pacote PRD em produto implantável, testável e comercializável por contrato/obra.

---

## Melhorias técnicas aplicadas (além do “mínimo formulário”)

| ID interno | Melhoria | Status | Motivo |
|---|---|---|---|
| IMP-01 | Hash chain em `audit_events` | Feito | Integridade verificável (`GET /audit/verify`) |
| IMP-02 | CPF criptografado + token de busca HMAC | Feito | LGPD / minimização |
| IMP-03 | Credencial AEI (RSA + PIN bcrypt) | Feito | Assinatura não compartilhável |
| IMP-04 | Storage com SHA-256 e níveis de confidencialidade | Feito | Evidências médicas/restritas |
| IMP-05 | Feature flag `contract_features` | Feito | Terceiros e catálogo Audicamp por obra |
| IMP-06 | Templates de PT versionados (schema JSON) | Feito | Evitar hardcode a cada revisão FS 13-01 |
| IMP-07 | Conflito de versão em draft/aprovação | Feito | Concorrência em campo |
| IMP-08 | Triagem Audicamp sem culpa automática | Feito | Adoção operacional / anti-burocracia |
| IMP-09 | Aliases REST amigáveis (`/apr`, `/dashboards/summary`, …) | Feito | UX de integração front/API |
| IMP-10 | Smoke E2E de papéis críticos | Feito | Regressão rápida pré-homologação |
| IMP-11 | `memory.md` + protocolo de sync GitHub | Feito | Rastreabilidade comercial e técnica |

---

## Sugestões ainda pendentes de aprovação do PO

Espelho de `docs/DECISION_REQUIRED.md` (não implementar silenciosamente):

| ID | Tema | Status |
|---|---|---|
| DR-01 | Prazo de retenção | Pendente |
| DR-02 | Validação Master do 1º cadastro | Pendente (default: alerta) |
| DR-03 | 1 vs 2 aprovadores na edição única | Default: TST+Supervisor |
| DR-04 | Validade máxima PT | Default: 12h |
| DR-05 | Bloqueio automático por vencimento | Default: só se regra blocking |
| DR-06 | Ciência de colaborador sem conta | Pendente |
| DR-07 | Tipografia IBM Plex local | Aguarda aprovação |
| DR-08 | Redis obrigatório | Aguarda aprovação |
| DR-09 | MinIO padrão | Aguarda aprovação |
| DR-10 | OpenTelemetry | Aguarda aprovação |
| DR-11 | `contract_features` cedo | **Adotado no schema** |
| DR-12 | Metodologias extras RA/RQA | Fora de escopo |
| DR-13 | Docker no ambiente local | Compose pronto; host sem Docker |

Itens em `04_FUTURE_NOT_IMPLEMENTED/SUGESTOES_PENDENTES_v1.3.md` (5 Porquês, Ishikawa, SIMOPS, etc.) permanecem **não implementados**.

---

## Contas seed (dev apenas — desativar em produção)

| Usuário | Papel |
|---|---|
| `master.demo` | MASTER |
| `tecnico.demo` | TECHNICIAN |
| `tst.demo` | TST |
| `supervisor.demo` | SUPERVISOR |
| `gestor.demo` | MANAGER |
| `novo.demo` | TECHNICIAN (primeiro acesso) |

Senha seed: `ChangeMe!123` · PIN: `135790`

---

## Como registrar uma nova melhoria neste arquivo

Template:

```markdown
### YYYY-MM-DD — Título curto
- **Tipo:** correção | melhoria | onda | decisão PO
- **O que mudou:** …
- **Por quê (comercial/segurança):** …
- **Status:** feito | aguarda PO | rejeitado
- **Refs:** arquivos / DR-XX / PRD §…
- **Git:** commit `sha` · push `main`
```

---

## Histórico Git relevante

| Data | Commit | Descrição |
|---|---|---|
| 2026-08-13 | `cd0319e` | Initial commit PISMA v1.3 (ondas 0–8) no GitHub |
| 2026-08-13 | `6a076d3` | Adiciona `memory.md` e protocolo de sync contínuo |
| 2026-08-13 | *(este)* | Melhorias Técnico/SSTA: Mural home, naturezas, APR, assinatura, cadastros, Emergências Ambientais |

---

*Este arquivo é a memória operacional do produto para equipe e IAs de desenvolvimento. Em caso de conflito com o PRD v1.3, prevalece o PRD; em caso de conflito sobre o que já foi construído, prevalece o código + este registro.*
