# DECISION_REQUIRED — PISMA v1.3

Registro de ambiguidades e melhorias propostas. **Não implementar itens pendentes sem aprovação explícita do Product Owner.**

## Status

| ID | Tipo | Decisão | Status |
|---|---|---|---|
| DR-01 | Parametrização | Prazo de retenção de PT e dados cadastrais | PENDENTE |
| DR-02 | Parametrização | Master valida visualmente o primeiro cadastro? | PENDENTE (default proposto: **não** — só alerta) |
| DR-03 | Parametrização | Autorização da única edição: 1 ou 2 aprovadores? | PENDENTE (default PRD: **TST + Supervisor**) |
| DR-04 | Parametrização | Validade máxima padrão da PT (horas) | PENDENTE (default proposto: **12h**) |
| DR-05 | Parametrização | Vencimento ASO/treinamento: bloqueio automático ou só alerta? | PENDENTE (default PRD: **configurável por regra de competência**) |
| DR-06 | Parametrização | Colaborador sem conta assina ciência digital? | PENDENTE (default proposto: **assinatura manuscrita em anexo**) |
| DR-07 | Melhoria | Fonte tipográfica local (IBM Plex Sans) em vez de Inter CDN | AGUARDA APROVAÇÃO |
| DR-08 | Melhoria | Redis obrigatório desde Onda 0 (sessões + fila PDF/jobs) | AGUARDA APROVAÇÃO |
| DR-09 | Melhoria | MinIO como storage padrão (mesmo em single-node) | AGUARDA APROVAÇÃO |
| DR-10 | Melhoria | OpenTelemetry desde Onda 0 (traces + métricas) | AGUARDA APROVAÇÃO |
| DR-11 | Melhoria | Feature flags por Obra via tabela `contract_features` desde Onda 0 | **ADOTADO** (schema Onda 0) |
| DR-12 | Fora de escopo | Metodologias extras RA/RQA (`04_FUTURE_NOT_IMPLEMENTED`) | **NÃO IMPLEMENTAR** |
| DR-13 | Infra | Docker Desktop ausente no ambiente de desenvolvimento | PENDENTE (Compose pronto; fallback local documentado) |

## Melhorias propostas (justificativa comercial)

### DR-07 — Tipografia local
**Motivo:** PRD exige zero CDN obrigatória em rede interna. Inter via CDN falha offline/intranet. Empacotar IBM Plex Sans (licença OFL, legível em campo) garante PWA e compliance.
**Impacto:** baixo. Não altera fluxos.

### DR-08 — Redis desde Onda 0
**Motivo:** sessões server-side, rate-limit, fila de PDF e sincronização offline precisam de store compartilhado ao escalar além de 1 nó. Introduzir depois gera retrabalho de sessão.
**Impacto:** médio em infra; baixo em UX.

### DR-09 — MinIO padrão
**Motivo:** uploads (selfie, crachá, evidências, CAT, PREA) exigem storage privado com hash. Diretório local não escala e complica backup. MinIO S3-compatível atende rede interna.
**Fallback:** filesystem local se MinIO indisponível (feature flag).

### DR-10 — OpenTelemetry na fundação
**Motivo:** aceite exige observabilidade. Instrumentar cedo evita “buracos” em auditoria operacional e facilita suporte multi-obra.
**Impacto:** baixo se for opt-in via env.

### DR-11 — `contract_features` na fundação
**Motivo:** terceiros/contratadas e futuros módulos usam flag por contrato. Criar tabela já na Onda 0 evita migration disruptiva depois.
**Impacto:** baixo (schema + helper).

## Defaults adotados temporariamente (reversíveis)

Enquanto o PO não decidir, o código usa:

- Autorização de edição única: **dois slots** (TST + Supervisor).
- Validade máxima PT: **12 horas** (configurável por Obra).
- Bloqueio por vencimento: **só quando regra de competência marcar `blocking=true`**.
- Storage: **filesystem privado** com adapter S3/MinIO plugável.
- Sessão: **PostgreSQL** (tabela `sessions`); Redis opcional.
- Observabilidade: **logs estruturados JSON + health**; OTel desligado até DR-10.
- Tipografia: **stack do PRD** com Inter empacotada localmente se disponível; fallback Segoe UI.

Ao aprovar/rejeitar, responda com: `APROVAR DR-XX` ou `REJEITAR DR-XX` (+ alternativa).
