# Deploy do MVP Archtec (Cloud)

Este documento cobre o deploy completo do MVP em nuvem com:
- Banco PostgreSQL gerenciado (Neon ou Supabase)
- Backend NestJS (Render ou Railway)
- Frontend React + Vite (Vercel)

## Resultado esperado

- Frontend acessível por URL publica HTTPS.
- Cadastro, login e persistencia de dados funcionando em producao.
- Nenhuma credencial sensivel no codigo fonte.

## Arquitetura de producao

- Frontend (Vercel)
- API NestJS (Render ou Railway)
- PostgreSQL gerenciado (Neon ou Supabase)

## Etapa 1 - Banco gerenciado (Neon recomendado)

1. Crie um projeto no Neon.
2. Crie um database para producao.
3. Copie a string de conexao PostgreSQL completa.
4. Salve essa string no seu cofre de secrets como DATABASE_URL.

Observacao:
- Use SSL habilitado (Neon ja fornece na URL).
- Nunca comite DATABASE_URL no repositorio.

## Etapa 2 - Deploy do Backend (Render)

### 2.1 Criar servico

1. No Render, crie um Web Service apontando para o repositorio.
2. Root directory: apps/api
3. Build command: npm install && npx prisma generate && npm run build
4. Start command: npm run start:prod

### 2.2 Variaveis de ambiente obrigatorias

- DATABASE_URL
- JWT_SECRET
- GOOGLE_CLIENT_ID (se Google Sign-In estiver ativo)
- CORS_ORIGIN (URL do frontend em producao, ex: https://seu-app.vercel.app)

### 2.3 Prisma migration

Depois de publicar o primeiro deploy, rode no shell do servico:

- npx prisma migrate deploy

Se preferir, adicione no Start command:

- npx prisma migrate deploy && npm run start:prod

## Etapa 3 - Deploy do Frontend (Vercel)

### 3.1 Criar projeto

1. Importe o repositorio na Vercel.
2. Root directory: apps/web
3. Build command: npm run build
4. Output directory: dist

### 3.2 Variaveis de ambiente obrigatorias

- VITE_API_URL (URL publica do backend, ex: https://api-seu-app.onrender.com)
- VITE_GOOGLE_CLIENT_ID (mesmo valor configurado no backend)

## Etapa 4 - Google Sign-In (o que precisa para funcionar)

1. No Google Cloud Console, configure OAuth Consent Screen.
2. Crie um OAuth Client ID do tipo Web application.
3. Em Authorized JavaScript origins, adicione:
   - http://localhost:5173
   - URL de producao do frontend (Vercel)
4. Copie o Client ID.
5. Configure o mesmo valor em:
   - Backend: GOOGLE_CLIENT_ID
   - Frontend: VITE_GOOGLE_CLIENT_ID

Como funciona no sistema:
- Frontend envia idToken para POST /users/google.
- Backend valida token com google-auth-library.
- Se usuario existir, autentica.
- Se nao existir, cria conta automaticamente e autentica.

## Etapa 5 - Validacao de aceite

Checklist final:

- Frontend em HTTPS acessivel (Vercel).
- Cadastro por email funcionando.
- Login por email funcionando.
- Login com Google funcionando.
- Criacao de nota/tarefa/transacao persistindo no banco cloud.
- CORS sem erro entre frontend e backend.
- Nenhum segredo em arquivos versionados.

## Etapa 6 - Auditoria de seguranca e qualidade pos-deploy

Rode esta rotina a cada deploy em producao.

### 6.1 Dependencias com vulnerabilidades

Backend (runtime):

npm --prefix apps/api audit --omit=dev

Frontend (runtime):

npm --prefix apps/web audit --omit=dev

Objetivo:
- Corrigir primeiro severidades high e critical.
- Evitar npm audit fix --force sem validar breaking changes.

### 6.2 Segredos hardcoded

Verifique se arquivos sensiveis nao foram versionados:

git ls-files apps/api/.env
git ls-files apps/web/.env

Se qualquer comando retornar arquivo, remova do versionamento imediatamente.

### 6.3 CORS e autenticacao

1. Abra o frontend em producao.
2. Faça login por email e por Google.
3. Abra o DevTools Network e confirme:
- Nao ha erro CORS.
- Requisicoes para a API retornam 2xx/401 esperado.

### 6.4 Prisma e banco

No backend em producao:

npx prisma migrate deploy

Depois valide criacao e leitura de dados reais no app.

### 6.5 Headers e HTTPS

Confirme:
- Frontend e backend com HTTPS.
- Cookies e tokens trafegam apenas em HTTPS em producao.
- Se usar proxy/CDN, habilite HSTS e X-Content-Type-Options.

### 6.6 Rotina de monitoramento

- Crie alerta para erro 5xx no provedor (Render/Railway/Vercel).
- Crie alerta para picos de latencia no backend.
- Revise logs de autenticacao (falhas repetidas de login).

## Seguranca e boas praticas

- Nunca comitar .env de producao.
- Rotacionar JWT_SECRET se vazar.
- Definir CORS_ORIGIN com dominio exato de producao.
- Habilitar backups automaticos no banco gerenciado.
- Criar ambiente separado para staging.

## Runbook rapido de troubleshoot

### 401 no login Google

- Verifique se VITE_GOOGLE_CLIENT_ID e GOOGLE_CLIENT_ID sao identicos.
- Verifique se o dominio do frontend esta nos Authorized JavaScript origins.

### Erro de CORS

- Verifique CORS_ORIGIN no backend com a URL exata da Vercel.
- Reinicie o backend apos alterar variaveis.

### Falha de conexao com banco

- Verifique DATABASE_URL e SSL.
- Rode npx prisma migrate deploy no backend.

## Arquivos de referencia no repo

- apps/api/.env.example
- apps/web/.env.example
- apps/api/src/users/users.service.ts
- apps/web/src/components/LoginForm.tsx
