import "server-only";

import { supabaseServidor } from "@/lib/supabase-servidor";
import type {
  AcaoPendente,
  Auditoria,
  Conversa,
  EtapaTarefa,
  Memoria,
  Mensagem,
  RecuperarLeases,
  Saida,
  Tarefa,
} from "@/lib/tipos";

/**
 * Consultas de leitura do dashboard.
 *
 * Tres regras que nao se negociam:
 *
 *  1. `supabaseServidor()` usa service_role, que BYPASSA RLS. A
 *     seguranca esta em `auth.ts`, nao aqui. Por isso toda funcao deste
 *     arquivo presume que `exigirAcesso()` ja rodou.
 *
 *  2. Filtros vao como parametro do PostgREST (`.eq()`, `.gte()`), nunca
 *     por concatenacao de string. Isso evita injecao e, de quebra, o
 *     filtro nao vaza para o log de consulta.
 *
 *  3. Nenhuma consulta escreve. Aprovacao e consumo de aprovacao sao do
 *     worker; o dashboard so le. A unica escrita e `aprovarAcao`, que
 *     chama a RPC `worki_aprovar_acao`.
 */

export type Filtros = {
  conversaId?: string;
  projetoId?: string;
  status?: string;
  desde?: string;
  ate?: string;
  limite?: number;
};

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 500;

function limite(n: number | undefined): number {
  if (!n) return LIMITE_PADRAO;
  return Math.min(Math.max(1, Math.trunc(n)), LIMITE_MAXIMO);
}

/* ------------------------------------------------------------------ */
/* Visao geral                                                         */
/* ------------------------------------------------------------------ */

export type VisaoGeral = {
  conversas: number;
  mensagens: number;
  tarefasAtivas: number;
  tarefasBloqueadas: number;
  tarefasConcluidas: number;
  saidasPendentes: number;
  enviosIncertos: number;
  aprovacoesPendentes: number;
  leasesVencidos: {
    tarefas_bloqueadas: number;
    envios_incertos: number;
  } | null;
};

export async function visaoGeral(): Promise<VisaoGeral> {
  const sb = supabaseServidor();

  const [
    conversas,
    mensagens,
    ativas,
    bloqueadas,
    concluidas,
    saidas,
    aprovacoes,
    leases,
  ] = await Promise.all([
    sb.from("conversas").select("*", { count: "exact", head: true }),
    sb.from("mensagens").select("*", { count: "exact", head: true }),
    sb
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativa"),
    sb
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("status", "bloqueada"),
    sb
      .from("tarefas")
      .select("*", { count: "exact", head: true })
      .eq("status", "concluida"),
    sb
      .from("saidas")
      .select("*", { count: "exact", head: true })
      .in("status", ["pendente", "enviando"]),
    sb
      .from("acoes_pendentes")
      .select("*", { count: "exact", head: true })
      .eq("status", "aguardando"),
    buscarLeases(),
  ]);

  const incertos = await sb
    .from("saidas")
    .select("*", { count: "exact", head: true })
    .eq("status", "incerto");

  return {
    conversas: conversas.count ?? 0,
    mensagens: mensagens.count ?? 0,
    tarefasAtivas: ativas.count ?? 0,
    tarefasBloqueadas: bloqueadas.count ?? 0,
    tarefasConcluidas: concluidas.count ?? 0,
    saidasPendentes: saidas.count ?? 0,
    enviosIncertos: incertos.count ?? 0,
    aprovacoesPendentes: aprovacoes.count ?? 0,
    leasesVencidos: leases,
  };
}

async function buscarLeases(): Promise<RecuperarLeases | null> {
  const sb = supabaseServidor();
  const { data, error } = await sb.rpc("worki_recuperar_leases");
  if (error) return null;
  return data as RecuperarLeases;
}

/* ------------------------------------------------------------------ */
/* Conversas e mensagens                                               */
/* ------------------------------------------------------------------ */

export async function listarConversas(f: Filtros = {}): Promise<Conversa[]> {
  const sb = supabaseServidor();
  let q = sb.from("conversas").select("*");

  if (f.desde) q = q.gte("atualizado_em", f.desde);
  if (f.ate) q = q.lte("atualizado_em", f.ate);
  if (f.status) q = q.eq("instancia", f.status);

  const { data, error } = await q
    .order("atualizado_em", { ascending: false })
    .limit(limite(f.limite));

  if (error) throw new Error(`conversas: ${error.message}`);
  return (data ?? []) as Conversa[];
}

export async function mensagensRecentes(f: Filtros = {}): Promise<Mensagem[]> {
  const sb = supabaseServidor();
  let q = sb.from("mensagens").select("*");

  if (f.conversaId) q = q.eq("conversa_id", f.conversaId);
  if (f.desde) q = q.gte("criado_em", f.desde);
  if (f.ate) q = q.lte("criado_em", f.ate);

  const { data, error } = await q
    .order("criado_em", { ascending: false })
    .limit(limite(f.limite));

  if (error) throw new Error(`mensagens: ${error.message}`);
  return (data ?? []) as Mensagem[];
}

/* ------------------------------------------------------------------ */
/* Tarefas, etapas e saidas                                            */
/* ------------------------------------------------------------------ */

