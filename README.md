# Worki Agent — Dashboard

Painel de operacao do Agente Dominante: filas, conversas, tarefas, aprovacoes,
memorias e auditoria.

Deploy na **Vercel**. O backend `worki-agent` roda no **EasyPanel** e este
repositorio **nao o altera** — apenas le o estado dele.

---

## O que o painel mostra

| Pagina | Conteudo |
|---|---|
| `/` | Visao geral: status do servico e commit no ar, prontidao, **alertas**, tempo de resposta, aprovacoes pendentes, tarefas e mensagens recentes, logs |
| `/fila` | **Fila e entregas:** alertas, tempo de resposta (fila, Hermes, envio), mensagens esperando, saidas com filtro por status |
| `/servico` | Estado do `n8n/worki-agent` no EasyPanel, **versao no ar (commit)**, resposta do `/health` e do `/ready` (banco e worker), parametros do worker, logs |
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

### Somente leitura, verificado

O painel nao altera a fila do worker. A unica escrita e aprovar uma acao
(`worki_aprovar_acao`). Isso e **testado**: `testes/somente-leitura.test.ts`
varre o codigo e reprova qualquer `insert`/`update`/`delete`/`upsert` e
qualquer RPC alem dessa.

Existe por causa de um erro real: a Visao geral chamava
`worki_recuperar_leases` a cada abertura. A funcao parece uma consulta, mas
**escreve** (marca entradas como `falhou`, tarefas como `bloqueada` e envios
como `incerto`). Abrir o painel alterava a fila, e o contador so aparecia na
primeira vez, depois voltava a zero. Agora "reservas vencidas" vem de uma
consulta comum. Quem recupera reserva e o worker, no boot.

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

Mostra se o servico esta online, **o commit que esta rodando**, branch, limites
de recurso, **os parametros de comportamento do worker** e logs resumidos. O
`token` nunca sai do servidor: e lido de `process.env` e montado no header
dentro da funcao.

A resposta do EasyPanel traz o `env` **inteiro** do servico, com chaves em
texto puro. Por isso `src/lib/servico-parse.ts` nao repassa o texto bruto: so
sai o commit e uma **lista fechada** de parametros (tempos, limites,
sinalizadores), e so se o valor parecer numero ou sinalizador. Um segredo colado
por engano num desses campos nao passa. `testes/servico.test.ts` prova que
nenhum segredo do env aparece na saida.

O `/ready` do worker-agent (banco e worker de pe) e lido alem do `/health`, que
so prova que o processo responde. Do corpo do `/ready` saem so tres booleanos;
as mensagens de erro de infraestrutura nao saem do servidor.

Erros de rede sao mascarados antes de exibir — URL e identificadores internos
nao vazam para a tela.

---

## O que o painel acompanha do worker-agent

| Mudanca no worker-agent | Onde aparece |
|---|---|
| Respostas agora ficam `enviada`, com `enviado_em` | `/fila`: "enviadas (24 h)", coluna "Envio" do tempo de resposta |
| Respostas antigas sem envio confirmado (legado) | Alerta "paradas ha mais de 1 h", com o aviso de nao destravar a fila antes de encerrar essas linhas |
| Atalho de andamento ("terminou?") | Entrada `cancelada` com motivo proprio; contada em "atalho de andamento (24 h)" e **fora** das medias de tempo |
| Pedido falhou | "Falhas (24 h)"; a conversa nao fica mais travada |
| Worker parado ou conversa travada | Alerta vermelho: mensagem esperando sem nenhum pedido em execucao |
| Qual fase esta no ar | Commit na Visao geral e em `/servico` |
| Intervalo da fila, limite por pedido, atalho, divisao de mensagens | Tabela "Parametros do worker" em `/servico` |

Tempo de resposta = espera na fila + tempo do Hermes + envio. A mediana e o
percentil 90 usam as ultimas 20 mensagens.

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

Opcional, so para a pagina `/servico` mostrar o status do container:

| Variavel | Publica? | Funcao |
|---|---|---|
| `EASYPANEL_URL` | **nao** | Painel |
| `EASYPANEL_API_TOKEN` | **nao** | Token MCP, leitura de status |

Sem elas o painel funciona por completo; apenas `/servico` informa que a
integracao nao esta configurada, em vez de derrubar a rota.

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
npm test          # 84 testes
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
| `testes/somente-leitura.test.ts` | Nenhuma escrita no banco alem de aprovar; nenhuma RPC de manutencao da fila |
| `testes/fila.test.ts` | Tempos (fila, Hermes, envio), mediana e p90, saidas paradas, espera normal x travamento, alertas |
| `testes/servico.test.ts` | Commit implantado e parametros do worker; nenhum segredo do env na saida |

Para verificar segredos no bundle de verdade, faca o build antes:

```bash
npm run build && npm test
```

---

## Deploy na Vercel

1. Importe o repositorio na Vercel.
2. Configure as **quatro** variaveis obrigatorias em
   **Settings > Environment Variables**, no ambiente **Production**.
3. Deploy.

O build e estatico do Next; nenhuma configuracao extra e necessaria.

**Antes de publicar em producao:** rotacione
`SUPABASE_SERVICE_ROLE_KEY` e `EASYPANEL_API_TOKEN`. Ambas apareceram em log
de build do EasyPanel.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
`@supabase/ssr` · Vitest.

## Repositorio relacionado

`TrafegoWorki1/worki-agent` — backend. Fornece as 13 RPCs documentadas em
`docs/contrato-rpcs.json`, todas `backend_execute` com `anon_execute: false`.
E por isso que este painel precisa da service role no servidor: nao ha como
ler `conversas` ou `tarefas` com a anon key, por construcao.