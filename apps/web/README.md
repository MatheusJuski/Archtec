# Archtec — Web

Frontend do Archtec: React 19 + TypeScript + Vite, com Tailwind CSS v4 e componentes shadcn/ui.

---

## Rodando localmente

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev   # http://localhost:5173
```

A API precisa estar rodando (veja [apps/api](../api/README.md)).

---

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | URL da API (padrão `http://localhost:3333`) |
| `VITE_GOOGLE_CLIENT_ID` | Opcional. Quando definido, mostra o botão "Entrar com Google" |

---

## Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | ESLint (o CI exige zero erros) |

---

## Design system

- **Tokens** em `src/index.css`: superfícies, tinta, `--brand` (cobalto) e `--signal` (âmbar), com temas claro e escuro.
- **Linguagem visual**: cantos retos, hachuras, linhas finas e sombras sólidas. Utilitários: `hatch`, `label-tech`, `chip`, `chip-offset`, `mark-highlight`.
- **Componentes compartilhados** em `src/components/ui/`: `PageHeader`, `Panel`, `Divider`, `Stat`, `Skeleton`, `ConfirmDialog`, além dos componentes shadcn restilizados.
- **Shader** (`src/components/shader/`): fundo animado em WebGPU, carregado só quando o navegador suporta. Sem WebGPU, ou com "reduzir movimento" ativo, fica um fallback em CSS.
- **Fontes**: Space Grotesk (títulos), Inter (texto) e JetBrains Mono (números e rótulos).

---

## Performance

- Cada página é um chunk separado (`src/routes.ts`), baixado sob demanda. Passar o mouse ou focar no menu já faz o prefetch.
- React e Motion ficam em chunks de vendor próprios (`vite.config.ts`) para continuar em cache entre deploys.

---

## Resiliência

- **Error Boundary** (`src/components/ErrorBoundary.tsx`): um erro de renderização mostra uma tela de erro com "Tentar novamente", nunca uma página em branco. Também detecta chunk de versão antiga após um deploy e pede para recarregar.
- **Dashboard**: cada fonte de dados carrega de forma independente. O que falhar aparece como "—", com aviso e botão de tentar de novo, em vez de números zerados.
- **Sessão expirada**: aviso ao usuário. Notas não salvas ficam em rascunho local e podem ser restauradas após o novo login.
- **API hibernando** (Render free): `ServerWakeIndicator` mostra "Acordando o servidor…" enquanto a API sobe.

---

## Deploy

Vercel com Root Directory `apps/web`. O `vercel.json` redireciona todas as rotas para o `index.html`, para que atualizar a página em `/notes` não dê 404. Detalhes em [DEPLOYMENT.md](../../DEPLOYMENT.md).
