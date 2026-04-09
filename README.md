# Architec (Life OS)

Um “Segundo Cérebro” digital. Sistema integrado para gestão de conhecimento, execução de projetos e controle financeiro, unificando múltiplos domínios da vida pessoal em uma única arquitetura de software.

---

## Visão Geral

O Architec é um ERP pessoal, projetado para resolver a fragmentação da vida digital.

Em vez de usar ferramentas separadas:

- **Notion** → conhecimento  
- **Todoist** → tarefas  
- **Excel** → finanças  

O Architec unifica esses domínios por meio de um modelo de dados relacional robusto, onde informação, execução e recursos financeiros se conectam.

Este projeto está em desenvolvimento como exercício de engenharia de software, simulando desafios reais encontrados em sistemas de mercado.

---

## Objetivo de Engenharia

O foco do projeto é arquitetural, explorando conceitos de sistemas reais.

### Complexidade de Dados
- Estruturas recursivas (WBS – Work Breakdown Structure)  
- Grafos de dependência entre tarefas  
- Modelagem de séries temporais para dados financeiros  

### Integridade de Sistema
- Regras de negócio centralizadas no backend (NestJS)  
- Consistência garantida no banco relacional (PostgreSQL)  
- Validações estruturais e relacionais  

### Escalabilidade
- Arquitetura preparada para crescimento  
- Estrutura em monorepo  
- Ambiente isolado via Docker  
- Separação clara entre domínios  

---

## Arquitetura

O sistema segue princípios de separação de responsabilidades:

| Camada | Responsabilidade |
|--------|------------------|
| Frontend | Interface e experiência do usuário |
| Backend | Regras de negócio, validações e integrações |
| Banco de Dados | Consistência relacional e integridade dos dados |

**Fluxo geral**

Frontend (React) → API REST (NestJS) → PostgreSQL

O backend é responsável por proteger a lógica do sistema, evitando que regras críticas fiquem no cliente.

---

## Tech Stack

### Backend & Infra
- NestJS — Framework Node.js estruturado e escalável  
- PostgreSQL — Banco de dados relacional  
- Prisma ORM — Acesso type-safe ao banco  
- Docker — Containerização do ambiente  

---

## Docker Mais Leve

Para reduzir consumo de recursos no dia a dia:

- O banco usa volume nomeado (evita crescer a pasta versionada).
- O pgAdmin roda só quando necessário via profile.
- Logs dos containers foram limitados.

Subir apenas banco:

```bash
docker compose up -d
```

Subir banco + pgAdmin:

```bash
docker compose --profile tools up -d
```

---

## Criação/Login com Google (Backend)

Endpoint novo na API:

- `POST /users/google`

Payload:

```json
{
	"idToken": "TOKEN_ID_GOOGLE"
}
```

Variável obrigatória na API:

- `GOOGLE_CLIENT_ID`

Comportamento:

- Se o e-mail já existir, faz login e retorna JWT.
- Se não existir, cria conta automaticamente e retorna JWT.

### Configuração Necessária (Frontend + Backend)

1. Crie os arquivos de ambiente a partir dos exemplos:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

2. No Google Cloud Console:

- Crie um projeto e configure a tela de consentimento OAuth.
- Crie um OAuth Client ID do tipo **Web application**.
- Em "Authorized JavaScript origins", adicione:
	- `http://localhost:5173`
	- (produção) URL real do frontend.

3. Copie o mesmo Client ID para:

- `apps/api/.env` em `GOOGLE_CLIENT_ID`
- `apps/web/.env` em `VITE_GOOGLE_CLIENT_ID`

4. Suba backend e frontend. O botão Google aparece automaticamente na tela de login quando `VITE_GOOGLE_CLIENT_ID` estiver definido.

### Frontend
- React (Vite) — UI moderna e performática  
- TypeScript — Tipagem estática e segurança  
- TailwindCSS + Shadcn/ui — Design system e componentes  
- Zustand — Gerenciamento de estado leve  

---

## Módulos do Sistema

### Knowledge
Sistema de notas inspirado no método Zettelkasten.

- Editor de texto rico (suporte a Markdown)  
- Links bidirecionais entre notas  
- Sistema de tags hierárquicas  

### Execution
Gestão de projetos com foco em estrutura e dependências.

- Árvore de tarefas infinita (WBS – algoritmo recursivo)  
- Dependência entre tarefas (bloqueios)  
- Integração com calendário (time blocking)  

### Resources
Controle de fluxo de caixa integrado ao restante do sistema.

- Contas a pagar e receber  
- Recorrência automática de despesas  
- Dashboards de projeção financeira  

---

## Status do Projeto

O projeto está em desenvolvimento contínuo, com foco em:

- Evolução da modelagem de dados  
- Implementação das regras de negócio  
- Integração progressiva entre os domínios  

---

## Por que este projeto existe?

Este repositório faz parte do meu portfólio como engenheiro de software. Grande parte dos sistemas que desenvolvo profissionalmente são privados, então o Architec foi criado para demonstrar:

- Capacidade de modelar sistemas complexos  
- Organização arquitetural  
- Pensamento orientado a domínio  
- Boas práticas de backend e banco de dados  

---

**Autor:** Matheus Juski  
Projeto de portfólio focado em Engenharia de Software.

---

## Deploy em Nuvem (MVP)

Guia completo da task de provisionamento e deploy:

- [DEPLOYMENT.md](DEPLOYMENT.md)
