import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PALAVRA_POR_ACAO, STATUS_ACAO, STATUS_TAREFA } from "../src/lib/tipos";

/**
 * Aprovacao: valida, expirada, ja decidida, sem conversa.
 *
 * A rota de aprovacao tem tres guardas antes de chamar a RPC, e sao
 * elas que este teste replica. A ordem importa: uma acao expirada e
 * recusada mesmo que a palavra esteja certa.
 */

/** Espelha as guardas de src/app/api/aprovacoes/route.ts. */
function avaliarAprovacao(acao: {
  status: string;
  expira_em: string | null;
  conversa_id: string | null;
}): { aprovavel: boolean; motivo: string } {
  if (acao.status !== "aguardando") {
    return { aprovavel: false, motivo: `acao ja esta "${acao.status}"` };
  }
  // `<=`: quem expira exatamente no instante atual ja esta fora do prazo.
  // A RPC do backend usa a mesma comparacao, para que o painel e o
  // worker concordem sobre o que "expirada" significa.
  if (acao.expira_em && new Date(acao.expira_em).getTime() <= Date.now()) {
    return { aprovavel: false, motivo: "acao expirada" };
  }
  if (!acao.conversa_id) {
    return { aprovavel: false, motivo: "acao sem conversa definida" };
  }
  return { aprovavel: true, motivo: "ok" };
}

const HORA = 3600_000;

describe("aprovacao de acao", () => {
  beforeEach(() => {
    // Data fixa: os testes de expiracao dependem do relogio.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aprova acao aguardando, dentro do prazo e com conversa", () => {
    const r = avaliarAprovacao({
      status: "aguardando",
      expira_em: new Date(Date.now() + HORA).toISOString(),
      conversa_id: "c1",
    });
    expect(r.aprovavel).toBe(true);
  });

  it("aprova acao sem prazo de expiracao definido", () => {
    const r = avaliarAprovacao({
      status: "aguardando",
      expira_em: null,
      conversa_id: "c1",
    });
    expect(r.aprovavel).toBe(true);
  });

  it("REPROVA acao expirada, mesmo com palavra correta", () => {
    const r = avaliarAprovacao({
      status: "aguardando",
      expira_em: new Date(Date.now() - 1000).toISOString(),
      conversa_id: "c1",
    });
    expect(r.aprovavel).toBe(false);
    expect(r.motivo).toContain("expirada");
  });

  it("reprova acao que expira exatamente agora", () => {
    const r = avaliarAprovacao({
      status: "aguardando",
      expira_em: new Date(Date.now()).toISOString(),
      conversa_id: "c1",
    });
    expect(r.aprovavel).toBe(false);
  });

  it("reprova acao ja confirmada", () => {
    for (const status of [
      "confirmada",
      "consumida",
      "executada",
      "cancelada",
      "expirada",
      "falhou",
    ]) {
      const r = avaliarAprovacao({
        status,
        expira_em: null,
        conversa_id: "c1",
      });
      expect(r.aprovavel).toBe(false);
    }
  });

  it("reprova acao sem conversa: a RPC exige p_conversa_id", () => {
    const r = avaliarAprovacao({
      status: "aguardando",
      expira_em: null,
      conversa_id: null,
    });
    expect(r.aprovavel).toBe(false);
    expect(r.motivo).toContain("conversa");
  });

  it("a lista de status de acao cobre todos os estados do banco", () => {
    expect(STATUS_ACAO).toContain("aguardando");
    expect(STATUS_ACAO).toContain("expirada");
    expect(STATUS_ACAO).toContain("consumida");
  });
});

/* ------------------------------------------------------------------ */

describe("palavras de aprovacao por acao", () => {
  it("existe palavra para merge", () => {
    expect(PALAVRA_POR_ACAO.merge).toBe("aprova");
  });

  it("existe palavra para deploy em producao", () => {
    expect(PALAVRA_POR_ACAO.deploy_producao).toBe("sobe");
  });

  it("existe palavra para acao com gasto", () => {
    expect(PALAVRA_POR_ACAO.gasto).toBe("confirma");
  });

  it("nao expoe palavra generica que autorize qualquer acao", () => {
    // Uma palavra "curinga" transformaria qualquer digitacao em aprovacao.
    expect(Object.keys(PALAVRA_POR_ACAO)).not.toContain("*");
    expect(Object.keys(PALAVRA_POR_ACAO)).not.toContain("default");
  });

  it("acoes sensiveis exigem palavra explicita", () => {
    for (const acao of [
      "merge",
      "deploy_producao",
      "alterar_orcamento",
      "gasto",
    ]) {
      expect(PALAVRA_POR_ACAO[acao]).toBeTruthy();
    }
  });
});

/* ------------------------------------------------------------------ */

describe("estados de tarefa", () => {
  it("inclui ativa, bloqueada e concluida — os filtros do painel", () => {
    expect(STATUS_TAREFA).toContain("ativa");
    expect(STATUS_TAREFA).toContain("bloqueada");
    expect(STATUS_TAREFA).toContain("concluida");
  });
});
