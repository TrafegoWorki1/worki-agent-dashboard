import { describe, expect, it } from "vitest";

import {
  calcularTempos,
  contarAtalhos,
  contarFalhas,
  entradasEsperando,
  formatarDuracao,
  montarAlertas,
  percentil,
  resumirSaidas,
  resumirTempos,
} from "../src/lib/fila";
import {
  MOTIVO_ATALHO_ANDAMENTO,
  type Entrada,
  type Mensagem,
  type Saida,
} from "../src/lib/tipos";

const AGORA = new Date("2026-10-03T20:00:00Z");
const iso = (minAtras: number, seg = 0) =>
  new Date(AGORA.getTime() - minAtras * 60_000 - seg * 1000).toISOString();

function entrada(p: Partial<Entrada> & { id: string }): Entrada {
  return {
    mensagem_id: `m-${p.id}`,
    status: "aguardando",
    tentativas: 0,
    disponivel_em: iso(60),
    lease_owner: null,
    lease_expires_at: null,
    ultimo_erro: null,
    criado_em: iso(10),
    atualizado_em: iso(10),
    conversa_id: "c1",
    ordem: 1,
    execucao_iniciada_em: null,
    ...p,
  };
}

function mensagem(id: string, criado_em: string, texto = "oi"): Mensagem {
  return {
    id,
    instancia: "agent-domintante",
    provider_message_id: id,
    de: "558592494552@s.whatsapp.net",
    grupo_jid: null,
    tipo_mensagem: "conversation",
    texto,
    criado_em,
    conversa_id: "c1",
    chat_jid: "x@s.whatsapp.net",
  };
}

function saida(p: Partial<Saida> & { id: string }): Saida {
  return {
    entrada_id: null,
    conversa_id: "c1",
    chat_jid: "x@s.whatsapp.net",
    texto: "resposta",
    status: "pendente",
    idempotency_key: null,
    provider_message_id: null,
    tentativas: 0,
    ultimo_erro: null,
    criado_em: iso(10),
    enviado_em: null,
    disponivel_em: null,
    lease_owner: null,
    lease_expires_at: null,
    ...p,
  };
}

describe("calcularTempos", () => {
  it("separa espera na fila, tempo do Hermes, envio e total", () => {
    const chegou = "2026-10-03T16:44:09Z";
    const e = entrada({
      id: "e1",
      status: "concluida",
      execucao_iniciada_em: "2026-10-03T16:44:33Z", // +24 s
    });
    const s = saida({
      id: "s1",
      entrada_id: "e1",
      status: "enviada",
      criado_em: "2026-10-03T16:47:22Z", // +169 s de Hermes
      enviado_em: "2026-10-03T16:47:24Z", // +2 s de envio
    });
    const [t] = calcularTempos([e], [mensagem("m-e1", chegou)], [s]);

    expect(t.esperaFilaS).toBe(24);
    expect(t.hermesS).toBe(169);
    expect(t.envioS).toBe(2);
    expect(t.totalS).toBe(195);
    expect(t.atalho).toBe(false);
  });

  it("sem enviado_em (registro de envio antigo), o total usa a resposta pronta e o envio fica vazio", () => {
    const e = entrada({ id: "e1", status: "concluida", execucao_iniciada_em: iso(9, 30) });
    const s = saida({ id: "s1", entrada_id: "e1", status: "pendente", criado_em: iso(9) });
    const [t] = calcularTempos([e], [mensagem("m-e1", iso(10))], [s]);

    expect(t.envioS).toBeNull();
    expect(t.totalS).toBe(60);
  });

  it("mensagem ainda sem resposta tem total nulo", () => {
    const e = entrada({ id: "e1", status: "processando", execucao_iniciada_em: iso(1) });
    const [t] = calcularTempos([e], [mensagem("m-e1", iso(2))], []);
    expect(t.hermesS).toBeNull();
    expect(t.totalS).toBeNull();
    expect(t.esperaFilaS).toBe(60);
  });

  it("marca como atalho a entrada cancelada pelo atalho de andamento", () => {
    const e = entrada({ id: "e1", status: "cancelada", ultimo_erro: MOTIVO_ATALHO_ANDAMENTO });
    const [t] = calcularTempos([e], [mensagem("m-e1", iso(1))], []);
    expect(t.atalho).toBe(true);
  });

  it("cancelada por outro motivo nao e atalho", () => {
    const e = entrada({ id: "e1", status: "cancelada", ultimo_erro: "parando" });
    const [t] = calcularTempos([e], [mensagem("m-e1", iso(1))], []);
    expect(t.atalho).toBe(false);
  });

  it("ignora entrada sem mensagem e ordena da mais recente para a mais antiga", () => {
    const a = entrada({ id: "a" });
    const b = entrada({ id: "b" });
    const orfa = entrada({ id: "orfa", mensagem_id: "nao-existe" });
    const r = calcularTempos(
      [a, b, orfa],
      [mensagem("m-a", iso(10)), mensagem("m-b", iso(5))],
      [],
    );
    expect(r.map((t) => t.entradaId)).toEqual(["b", "a"]);
  });

  it("relogio invertido por milissegundos nao gera tempo negativo", () => {
    const e = entrada({ id: "e1", execucao_iniciada_em: "2026-10-03T10:00:00Z" });
    const [t] = calcularTempos([e], [mensagem("m-e1", "2026-10-03T10:00:01Z")], []);
    expect(t.esperaFilaS).toBe(0);
  });
});

