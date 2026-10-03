import {
  MOTIVO_ATALHO_ANDAMENTO,
  type Entrada,
  type Mensagem,
  type Saida,
  type StatusEntrada,
  type StatusSaida,
} from "@/lib/tipos";

/**
 * Calculos sobre a fila e as entregas do worker-agent.
 *
 * Funcoes puras: recebem linhas ja lidas do banco e o instante "agora", e
 * devolvem numeros. Nao importam o Supabase nem `server-only`, de proposito:
 * assim os testes exercitam o codigo de verdade, e nao uma copia dele.
 *
 * Nada aqui escreve em lugar nenhum.
 */

const UMA_HORA_MS = 3_600_000;
const UM_DIA_MS = 86_400_000;

/** Saida ainda nao enviada que passou disso e considerada parada. */
export const LIMITE_SAIDA_PARADA_MS = UMA_HORA_MS;
/** Entrada aguardando alem disso entra na lista de atencao. */
export const LIMITE_ENTRADA_ESPERANDO_S = 120;

/* ------------------------------------------------------------------ */
/* Tempo de resposta                                                   */
/* ------------------------------------------------------------------ */

export type TempoResposta = {
  entradaId: string;
  texto: string;
  chegouEm: string;
  statusEntrada: StatusEntrada;
  statusSaida: StatusSaida | null;
  /** Da chegada da mensagem ate o worker comecar. */
  esperaFilaS: number | null;
  /** Do inicio da execucao ate a resposta pronta. */
  hermesS: number | null;
  /** Da resposta pronta ate o WhatsApp. So existe quando `enviado_em` esta gravado. */
  envioS: number | null;
  /** O que o usuario sente: chegada ate a resposta enviada (ou pronta, se o envio nao foi registrado). */
  totalS: number | null;
  /** Respondida na hora pelo atalho de andamento: nao passa pelo Hermes. */
  atalho: boolean;
};

function segundosEntre(de: string | null | undefined, ate: string | null | undefined): number | null {
  if (!de || !ate) return null;
  const a = Date.parse(de);
  const b = Date.parse(ate);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  // Relogios de maquinas diferentes podem inverter por milissegundos.
  return Math.max(0, Math.round((b - a) / 1000));
}

export function foiAtalhoDeAndamento(e: Pick<Entrada, "status" | "ultimo_erro">): boolean {
  return e.status === "cancelada" && e.ultimo_erro === MOTIVO_ATALHO_ANDAMENTO;
}

/**
 * Junta entrada + mensagem + saida de cada pedido e calcula os tempos.
 * Ordem do resultado: da mensagem mais recente para a mais antiga.
 */
export function calcularTempos(
  entradas: Entrada[],
  mensagens: Mensagem[],
  saidas: Saida[],
): TempoResposta[] {
  const msgPorId = new Map(mensagens.map((m) => [m.id, m]));
  const saidaPorEntrada = new Map<string, Saida>();
  for (const s of saidas) {
    if (s.entrada_id) saidaPorEntrada.set(s.entrada_id, s);
  }

  const linhas: TempoResposta[] = [];
  for (const e of entradas) {
    const m = msgPorId.get(e.mensagem_id);
    if (!m) continue;
    const s = saidaPorEntrada.get(e.id) ?? null;
    const fim = s ? (s.enviado_em ?? s.criado_em) : null;

    linhas.push({
      entradaId: e.id,
      texto: m.texto,
      chegouEm: m.criado_em,
      statusEntrada: e.status,
      statusSaida: s ? s.status : null,
      esperaFilaS: segundosEntre(m.criado_em, e.execucao_iniciada_em),
      hermesS: s ? segundosEntre(e.execucao_iniciada_em, s.criado_em) : null,
      envioS: s ? segundosEntre(s.criado_em, s.enviado_em) : null,
      totalS: segundosEntre(m.criado_em, fim),
      atalho: foiAtalhoDeAndamento(e),
    });
  }

  return linhas.sort((a, b) => Date.parse(b.chegouEm) - Date.parse(a.chegouEm));
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : Math.round((v[meio - 1] + v[meio]) / 2);
}

/** Percentil pelo metodo "nearest rank": simples e sem interpolar valores que nao existem. */
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const posicao = Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1));
  return v[posicao];
}

