# Acceptance Gate — PISMA v1.3

Use este checklist como porta de aceite do produto. O PRD contém os critérios detalhados e prevalece em caso de divergência.

## Identidade e autorização

- [ ] Cada ação é validada no backend por papel, Obra e estado.
- [ ] Técnico emite PT; TST/Supervisor/Gestor não emitem PT.
- [ ] Gestor pode atuar nos slots permitidos sem um único clique preencher duas assinaturas.
- [ ] Bloqueios administrativos e operacionais têm escopo, motivo, autor e auditoria.
- [ ] Usuário bloqueado tem sessão/ações revogadas conforme regra.

## Integridade documental

- [ ] Assinaturas usam reautenticação/PIN e vinculam hash/versão.
- [ ] Documento assinado não é sobrescrito.
- [ ] PDF e metadados são gerados a partir do snapshot correto.
- [ ] Alteração posterior cria versão/evento e preserva histórico.
- [ ] Auditoria é append-only e possui verificação de integridade.

## Pessoas, competência e EPI

- [ ] Ficha do Técnico mostra cadastro, treinamentos, ASO e EPIs.
- [ ] Técnico imprime a própria ficha.
- [ ] TST/Gestor registram treinamentos, ASO e EPI.
- [ ] Termo eletrônico de EPI é gerado e assinado pelo Técnico.
- [ ] Tamanho do EPI é aceito quando aplicável.
- [ ] Troca permite foto do EPI velho e novo como evidência recomendada.
- [ ] Matriz de Competência valida requisitos configurados antes das ações críticas.

## Equipamentos e PT

- [ ] Equipamentos são cadastrados por TAG e possuem status/certificados/checklists.
- [ ] Supervisor/TST/Gestor podem cadastrar equipamento e configurar checklist conforme permissão do PRD.
- [ ] Técnico seleciona os equipamentos da PT.
- [ ] Checklist obrigatório por TAG é executado antes da submissão.
- [ ] Falha bloqueante ou documento vencido impede submissão quando configurado.
- [ ] Lista de PTs possui pesquisa, filtro de data/equipe e impressão múltipla.

## PGR/APR

- [ ] Inventário de Riscos e Plano de Ação funcionam por Obra/área/processo/atividade/função.
- [ ] APR registra etapas, perigos, eventos, consequências, controles, avaliação inicial e residual.
- [ ] PT importa perigos/controles aplicáveis da APR sem redigitação desnecessária.
- [ ] Evidências de recorrência podem ser relacionadas ao Inventário sem inferência causal automática.

## Audicamp, Inspeções e PAC

- [ ] Qualquer usuário pode registrar Audicamp rapidamente.
- [ ] TST/Gestor realizam triagem.
- [ ] Audicamp pode encerrar sem PAC quando ação formal não for necessária.
- [ ] PAC possui responsável pela melhoria, prazo, evidência e verificação, sem linguagem de culpa por padrão.
- [ ] Inspeções usam modelos configuráveis e podem originar PAC conforme triagem/regra.

## RA/RQA

- [ ] TST/Gestor abrem processo.
- [ ] Principal envolvido tem acesso conforme regra; testemunha vê apenas seus depoimentos/tarefas.
- [ ] Depoimento assinado é imutável; complementação cria novo depoimento.
- [ ] Conclusão exige as assinaturas previstas no PRD.
- [ ] RA exige PDF da CAT antes de encaminhar a conclusão para assinatura.
- [ ] Anexos médicos e restritos possuem autorização e auditoria específica.

## Documentos e avisos

- [ ] Procedimentos possuem revisão, status, bloqueio e histórico.
- [ ] Nova revisão exige resumo da alteração.
- [ ] Usuários afetados recebem aviso individual no Mural.
- [ ] Notificações e escalonamentos são rastreáveis e configuráveis.

## PREA e resíduos

- [ ] Qualquer usuário autorizado pelo PRD consegue abrir PREA.
- [ ] PREA aceita descrição, imagens durante/após, local de depósito e resíduos por tipo/peso.
- [ ] PREA alerta TST/Gestor/Supervisor.
- [ ] Conclusão segue dupla aprovação e justificativas previstas.
- [ ] Resíduos de PREA aparecem automaticamente na gestão de resíduos.
- [ ] Solicitação de Retirada segue preenchimento, assinatura e liberação de download conforme fluxo.
- [ ] KPI ambiental separa resíduos por tipo e peso.

## PWA/offline

- [ ] Rascunhos permitidos offline nos pontos definidos.
- [ ] Assinaturas, aprovações e conclusões críticas não finalizam offline.
- [ ] Sincronização detecta conflito de versão.
- [ ] Usuário recebe confirmação clara do que foi ou não sincronizado.

## Segurança e operação

- [ ] Senha/PIN nunca em texto puro.
- [ ] CPF e documentos sensíveis protegidos e minimizados.
- [ ] Uploads privados e validados.
- [ ] HTTPS suportado/obrigatório em produção.
- [ ] Backups criptografados e restauração testada.
- [ ] Observabilidade e logs não contêm segredos.
- [ ] Testes E2E cobrem papéis, Obras, assinatura, offline e workflows críticos.
