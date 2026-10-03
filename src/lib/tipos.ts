/**
 * Tipos do banco `wxqwtyotkkshdjzzwjsk` (Agente Dominante).
 *
 * Derivados do DDL real em `worki-agent/supabase/migrations/`:
 *   - 20261002231514_baseline_agente_dominante.sql
 *   - 20261002231524_runtime_portugues.sql
 *
 * As migracoes seguintes (20261003*) so redefinem funcoes (RPCs); nao mudam
 * tabelas nem colunas, entao este arquivo nao muda por causa delas.
 *
 * Nao sao palpite: os nomes de coluna e os valores de `status` vem dos
 * CHECK constraints do banco. Se o backend mudar o schema, este arquivo
 * precisa mudar junto — e o teste `schema.test.ts` avisa quando os tipos
 * declarados divergirem do que o PostgREST responde.
 *
 * Os valores de status sao unicos em TypeScript para o compilador obrigar
 * a tratar o caso "estado desconhecido" explicitamente.
 */

/* ------------------------------------------------------------------ */
/* Status: exatamente os valores dos CHECK constraints                  */
/* ------------------------------------------------------------------ */

export const STATUS_TAREFA = [
  "ativa",
  "bloqueada",
  "concluida",
  "falhou",
  "cancelada",
] as const;
export type StatusTarefa = (typeof STATUS_TAREFA)[number];

export const STATUS_ETAPA = [
  "pendente",
  "executando",
  "concluida",
  "falhou",
  "incerto",
] as const;
export type StatusEtapa = (typeof STATUS_ETAPA)[number];

export const STATUS_SAIDA = [
  "pendente",
  "enviando",
  "enviada",
  "falhou",
  "incerto",
] as const;
export type StatusSaida = (typeof STATUS_SAIDA)[number];

export const STATUS_ACAO = [
  "aguardando",
  "confirmada",
  "consumida",
  "cancelada",
  "executada",
  "falhou",
  "expirada",
] as const;
export type StatusAcao = (typeof STATUS_ACAO)[number];

export const STATUS_MEMORIA = ["ativa", "substituida", "revogada"] as const;
export type StatusMemoria = (typeof STATUS_MEMORIA)[number];

export const TIPO_MEMORIA = [
  "fato",
  "preferencia",
  "decisao",
  "hipotese",
] as const;
export type TipoMemoria = (typeof TIPO_MEMORIA)[number];

export const STATUS_ENTRADA = [
  "aguardando",
  "processando",
  "concluida",
  "falhou",
  // Existe no CHECK do banco. O receptor do worker-agent cancela a entrada de
  // uma pergunta de andamento ("terminou?") depois de respondê-la na hora.
  "cancelada",
] as const;
export type StatusEntrada = (typeof STATUS_ENTRADA)[number];

/* ------------------------------------------------------------------ */
/* Tabelas                                                              */
/* ------------------------------------------------------------------ */

export type Conversa = {
  id: string;
  canal: string;
  instancia: string;
  chat_jid: string;
  participante_jid: string | null;
  session_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Mensagem = {
  id: string;
  instancia: string;
  provider_message_id: string | null;
  de: string | null;
  grupo_jid: string | null;
  tipo_mensagem: string | null;
  texto: string;
  criado_em: string;
  conversa_id: string | null;
  chat_jid: string | null;
};

export type Entrada = {
  id: string;
  mensagem_id: string;
  status: StatusEntrada;
  tentativas: number;
  disponivel_em: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  ultimo_erro: string | null;
  criado_em: string;
  atualizado_em: string;
  conversa_id: string | null;
  /** Ordem de chegada dentro da conversa; o worker respeita essa ordem. */
  ordem: number | null;
  /** Quando o Hermes comecou a executar. Nulo antes de iniciar. */
  execucao_iniciada_em: string | null;
};

/**
 * `ultimo_erro` das entradas canceladas pelo atalho de andamento do receptor
 * (worki-agent/integracoes/evolution/webhook.py). Usado so para contar.
 */
export const MOTIVO_ATALHO_ANDAMENTO = "respondida pelo atalho de andamento";

export type Saida = {
  id: string;
  entrada_id: string | null;
  conversa_id: string | null;
  chat_jid: string;
  texto: string;
  status: StatusSaida;
  idempotency_key: string | null;
  provider_message_id: string | null;
  tentativas: number;
  ultimo_erro: string | null;
  criado_em: string;
  enviado_em: string | null;
  disponivel_em: string | null;
  lease_owner: string | null;
  lease_expires_at: string | null;
};

export type Tarefa = {
  id: string;
  conversa_id: string;
  entrada_id: string | null;
  projeto_id: string | null;
  objetivo: string;
  status: StatusTarefa;
  etapa_atual: string | null;
  proxima_acao: string | null;
  checkpoint: Record<string, unknown> | null;
  resultado: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type EtapaTarefa = {
  id: string;
  tarefa_id: string;
  chave_operacao: string;
  input_hash: string;
  status: StatusEtapa;
  external_id: string | null;
  evidencia: Record<string, unknown> | null;
  criado_em: string;
  atualizado_em: string;
};

export type Memoria = {
  id: string;
  proprietario_id: string;
  projeto_id: string | null;
  chave: string;
  valor: string;
  tipo: TipoMemoria;
  fonte: string;
  confirmada: boolean;
  status: StatusMemoria;
  substitui_id: string | null;
  criado_em: string;
};

export type AcaoPendente = {
  id: number;
  conversa_id: string | null;
  tarefa_id: string | null;
  entrada_id: string | null;
  descricao: string;
  acao: string | null;
  alvo: string | null;
  payload: Record<string, unknown>;
  payload_hash: string | null;
  status: StatusAcao;
  aprovador: string | null;
  expira_em: string | null;
  consumida_em: string | null;
  criado_em: string;
  decidido_em: string | null;
};

export type Auditoria = {
  id: number;
  canal: string | null;
  remetente: string | null;
  comando: string | null;
  skill: string | null;
  ferramenta: string | null;
  resultado: string | null;
  aguardou_aprovacao: boolean | null;
  duracao_ms: number | null;
  criado_em: string;
  correlation_id: string | null;
};

/* ------------------------------------------------------------------ */
/* RPCs                                                                 */
/* ------------------------------------------------------------------ */

/** worki_aprovar_acao(p_conversa_id, p_palavra, p_aprovador, p_acao_id) */
export type ResultadoAprovar = number;

// `worki_recuperar_leases()` NAO e chamada pelo painel: ela escreve no banco
// (marca entradas como 'falhou', tarefas como 'bloqueada' e envios como
// 'incerto'). Quem recupera lease e o worker, no boot.

/**
 * Palavras de aprovacao por acao, do contrato do backend.
 * Uma palavra fora desta tabela nao autoriza nada.
 */
export const PALAVRA_POR_ACAO: Record<string, string> = {
  merge: "aprova",
  deploy_producao: "sobe",
  campanha_anuncio: "confirma",
  alterar_orcamento: "confirma",
  pausar_anuncio: "confirma",
  gasto: "confirma",
};