export async function listarTarefas(f: Filtros = {}): Promise<Tarefa[]> {
  const sb = supabaseServidor();
  let q = sb.from("tarefas").select("*");

  if (f.conversaId) q = q.eq("conversa_id", f.conversaId);
  if (f.projetoId) q = q.eq("projeto_id", f.projetoId);
  if (f.status) q = q.eq("status", f.status);
  if (f.desde) q = q.gte("criado_em", f.desde);
  if (f.ate) q = q.lte("criado_em", f.ate);

  const { data, error } = await q
    .order("atualizado_em", { ascending: false })
    .limit(limite(f.limite));

  if (error) throw new Error(`tarefas: ${error.message}`);
  return (data ?? []) as Tarefa[];
}

export async function etapasDe(tarefaId: string): Promise<EtapaTarefa[]> {
  const sb = supabaseServidor();
  const { data, error } = await sb
    .from("etapas_tarefa")
    .select("*")
    .eq("tarefa_id", tarefaId)
    .order("criado_em", { ascending: true });

  if (error) throw new Error(`etapas_tarefa: ${error.message}`);
  return (data ?? []) as EtapaTarefa[];
}

export async function listarSaidas(f: Filtros = {}): Promise<Saida[]> {
  const sb = supabaseServidor();
  let q = sb.from("saidas").select("*");

  if (f.conversaId) q = q.eq("conversa_id", f.conversaId);
  if (f.status) q = q.eq("status", f.status);
  if (f.desde) q = q.gte("criado_em", f.desde);
  if (f.ate) q = q.lte("criado_em", f.ate);

  const { data, error } = await q
    .order("criado_em", { ascending: false })
    .limit(limite(f.limite));

  if (error) throw new Error(`saidas: ${error.message}`);
  return (data ?? []) as Saida[];
}

/* ------------------------------------------------------------------ */
/* Memoria — isolada por proprietario e projeto                        */
/* ------------------------------------------------------------------ */

/**
 * Memoria e filtrada por `proprietario_id` E `projeto_id` ao mesmo tempo.
 *
 * O contrato do backend diz: "Nao incluir memorias de outro projeto". O
 * `projeto_id` nulo significa memoria global do proprietario, e entra
 * junto — nao e falha de filtro, e proposito.
 *
 * Busca por `proprietario_id` sem `projeto_id` devolveria memoria de
 * todos os projetos daquele dono: vazamento silencioso, do tipo que so
 * aparece quando alguem percebe que viu algo que nao devia.
 */
export async function listarMemorias(
  f: Filtros & { proprietarioId: string },
): Promise<Memoria[]> {
  const sb = supabaseServidor();
  let q = sb
    .from("memorias")
    .select("*")
    .eq("proprietario_id", f.proprietarioId);

  if (f.projetoId) {
    // `.or()` com `is.null` inclui as memoria globais do proprietario.
    q = q.or(`projeto_id.eq.${f.projetoId},projeto_id.is.null`);
  }
  if (f.status) q = q.eq("status", f.status);

  const { data, error } = await q
    .order("criado_em", { ascending: false })
    .limit(limite(f.limite));

  if (error) throw new Error(`memorias: ${error.message}`);
  return (data ?? []) as Memoria[];
}

/* ------------------------------------------------------------------ */
/* Aprovacoes e auditoria                                              */
/* ------------------------------------------------------------------ */

export async function listarAprovacoes(
  f: Filtros = {},
): Promise<AcaoPendente[]> {
  const sb = supabaseServidor();
  let q = sb.from("acoes_pendentes").select("*");

  if (f.conversaId) q = q.eq("conversa_id", f.conversaId);
  if (f.status) q = q.eq("status", f.status);
  else q = q.in("status", ["aguardando", "confirmada"]);

  const { data, error } = await q
    .order("criado_em", { ascending: false })
    .limit(limite(f.limite));

  if (error) throw new Error(`acoes_pendentes: ${error.message}`);
  return (data ?? []) as AcaoPendente[];
}

/**
 * Aprova uma acao pendente pela RPC `worki_aprovar_acao`.
 *
 * Unica escrita do dashboard. O consumo continua sendo do worker: aprovar
 * aqui nao executa nada, so registra a autorizacao.
 *
 * `p_acao_id` e explicito de proposito — o contrato exige ID quando ha
 * mais de uma pendencia na mesma conversa, e o backend recusa palavra
 * solta nesse caso.
 */
export async function aprovarAcao(params: {
  conversaId: string;
  palavra: string;
  aprovador: string;
  acaoId?: number;
}): Promise<{ ok: true; acaoId: number } | { ok: false; erro: string }> {
  const sb = supabaseServidor();

  const { data, error } = await sb.rpc("worki_aprovar_acao", {
    p_conversa_id: params.conversaId,
    p_palavra: params.palavra,
    p_aprovador: params.aprovador,
    p_acao_id: params.acaoId ?? null,
  });

  if (error) {
    return { ok: false, erro: error.message };
  }
  return { ok: true, acaoId: Number(data) };
}

export async function listarAuditoria(f: Filtros = {}): Promise<Auditoria[]> {
  const sb = supabaseServidor();
  let q = sb.from("auditoria").select("*");

  if (f.status) q = q.eq("resultado", f.status);
  if (f.desde) q = q.gte("criado_em", f.desde);
  if (f.ate) q = q.lte("criado_em", f.ate);

  const { data, error } = await q
    .order("criado_em", { ascending: false })
    .limit(limite(f.limite));

  if (error) throw new Error(`auditoria: ${error.message}`);
  return (data ?? []) as Auditoria[];
}