describe("resumirTempos", () => {
  const base = { entradaId: "x", texto: "", chegouEm: iso(1), statusEntrada: "concluida" as const, statusSaida: null, envioS: null, atalho: false };

  it("calcula mediana e p90", () => {
    const tempos = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n, i) => ({
      ...base, entradaId: String(i), esperaFilaS: 5, hermesS: n - 5, totalS: n,
    }));
    const r = resumirTempos(tempos);
    expect(r.amostras).toBe(10);
    expect(r.medianaTotalS).toBe(55);
    expect(r.p90TotalS).toBe(90);
    expect(r.medianaEsperaS).toBe(5);
  });

  it("deixa o atalho fora: ele nao passa pelo Hermes e esconderia a lentidao", () => {
    const lentos = [100, 100, 100].map((n, i) => ({ ...base, entradaId: `l${i}`, esperaFilaS: 5, hermesS: 95, totalS: n }));
    const rapidos = [1, 1, 1, 1, 1, 1].map((n, i) => ({ ...base, entradaId: `a${i}`, esperaFilaS: 0, hermesS: null, totalS: n, atalho: true }));
    const r = resumirTempos([...lentos, ...rapidos]);
    expect(r.medianaTotalS).toBe(100);
    expect(r.atalhos).toBe(6);
  });

  it("sem dados, tudo nulo", () => {
    const r = resumirTempos([]);
    expect(r).toMatchObject({ amostras: 0, medianaTotalS: null, p90TotalS: null });
  });
});

