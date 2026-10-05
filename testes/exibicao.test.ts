import { describe, expect, it } from "vitest";

import {
  conversaDireta,
  formatarTelefone,
  montarLinhaDoTempo,
  rotuloProprietario,
  tarefasComStatusDesconhecido,
} from "../src/lib/exibicao";
import type { Mensagem, Saida, Tarefa } from "../src/lib/tipos";

function msg(id: string, criado_em: string, texto = "oi"): Mensagem {
  return {
    id, instancia: "i", provider_message_id: id, de: "5585", grupo_jid: null,
    tipo_mensagem: "conversation", texto, criado_em, conversa_id: "c", chat_jid: "x",
  };
}
function saida(id: string, criado_em: string, extra: Partial<Saida> = {}): Saida {
  return {
    id, entrada_id: null, conversa_id: "c", chat_jid: "x", texto: "resposta",
    status: "enviada", idempotency_key: null, provider_message_id: null, tentativas: 1,
    ultimo_erro: null, criado_em, enviado_em: null, disponivel_em: null,
    lease_owner: null, lease_expires_at: null, ...extra,
  };
}
function tarefa(status: string): Tarefa {
  return {
    id: status, conversa_id: "c", entrada_id: null, projeto_id: null, objetivo: "x",
    status: status as Tarefa["status"], etapa_atual: null, proxima_acao: null,
    checkpoint: null, resultado: null, criado_em: "2026-10-03T10:00:00Z", atualizado_em: "2026-10-03T10:00:00Z",
  };
}

describe("montarLinhaDoTempo", () => {
  it("mostra os DOIS lados, da mais recente para a mais antiga", () => {
    const linha = montarLinhaDoTempo(
      [msg("1", "2026-10-03T10:00:00Z", "oi"), msg("2", "2026-10-03T10:02:00Z", "e ai?")],
      [saida("a", "2026-10-03T10:00:30Z", { texto: "tô aqui" })],
    );
    expect(linha.map((i) => [i.lado, i.texto])).toEqual([
      ["entrada", "e ai?"],
      ["saida", "tô aqui"],
      ["entrada", "oi"],
    ]);
  });

  it("a resposta usa o horario de envio quando existe, senao o de criacao", () => {
    const linha = montarLinhaDoTempo(
      [],
      [
        saida("a", "2026-10-03T10:00:00Z", { enviado_em: "2026-10-03T10:00:05Z" }),
        saida("b", "2026-10-03T10:01:00Z", { enviado_em: null, status: "pendente" }),
      ],
    );
    expect(linha.map((i) => i.quando)).toEqual(["2026-10-03T10:01:00Z", "2026-10-03T10:00:05Z"]);
    expect(linha[0].statusEnvio).toBe("pendente");
  });

  it("vazio devolve vazio", () => {
    expect(montarLinhaDoTempo([], [])).toEqual([]);
  });
});

describe("rotuloProprietario", () => {
  it("numero de WhatsApp vira telefone legivel, nao a chave de uma memoria", () => {
    expect(rotuloProprietario("558592494552")).toBe("+55 85 9249-4552");
    expect(rotuloProprietario("5585992494552")).toBe("+55 85 99249-4552");
  });
  it("id que nao e numero fica encurtado", () => {
    expect(rotuloProprietario("herickson")).toBe("herickson");
    // Mantem os ultimos 12 caracteres, precedidos de reticencias.
    expect(rotuloProprietario("um-identificador-bem-longo-123456")).toBe("…longo-123456");
  });
  it("formatarTelefone devolve o texto original quando nao reconhece", () => {
    expect(formatarTelefone("123")).toBe("123");
  });
});

describe("tarefasComStatusDesconhecido", () => {
  it("lista vazia NAO e alerta (o bug: [].some() === false e verdadeiro)", () => {
    expect(tarefasComStatusDesconhecido([])).toEqual([]);
  });
  it("status conhecidos nao sao desconhecidos", () => {
    expect(tarefasComStatusDesconhecido([tarefa("ativa"), tarefa("concluida")])).toEqual([]);
  });
  it("acha o que o painel nao conhece", () => {
    const r = tarefasComStatusDesconhecido([tarefa("ativa"), tarefa("pausada")]);
    expect(r.map((t) => t.status)).toEqual(["pausada"]);
  });
});

describe("conversaDireta", () => {
  it("participante igual ao chat, ou ausente, e conversa direta", () => {
    expect(conversaDireta("5585@s.whatsapp.net", "5585@s.whatsapp.net")).toBe(true);
    expect(conversaDireta("5585@s.whatsapp.net", null)).toBe(true);
  });
  it("grupo tem participante diferente do chat", () => {
    expect(conversaDireta("1203@g.us", "5585@s.whatsapp.net")).toBe(false);
  });
});
