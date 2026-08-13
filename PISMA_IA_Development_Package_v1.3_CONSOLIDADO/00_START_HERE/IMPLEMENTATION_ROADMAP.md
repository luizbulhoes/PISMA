# Roadmap de Implementação para IA — PISMA v1.3

A ordem abaixo reduz retrabalho e mantém os domínios críticos sobre uma base de identidade, auditoria e versionamento comum.

## Onda 0 — Fundação

- monorepo, padrões de código, CI;
- Docker Compose;
- PostgreSQL + migrations;
- armazenamento privado;
- autenticação, sessão, RBAC/ABAC por Obra;
- auditoria append-only;
- serviço de arquivos/hashes;
- serviço de notificações/Mural;
- serviço de geração PDF/snapshot;
- testes base de segurança e autorização.

## Onda 1 — Pessoas e conformidade

- Obras/contratos;
- usuários/perfis/bloqueios;
- primeiro acesso, selfie, crachá, assinatura visual e PIN;
- Ficha do Técnico;
- treinamentos, ASO;
- EPI, tamanhos, troca, termo eletrônico e assinatura;
- Matriz de Competência;
- terceiros/contratadas com feature flag por contrato.

## Onda 2 — Ativos e documentos

- equipamentos/ferramentas/TAG;
- certificados e validade;
- construtor de checklist de equipamento;
- execução de checklist por Técnico;
- documentos/procedimentos/versionamento/bloqueio;
- resumo de revisão e Mural de Avisos.

## Onda 3 — Risco e autorização operacional

- PGR/GRO/Inventário de Riscos/Plano de Ação;
- APR Digital;
- importação de perigos/controles para PT;
- PT Digital completa;
- checagem de competência e equipamentos antes da PT;
- aprovação TST/Supervisor/Gestor;
- edição única, revalidação, encerramento, cancelamento e reemissão;
- pesquisa, filtros e impressão múltipla.

## Onda 4 — Prevenção e campo

- Audicamp;
- Inspeções digitais;
- PAC com triagem proporcional;
- vinculação entre Audicamp/Inspeção/PT/PGR/PAC;
- painel operacional de PTs ativas.

## Onda 5 — Ocorrências

- RA/RQA;
- participantes, testemunhas e depoimentos imutáveis;
- evidências e documentos restritos;
- conclusão e assinaturas;
- requisito CAT PDF no RA;
- reabertura/aditivo conforme PRD.

## Onda 6 — Meio ambiente

- PREA;
- evidências durante/após tratamento;
- resíduos perigosos por tipo/peso;
- dupla aprovação;
- Gestão de Resíduos;
- Solicitação de Retirada;
- assinatura do Gestor;
- comprovantes/tickets e KPI ambiental.

## Onda 7 — Gestão e mobilidade

- dashboards consolidados;
- KPI de Audicamp, PT, PAC, competência, EPI/EPC, RA/RQA, inspeções e resíduos;
- Mural com escalonamentos configuráveis;
- PWA/offline controlado;
- sincronização, conflitos e retomada;
- performance e observabilidade.

## Onda 8 — Hardening e produção

- testes E2E de papéis e workflows;
- testes de concorrência;
- testes de autorização cruzada entre Obras;
- revisão OWASP/headers/CSRF/XSS/upload;
- backup/restauração;
- teste de desastre;
- performance;
- documentação operacional;
- homologação com usuários reais em ambiente controlado.

Cada onda deve conter migrations, rollback, testes e documentação. Não avançar acumulando dívida de autorização, auditoria ou segurança para uma etapa futura.