describe("percentil", () => {
  it("nearest rank", () => {
    expect(percentil([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentil([1, 2, 3, 4, 5], 0.9)).toBe(5);
    expect(percentil([7], 0.9)).toBe(7);
    expect(percentil([], 0.9)).toBeNull();
  });
});

describe("formatarDuracao", () => {
  it("formata", () => {
    expect(formatarDuracao(null)).toBe("—");
    expect(formatarDuracao(45)).toBe("45 s");
    expect(formatarDuracao(60)).toBe("1 min");
    expect(formatarDuracao(200)).toBe("3 min 20 s");
    expect(formatarDuracao(3900)).toBe("1 h 05 min");
  });
});

describe("resumirSaidas", () => {
  it("resposta encerrada a mao (enviada sem enviado_em) nao conta como enviada", () => {
    const r = resumirSaidas(
      [
        saida({ id: "1", status: "enviada", enviado_em: iso(5) }),
        saida({ id: "2", status: "enviada", enviado_em: null, criado_em: iso(60 * 3) }),
      ],
      AGORA,
    );
    expect(r.enviadas24h).toBe(1);
    expect(r.paradas.total).toBe(0);
  });

  it("conta enviadas das ultimas 24 h e separa as paradas das recentes", () => {
    const r = resumirSaidas(
      [
        saida({ id: "1", status: "enviada", enviado_em: iso(5) }),
        saida({ id: "2", status: "enviada", enviado_em: iso(60 * 30) }), // 30 h: fora
        saida({ id: "3", status: "pendente", criado_em: iso(10) }), // recente
        saida({ id: "4", status: "pendente", criado_em: iso(60 * 5) }), // parada
        saida({ id: "5", status: "falhou", criado_em: iso(60 * 6) }),
        saida({ id: "6", status: "incerto", criado_em: iso(60 * 7) }),
        saida({ id: "7", status: "enviando", criado_em: iso(60 * 9) }), // transitorio
      ],
      AGORA,
    );
    expect(r.enviadas24h).toBe(1);
    expect(r.emAndamento).toBe(2); // a recente e a 'enviando'
    expect(r.paradas).toMatchObject({ total: 3, pendente: 1, falhou: 1, incerto: 1 });
    expect(r.paradas.maisAntigaEm).toBe(iso(60 * 7));
  });

  it("o cenario real de producao de 2026-10-03: 19 pendentes + 18 falhadas + 1 incerta, nenhuma enviada", () => {
    const linhas = [
      ...Array.from({ length: 19 }, (_, i) => saida({ id: `p${i}`, status: "pendente", criado_em: iso(120 + i) })),
      ...Array.from({ length: 18 }, (_, i) => saida({ id: `f${i}`, status: "falhou", criado_em: iso(300 + i) })),
      saida({ id: "i", status: "incerto", tentativas: 2, criado_em: iso(400) }),
    ];
    const r = resumirSaidas(linhas, AGORA);
    expect(r.enviadas24h).toBe(0);
    expect(r.paradas).toMatchObject({ total: 38, pendente: 19, falhou: 18, incerto: 1 });
  });
});

describe("entradasEsperando", () => {
  it("separa 'aguardando o pedido anterior' (normal) de 'sem execucao' (travamento)", () => {
    const lista = entradasEsperando(
      [
        entrada({ id: "rodando", status: "processando", conversa_id: "c1" }),
        entrada({ id: "espera-normal", status: "aguardando", conversa_id: "c1", criado_em: iso(5) }),
        entrada({ id: "travada", status: "aguardando", conversa_id: "c2", criado_em: iso(13) }),
      ],
      AGORA,
    );
    const porId = Object.fromEntries(lista.map((e) => [e.entradaId, e.motivo]));
    expect(porId["espera-normal"]).toBe("aguardando_anterior");
    expect(porId["travada"]).toBe("sem_execucao");
    expect(lista[0].entradaId).toBe("travada"); // a mais antiga primeiro
  });

  it("espera curta, retentativa agendada e outros estados nao entram", () => {
    const lista = entradasEsperando(
      [
        entrada({ id: "curta", criado_em: iso(0, 30) }),
        entrada({ id: "agendada", criado_em: iso(10), disponivel_em: new Date(AGORA.getTime() + 60_000).toISOString() }),
        entrada({ id: "concluida", status: "concluida", criado_em: iso(10) }),
      ],
      AGORA,
    );
    expect(lista).toEqual([]);
  });
});

describe("contarAtalhos e contarFalhas", () => {
  it("so conta as ultimas 24 h e so o motivo do atalho", () => {
    const es = [
      entrada({ id: "1", status: "cancelada", ultimo_erro: MOTIVO_ATALHO_ANDAMENTO, criado_em: iso(30) }),
      entrada({ id: "2", status: "cancelada", ultimo_erro: MOTIVO_ATALHO_ANDAMENTO, criado_em: iso(60 * 30) }),
      entrada({ id: "3", status: "cancelada", ultimo_erro: "parando", criado_em: iso(30) }),
      entrada({ id: "4", status: "falhou", atualizado_em: iso(30) }),
      entrada({ id: "5", status: "falhou", atualizado_em: iso(60 * 30) }),
    ];
    expect(contarAtalhos(es, AGORA)).toBe(1);
    expect(contarFalhas(es, AGORA)).toBe(1);
  });
});

describe("montarAlertas", () => {
  const vazio = {
    saidas: resumirSaidas([], AGORA),
    esperando: [],
    falhas24h: 0,
    leasesVencidas: 0,
  };

  it("sem problemas, sem alertas", () => {
    expect(montarAlertas(vazio)).toEqual([]);
  });

  it("avisa para NAO destravar a fila antes de encerrar as saidas antigas", () => {
    const saidas = resumirSaidas(
      [saida({ id: "a", status: "pendente", criado_em: iso(600) })],
      AGORA,
    );
    const a = montarAlertas({ ...vazio, saidas });
    expect(a).toHaveLength(1);
    expect(a[0].nivel).toBe("alerta");
    expect(a[0].texto).toMatch(/reenviaria as respostas antigas/);
  });

  it("travamento e reserva vencida sao graves e vem primeiro", () => {
    const a = montarAlertas({
      ...vazio,
      falhas24h: 2,
      leasesVencidas: 1,
      esperando: [{ entradaId: "x", conversaId: "c", esperandoS: 800, motivo: "sem_execucao" }],
    });
    expect(a.map((x) => x.nivel)).toEqual(["erro", "erro", "alerta"]);
  });

  it("espera atras de pedido em andamento e so informativa", () => {
    const a = montarAlertas({
      ...vazio,
      esperando: [{ entradaId: "x", conversaId: "c", esperandoS: 300, motivo: "aguardando_anterior" }],
    });
    expect(a).toEqual([{ nivel: "info", texto: expect.stringContaining("É normal") }]);
  });
});