export type ResumoTempos = {
  /** Pedidos que passaram pelo Hermes e tem tempo total conhecido. */
  amostras: number;
  medianaTotalS: number | null;
  p90TotalS: number | null;
  medianaEsperaS: number | null;
  medianaHermesS: number | null;
  /** Respostas dadas na hora pelo atalho, fora das medias acima. */
  atalhos: number;
};

/**
 * Resumo dos tempos. Respostas do atalho ficam de fora: elas nao passam pelo
 * Hermes e, sem esse corte, puxariam a mediana para baixo e esconderiam a
 * lentidao real.
 */
export function resumirTempos(tempos: TempoResposta[]): ResumoTempos {
  const medidos = tempos.filter((t) => !t.atalho && t.totalS !== null);
  const nums = (f: (t: TempoResposta) => number | null) =>
    medidos.map(f).filter((n): n is number => n !== null);

  return {
    amostras: medidos.length,
    medianaTotalS: mediana(nums((t) => t.totalS)),
    p90TotalS: percentil(nums((t) => t.totalS), 0.9),
    medianaEsperaS: mediana(nums((t) => t.esperaFilaS)),
    medianaHermesS: mediana(nums((t) => t.hermesS)),
    atalhos: tempos.filter((t) => t.atalho).length,
  };
}

/** "45 s", "3 min 20 s", "1 h 05 min". Nulo vira traco. */
export function formatarDuracao(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined) return "—";
  if (segundos < 60) return `${segundos} s`;
  if (segundos < 3600) {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return s === 0 ? `${m} min` : `${m} min ${s} s`;
  }
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/* ------------------------------------------------------------------ */
/* Saidas (entregas)                                                    */
/* ------------------------------------------------------------------ */

export type ResumoSaidas = {
  enviadas24h: number;
  /** Aguardando envio ha menos de uma hora: normal. */
  emAndamento: number;
  /** Nao enviadas ha mais de uma hora: algo ficou para tras. */
  paradas: {
    total: number;
    pendente: number;
    falhou: number;
    incerto: number;
    maisAntigaEm: string | null;
  };
};

export function resumirSaidas(saidas: Saida[], agora: Date): ResumoSaidas {
  const t = agora.getTime();
  const resumo: ResumoSaidas = {
    enviadas24h: 0,
    emAndamento: 0,
    paradas: { total: 0, pendente: 0, falhou: 0, incerto: 0, maisAntigaEm: null },
  };

  for (const s of saidas) {
    const criada = Date.parse(s.criado_em);
    if (s.status === "enviada") {
      const quando = Date.parse(s.enviado_em ?? s.criado_em);
      if (!Number.isNaN(quando) && t - quando <= UM_DIA_MS) resumo.enviadas24h += 1;
      continue;
    }
    // `enviando` e transitorio: nunca conta como parada.
    if (s.status === "enviando") {
      resumo.emAndamento += 1;
      continue;
    }
    if (Number.isNaN(criada)) continue;

    if (t - criada <= LIMITE_SAIDA_PARADA_MS) {
      resumo.emAndamento += 1;
      continue;
    }
    resumo.paradas.total += 1;
    if (s.status === "pendente") resumo.paradas.pendente += 1;
    else if (s.status === "falhou") resumo.paradas.falhou += 1;
    else if (s.status === "incerto") resumo.paradas.incerto += 1;

    const atual = resumo.paradas.maisAntigaEm;
    if (!atual || criada < Date.parse(atual)) resumo.paradas.maisAntigaEm = s.criado_em;
  }

  return resumo;
}

/* ------------------------------------------------------------------ */
/* Entradas                                                             */
/* ------------------------------------------------------------------ */

export type EntradaEsperando = {
  entradaId: string;
  conversaId: string | null;
  esperandoS: number;
  /**
   * `aguardando_anterior`: ha pedido em execucao na mesma conversa. E o
   *   comportamento normal (um pedido por vez); o atalho de andamento cobre isso.
   * `sem_execucao`: ninguem esta executando e a entrada nao anda. Pode ser
   *   travamento e merece olhar.
   */
  motivo: "aguardando_anterior" | "sem_execucao";
};

