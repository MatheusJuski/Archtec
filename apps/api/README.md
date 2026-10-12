# Archtec — API

Backend do Archtec: API REST em NestJS + Prisma + PostgreSQL. Concentra as regras de negócio de notas, tarefas, calendário e finanças, sempre isoladas por usuário.

---

## Rodando localmente

```bash
# na raiz do repositório: sobe o PostgreSQL (porta 5433)
docker compose up -d

cd apps/api
cp .env.example .env
npm install
npx prisma migrate deploy
npm run start:dev   # http://localhost:3333
```

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | sim | String de conexão do PostgreSQL |
| `JWT_SECRET` | sim | Chave de assinatura do JWT (sessão de 1 dia) |
| `CORS_ORIGIN` | produção | URL(s) do frontend, separadas por vírgula |
| `GOOGLE_CLIENT_ID` | se usar Google | Mesmo Client ID do frontend |
| `TRUST_PROXY` | não (padrão `1`) | Saltos de proxy confiáveis para descobrir o IP real do cliente (rate limit) |
| `PORT` | não (padrão `3333`) | Porta HTTP |

---

## Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run start:dev` | Servidor com hot reload |
| `npm run build` / `npm run start:prod` | Build e execução de produção |
| `npm test` | Testes unitários e de integração (Jest) |
| `npm run lint` / `npm run lint:check` | ESLint (com e sem `--fix`) |
| `npm run format` / `npm run format:check` | Prettier (escreve / só verifica) |

O CI roda `format:check`, `lint:check`, typecheck, testes e build a cada push e pull request.

---

## Endpoints de saúde

| Rota | Banco? | Uso |
|------|--------|-----|
| `GET /health` | sim (`SELECT 1`) | Diagnóstico completo |
| `GET /health/live` | não | Ping externo (cron) para manter a API acordada |
| `GET /up` | não | Ping do frontend; nome neutro porque bloqueadores de anúncio barram URLs com "health" |

As três ficam fora do rate limit.

---

## Segurança

- **Rate limit por IP** (`src/throttle.config.ts`):
  - geral: 120 req/min e 3.000 req/hora;
  - `POST /users/login`, `/users/register` e `/users/google`: 10 req/min e 50 req/hora;
  - acima do limite a API responde `429` com o header `Retry-After`.
  - O contador fica em memória, o que serve para uma instância. Com várias instâncias, trocar por um storage compartilhado (ex.: Redis).
- **Helmet** para headers de segurança.
- **`trust proxy`**: atrás do proxy do Render, o IP real vem do `X-Forwarded-For`. Sem isso, todos os usuários dividiriam o mesmo limite.
- **Isolamento por usuário**: os services sempre filtram por `userId`; mover ou criar subtarefas valida que o pai é do mesmo usuário e impede ciclos na árvore.

---

## Estrutura

```
src/
  auth/           JWT strategy, guard e tipos da request autenticada
  users/          cadastro, login e login com Google
  notes/          notas e tags
  tasks/          árvore de tarefas (WBS)
  events/         calendário e timeblocks
  transactions/   receitas e despesas
  finance/        metas, contas a pagar/receber, projeções
  search/         busca global
  prisma/         PrismaService
  health.controller.ts
  throttle.config.ts
```
