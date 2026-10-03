# Worki Agent — Dashboard

Painel de operacao do Agente Dominante: filas, conversas, tarefas, aprovacoes,
memorias e auditoria.

Deploy na **Vercel**. O backend `worki-agent` roda no **EasyPanel** e este
repositorio **nao o altera** — apenas le o estado dele.

---

## O que o painel mostra

| Pagina | Conteudo |
|---|---|
| `/` | Visao geral: status do servico, contadores, aprovacoes pendentes, tarefas e mensagens recentes, logs |
| `/servico` | Estado do `n8n/worki-agent` no EasyPanel, resposta do `/health`, logs |
| `/conversas` | Conversas, sessao do Hermes vinculada, mensagens e tarefas por conversa |
| `/tarefas` | Tarefas por status, etapas, checkpoint, proxima acao e resultado |
| `/aprovacoes` | Acoes aguardando confirmacao, com aprovacao por palavra |
| `/memorias` | Conhecimento acumulado, isolado por proprietario e projeto |
| `/auditoria` | Registro de acoes executadas, com resultado e duracao |

Filtros disponiveis: conversa, projeto, status e periodo. Todos via `GET`, o
que mantem o estado na URL e as paginas inteiramente server-side.

---

## Como a seguranca funciona

Este painel le o banco com `SUPABASE_SERVICE_ROLE_KEY`, que **ignora RLS**.
Nao existe barrier no banco segurando estes dados. A seguranca esta no
servidor, em tres camadas, nesta ordem:

1. **Sessao valida.** `middleware.ts` chama `supabase.auth.getUser()` — nao
   `getSession()`, que leria o cookie sem conferir com o Supabase.
2. **Allowlist.** `DASHBOARD_ALLOWED_EMAILS` define quem entra. Estar logado
   no projeto do Supabase nao basta: qualquer conta criada la entraria sem
   essa trava.
3. **Validacao por pagina.** Toda pagina chama `exigirAcesso()` antes de
   consultar. Se o middleware for removido por engano, as paginas seguem
   protegidas.

### Por que existe `env.ts` e `env-publico.ts`

O Next **inlina qualquer `NEXT_PUBLIC_*` no bundle no momento do build**.
Deleta-la da Vercel depois nao remove nada: ela continua em "View Source".

Por isso so existem duas publicas — URL e anon key, que nao concedem acesso
a nada porque o banco nao tem RLS liberado para `anon`. Todo o resto e lido
por `process.env` dentro de modulo marcado com `import 'server-only'`, que
faz o build quebrar se um Client Component tentar puxar.

A separacao em dois arquivos torna o erro impossivel de compilar: quem
precisa de config no cliente chama `env-publico.ts`, e ele nao alcanca
service role nem token.

Um teste de auditoria varre o bundle de producao procurando o valor real de
cada segredo. Ele **pula em vez de passar** quando nao ha build — um teste
que nao verifica nada e pior que um teste ausente.

---

## Aprovacoes

A unica escrita do painel. Passa por `worki_aprovar_acao`, que exige
`p_conversa_id`, `p_palavra` e `p_aprovador`.

Quatro guardas rodam antes da RPC:

- e-mail na allowlist (401)
- acao existe e esta `aguardando` (404 / 409)
- acao nao expirada (409) — o corte e `<=`, o mesmo do backend
- acao tem conversa definida (409)

O `aprovador` chega do corpo da requisicao, mas e **substituido pelo
e-mail validado da sessao**. Um cliente malicioso nao pode assumir o nome
de outro aprovador.

Aprovar registra a autorizacao. **A execucao continua sendo do worker** — o
painel nao executa nada.

---

## Integracao com o EasyPanel

Somente leitura. O modulo `src/lib/easypanel.ts` nao tem nenhuma procedure de
mutacao: reiniciar, parar e fazer deploy sao acoes destrutivas e nao fazem
parte do escopo. Um teste verifica isso.

Mostra se o servico esta online, ultimo deploy, branch, limites de recurso e
logs resumidos. O `token` nunca sai do servidor: e lido de `process.env` e
montado no header dentro da funcao.

Erros de rede sao mascarados antes de exibir — URL e identificadores internos
nao vazam para a tela.

---

## Variaveis de ambiente

Copie `.env.example` para `.env.local`. Detalhes e comentarios no proprio
arquivo.

| Variavel | Publica? | Funcao |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Auth no navegador. Nao da acesso a dados |
| `SUPABASE_SERVICE_ROLE_KEY` | **nao** | Leitura do banco, ignora RLS |
| `DASHBOARD_ALLOWED_EMAILS` | **nao** | Allowlist. Vazio = ninguem entra |
| `EASYPANEL_URL` | **nao** | Painel |
| `EASYPANEL_API_TOKEN` | **nao** | Token MCP, leitura de status |

**Nunca crie `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.** Um teste de
auditoria reprova o build se ela existir.

---

## Rodando local

```bash
npm install
cp .env.example .env.local   # preencha com valores reais
npm run dev
```

O painel sobe em `http://localhost:3000`. Sem `.env.local` correto, a tela
de login explica o que falta em vez de mostrar erro 500.

## Testes

```bash
npm test          # 48 testes
npm run typecheck # tsc --noEmit
npm run build     # build de producao
```

Cobertura:

| Arquivo | Cobre |
|---|---|
| `testes/autorizacao.test.ts` | Allowlist, e-mail nao autorizado, auditoria de variavel publica |
| `testes/aprovacao.test.ts` | Aprovacao valida, expirada, ja decidida, sem conversa, palavras por acao |
| `testes/memoria.test.ts` | Isolamento por proprietario e projeto, memoria global, vazamento |
| `testes/segredos.test.ts` | Segredo ausente do bundle, separacao de modulos, EasyPanel somente leitura |

Para verificar segredos no bundle de verdade, faca o build antes:

```bash
npm run build && npm test
```

---

## Deploy na Vercel

1. Importe o repositorio na Vercel.
2. Configure as seis variaveis em **Settings > Environment Variables**,
   para os tres ambientes (Production, Preview, Development).
3. Deploy.

O build e estatico do Next; nenhuma configuracao extra e necessaria.

**Antes de publicar em producao:** rotacione
`SUPABASE_SERVICE_ROLE_KEY` e `EASYPANEL_API_TOKEN`. Ambas apareceram em log
de build do EasyPanel.

---

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
`@supabase/ssr` · Vitest.

## Repositorio relacionado

`TrafegoWorki1/worki-agent` — backend. Fornece as 13 RPCs documentadas em
`docs/contrato-rpcs.json`, todas `backend_execute` com `anon_execute: false`.
E por isso que este painel precisa da service role no servidor: nao ha como
ler `conversas` ou `tarefas` com a anon key, por construcao.