# Checklist de segurança pré-produção — PISMA v1.3

- [ ] `.env` de produção sem valores de exemplo
- [ ] SESSION_SECRET e FIELD_ENCRYPTION_KEY rotacionáveis e longos
- [ ] HTTPS obrigatório (CA interna)
- [ ] Storage privado (não servido pelo nginx estático)
- [ ] Backup criptografado testado (restore drill)
- [ ] Headers Helmet / CSRF strategy revisados
- [ ] Upload MIME/size validados
- [ ] Logs sem senha/PIN/CPF em claro
- [ ] Auditoria com verificação de cadeia
- [ ] Contas seed desabilitadas
- [ ] Rate limit em /auth/login
- [ ] NTP monitorado
