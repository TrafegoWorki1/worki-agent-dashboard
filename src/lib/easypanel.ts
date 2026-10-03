import "server-only";

import { servidor } from "@/lib/env";
import {
  extrairCommit,
  extrairParametros,
  type CommitImplantado,
  type ParametroServico,
} from "@/lib/servico-parse";

/**
 * Leitura do EasyPanel. SOMENTE LEITURA.
 *
 * Este modulo nao tem nenhuma procedure de mutacao. Reiniciar, parar ou
 * fazer deploy sao acoes destrutivas no EasyPanel e nao fazem parte do
 * escopo do dashboard — se um dia forem necessarias, viram Server
 * Actions com confirmacao explicita e registro de auditoria, nao uma
 * chamada silenciosa daqui.
 *
 * O token nunca sai do servidor: `servidor()` le de `process.env`, e o
 * header e montado dentro desta funcao. Nada disso volta para o cliente.
 */

const PROJETO = "n8n";
const SERVICO = "worki-agent";
const TIMEOUT_MS = 8000;

export type StatusEasyPanel = {
  online: boolean;
  habilitado: boolean | null;
  branch: string | null;
  repositorio: string | null;
  dominio: string | null;
  porta: number | null;
  cpu: number | null;
  memoriaMb: number | null;
  /** Commit que o container esta rodando: mostra qual fase do worker-agent esta no ar. */
  commit: CommitImplantado | null;
  /** So parametros de comportamento do worker, de uma lista fechada. Nunca segredos. */
  parametros: ParametroServico[];
  erro?: string;
};

export type LogEasyPanel = {
  linhas: string[];
  erro?: string;
};

function mascararToken(token: string): string {
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}***${token.slice(-2)}`;
}

/** Integracao desativada? As telas mostram o motivo em vez de quebrar. */
export function easypanelDesativado(): string | null {
  const cfg = servidor();
  if (!cfg.easypanelUrl && !cfg.easypanelApiToken) {
    return "Integracao com o EasyPanel nao configurada neste ambiente.";
  }
  if (!cfg.easypanelUrl) return "EASYPANEL_URL nao configurada.";
  if (!cfg.easypanelApiToken) return "EASYPANEL_API_TOKEN nao configurada.";
  return null;
}

async function chamarMcp(
  ferramenta: "execute_query",
  procedure: string,
  entrada: Record<string, unknown>,
): Promise<{ texto: string | null; erro?: string }> {
  const desativado = easypanelDesativado();
  if (desativado) return { texto: null, erro: desativado };

  const cfg = servidor();

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(`${cfg.easypanelUrl}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${cfg.easypanelApiToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: ferramenta,
          arguments: { procedure, input: entrada },
        },
      }),
      signal: controlador.signal,
      cache: "no-store",
    });

    if (!resposta.ok) {
      return { texto: null, erro: `EasyPanel respondeu ${resposta.status}` };
    }

    const corpo = (await resposta.json()) as {
      result?: { content?: Array<{ text?: string }> };
    };
    const texto = corpo.result?.content?.[0]?.text ?? null;
    return { texto };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return {
      texto: null,
      erro: `EasyPanel inacessivel: ${mascaraPorMotivo(mensagem)}`,
    };
  } finally {
    clearTimeout(temporizador);
  }
}

/** Nao devolve a URL completa: ela pode conter identificadores internos. */
function mascaraPorMotivo(mensagem: string): string {
  return mensagem.replace(/https?:\/\/\S+/g, "<url-redigida>").slice(0, 160);
}

export async function statusServico(): Promise<StatusEasyPanel> {
  const { texto, erro } = await chamarMcp(
    "execute_query",
    "inspectAppService",
    {
      projectName: PROJETO,
      serviceName: SERVICO,
    },
  );

  if (!texto) {
    return {
      online: false,
      habilitado: null,
      branch: null,
      repositorio: null,
      dominio: null,
      porta: null,
      cpu: null,
      memoriaMb: null,
      commit: null,
      parametros: [],
      erro: erro ?? "resposta vazia do EasyPanel",
    };
  }

  // O MCP devolve JSON em string; e o status vem como campo solto.
  const habilitado = /"enabled":\s*true/.test(texto);
  const branch = texto.match(/"ref":\s*"([^"]+)"/)?.[1] ?? null;
  const repositorio = texto.match(/"repo":\s*"([^"]+)"/)?.[1] ?? null;
  const cpu = Number(texto.match(/"cpuLimit":\s*([\d.]+)/)?.[1] ?? 0) || null;
  const memoria =
    Number(texto.match(/"memoryLimit":\s*([\d.]+)/)?.[1] ?? 0) || null;

  const { texto: dominioTexto } = await chamarMcp(
    "execute_query",
    "getPrimaryDomain",
    {
      projectName: PROJETO,
      serviceName: SERVICO,
    },
  );
  const host = dominioTexto?.match(/"host":\s*"([^"]+)"/)?.[1] ?? null;
  const porta = dominioTexto
    ? Number(dominioTexto.match(/"port":\s*(\d+)/)?.[1] ?? 0) || null
    : null;

  return {
    online: habilitado,
    habilitado,
    branch,
    repositorio,
    dominio: host,
    porta,
    cpu,
    memoriaMb: memoria,
    // `texto` traz o env completo do servico. Estas duas funcoes devolvem so
    // o commit e uma lista fechada de parametros; o texto bruto morre aqui.
    commit: extrairCommit(texto),
    parametros: extrairParametros(texto),
  };
}