export function entradasEsperando(entradas: Entrada[], agora: Date): EntradaEsperando[] {
  const t = agora.getTime();
  const emExecucao = new Set(
    entradas.filter((e) => e.status === "processando").map((e) => e.conversa_id),
  );

  const lista: EntradaEsperando[] = [];
  for (const e of entradas) {
    if (e.status !== "aguardando") continue;
    // Ainda em recuo de retentativa: nao e espera, e agendamento.
    if (Date.parse(e.disponivel_em) > t) continue;
    const desde = Date.parse(e.criado_em);
    if (Number.isNaN(desde)) continue;
    const esperandoS = Math.round((t - desde) / 1000);
    if (esperandoS < LIMITE_ENTRADA_ESPERANDO_S) continue;

    lista.push({
      entradaId: e.id,
      conversaId: e.conversa_id,
      esperandoS,
      motivo: emExecucao.has(e.conversa_id) ? "aguardando_anterior" : "sem_execucao",
    });
  }
  return lista.sort((a, b) => b.esperandoS - a.esperandoS);
}

export function contarAtalhos(entradas: Entrada[], agora: Date): number {
  return entradas.filter(
    (e) => foiAtalhoDeAndamento(e) && agora.getTime() - Date.parse(e.criado_em) <= UM_DIA_MS,
  ).length;
}

export function contarFalhas(entradas: Entrada[], agora: Date): number {
  return entradas.filter(
    (e) => e.status === "falhou" && agora.getTime() - Date.parse(e.atualizado_em) <= UM_DIA_MS,
  ).length;
}

/* ------------------------------------------------------------------ */
/* Alertas                                                              */
/* ------------------------------------------------------------------ */

export type Alerta = { nivel: "erro" | "alerta" | "info"; texto: string };

export type DadosDosAlertas = {
  saidas: ResumoSaidas;
  esperando: EntradaEsperando[];
  falhas24h: number;
  leasesVencidas: number;
};

/** Transforma os numeros em frases para o dono, do mais grave para o menos. */
export function montarAlertas(d: DadosDosAlertas): Alerta[] {
  const alertas: Alerta[] = [];

  const semExecucao = d.esperando.filter((e) => e.motivo === "sem_execucao");
  if (semExecucao.length > 0) {
    alertas.push({
      nivel: "erro",
      texto:
        `${semExecucao.length} mensagem(ns) esperando há mais de ` +
        `${Math.round(LIMITE_ENTRADA_ESPERANDO_S / 60)} min sem nenhum pedido em execução na conversa. ` +
        `O worker pode estar parado ou a conversa travada.`,
    });
  }

  if (d.leasesVencidas > 0) {
    alertas.push({
      nivel: "erro",
      texto:
        `${d.leasesVencidas} pedido(s) em execução com a reserva vencida: o worker que os pegou ` +
        `provavelmente caiu. Reiniciar o worker recupera.`,
    });
  }

  if (d.saidas.paradas.total > 0) {
    const p = d.saidas.paradas;
    const partes = [
      p.pendente ? `${p.pendente} pendente(s)` : null,
      p.falhou ? `${p.falhou} falhada(s)` : null,
      p.incerto ? `${p.incerto} incerta(s)` : null,
    ].filter(Boolean);
    alertas.push({
      nivel: "alerta",
      texto:
        `${p.total} resposta(s) sem envio confirmado há mais de 1 h (${partes.join(", ")}). ` +
        `Muitas costumam ser legado de antes da correção do registro de envio. ` +
        `Não destrave a fila antes de encerrar essas linhas: o worker reenviaria as respostas antigas.`,
    });
  }

  if (d.falhas24h > 0) {
    alertas.push({
      nivel: "alerta",
      texto: `${d.falhas24h} pedido(s) falharam nas últimas 24 h.`,
    });
  }

  const aguardandoAnterior = d.esperando.filter((e) => e.motivo === "aguardando_anterior");
  if (aguardandoAnterior.length > 0) {
    alertas.push({
      nivel: "info",
      texto:
        `${aguardandoAnterior.length} mensagem(ns) aguardando o pedido anterior terminar. ` +
        `É normal: o worker faz um pedido por vez.`,
    });
  }

  return alertas;
}
