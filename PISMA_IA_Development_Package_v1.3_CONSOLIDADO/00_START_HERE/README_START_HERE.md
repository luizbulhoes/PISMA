# PISMA v1.3 — Pacote Consolidado para IA de Desenvolvimento

Este pacote é o **handoff canônico** para desenvolvimento da **PISMA — Plataforma Integrada de Segurança e Meio Ambiente**.

## Ordem de leitura obrigatória

1. `00_START_HERE/MASTER_PROMPT_FOR_DEV_AI.md`
2. `00_START_HERE/SCOPE_LOCK_v1.3.md`
3. `01_CANONICAL_SPEC/PISMA_PRD_v1.3.md`
4. `01_CANONICAL_SPEC/REQUIREMENTS_INDEX.md` para navegação rápida
5. `02_UX_UI/Modelos_Frontend_PISMA_v1.3.pdf`
6. `02_UX_UI/frontend_mockup_v1.3.html`
7. `00_START_HERE/IMPLEMENTATION_ROADMAP.md`
8. `00_START_HERE/ACCEPTANCE_GATE.md`

## Regra de precedência

O arquivo **`PISMA_PRD_v1.3.md` é a fonte principal e mais recente de requisitos**. Em caso de conflito com documentos de referência, prevalece o PRD v1.3. Dentro do próprio PRD, aplica-se a regra de precedência indicada na versão 1.3: refinamentos mais recentes prevalecem sobre regras antigas.

Os arquivos em `03_SOURCE_REFERENCES/` são **fontes de contexto e modelos corporativos**, não especificações de software autônomas. Não importar dados pessoais, CNPJ, telefones, nomes ou exemplos desses documentos como dados reais de produção.

O conteúdo de `04_FUTURE_NOT_IMPLEMENTED/` **não deve ser implementado nesta versão**, salvo instrução posterior expressa do Product Owner.

## Resultado esperado da IA

A IA deve produzir uma aplicação industrial, testável e implantável em rede interna, com frontend, backend, banco, migrations, armazenamento de arquivos, auditoria, geração documental, autenticação, autorização por Obra, PWA/offline controlado e testes automatizados. O sistema não deve ser reduzido a um conjunto de formulários independentes.

## Integridade

Consulte `05_MACHINE_READABLE/checksums.sha256` para verificar os arquivos do pacote.