/**
 * Le o endpoint publico de health do servico.
 *
 * E o unico jeito de saber se o container responde de verdade: o painel
 * dizer `enabled: true` nao prova que o processo subiu.
 */
export async function healthDoServico(base?: string): Promise<{
  ok: boolean;
  latenciaMs: number | null;
  corpo: unknown;
  erro?: string;
}> {
  const { texto } = await chamarMcp("execute_query", "getPrimaryDomain", {
    projectName: PROJETO,
    serviceName: SERVICO,
  });

  const host = texto?.match(/"host":\s*"([^"]+)"/)?.[1];
  const alvo = base ?? (host ? `https://${host}` : null);

  if (!alvo) {
    return {
      ok: false,
      latenciaMs: null,
      corpo: null,
      erro: "dominio do servico nao encontrado",
    };
  }

  const inicio = Date.now();
  try {
    const resposta = await fetch(`${alvo}/health`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const latenciaMs = Date.now() - inicio;
    const corpo = await resposta.json().catch(() => null);
    return { ok: resposta.ok, latenciaMs, corpo };
  } catch (erro) {
    return {
      ok: false,
      latenciaMs: null,
      corpo: null,
      erro: mascaraPorMotivo(
        erro instanceof Error ? erro.message : String(erro),
      ),
    };
  }
}

export type DependenciasDoServico = {
  /** O servico respondeu ao /ready (mesmo com 503). */
  alcancou: boolean;
  /** 200 = pronto; 503 = alguma dependencia fora. */
  pronto: boolean;
  supabase: boolean | null;
  worker: boolean | null;
  evolution: boolean | null;
  latenciaMs: number | null;
  erro?: string;
};

/**
 * Le o /ready do worker-agent: diz se o banco e o worker estao de pe.
 *
 * O /health so prova que o processo responde. O /ready e o que o EasyPanel
 * usa para decidir se manda trafego, e e onde aparece "worker parado" ou
 * "Supabase fora". Um 503 aqui nao e erro de leitura: e a resposta.
 *
 * So os tres indicadores booleanos sao repassados. O corpo traz tambem
 * mensagens de erro de infraestrutura (`erro_supabase`), que podem conter
 * detalhes internos e por isso nao saem do servidor.
 */
export async function prontidaoDoServico(base?: string): Promise<DependenciasDoServico> {
  const { texto } = await chamarMcp("execute_query", "getPrimaryDomain", {
    projectName: PROJETO,
    serviceName: SERVICO,
  });
  const host = texto?.match(/"host":\s*"([^"]+)"/)?.[1];
  const alvo = base ?? (host ? `https://${host}` : null);

  const vazio: DependenciasDoServico = {
    alcancou: false,
    pronto: false,
    supabase: null,
    worker: null,
    evolution: null,
    latenciaMs: null,
  };
  if (!alvo) return { ...vazio, erro: "dominio do servico nao encontrado" };

  const inicio = Date.now();
  try {
    const resposta = await fetch(`${alvo}/ready`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const latenciaMs = Date.now() - inicio;
    const corpo = (await resposta.json().catch(() => null)) as {
      dependencias?: Record<string, unknown>;
    } | null;
    const dep = corpo?.dependencias ?? {};
    const booleano = (v: unknown) => (typeof v === "boolean" ? v : null);

    return {
      alcancou: true,
      pronto: resposta.ok,
      supabase: booleano(dep.supabase),
      worker: booleano(dep.worker),
      evolution: booleano(dep.evolution),
      latenciaMs,
    };
  } catch (erro) {
    return {
      ...vazio,
      erro: mascaraPorMotivo(erro instanceof Error ? erro.message : String(erro)),
    };
  }
}

export async function logsResumidos(quantidade = 30): Promise<LogEasyPanel> {
  const { texto, erro } = await chamarMcp("execute_query", "queryServiceLogs", {
    projectName: PROJETO,
    serviceName: SERVICO,
    limit: quantidade,
  });

  if (!texto) {
    return { linhas: [], erro: erro ?? "logs indisponiveis" };
  }

  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-quantidade);

  return { linhas };
}

/** Identifica qual service role esta em uso, sem revelar o valor. */
export function descricaoDoToken(): string {
  const cfg = servidor();
  if (!cfg.easypanelApiToken) return "token nao configurado";
  return `token ${mascararToken(cfg.easypanelApiToken)}`;
}
