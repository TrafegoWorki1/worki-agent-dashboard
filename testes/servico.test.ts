import { describe, expect, it } from "vitest";

import {
  PARAMETROS,
  extrairCommit,
  extrairParametros,
  valorEmVigor,
} from "../src/lib/servico-parse";

/**
 * O inspectAppService do EasyPanel devolve o env COMPLETO do servico. Estes
 * testes usam valores falsos com cara de segredo e provam que nada disso sai.
 */
const SEGREDOS = [
  "SEGREDO-SUPABASE-eyJhbGciOiJIUzI1NiIs",
  "SEGREDO-EVOLUTION-b9110a3bb5aa9fdb",
  "whsec_SEGREDO_DO_WEBHOOK_123456",
  "SEGREDO-META-EAA8VGzZAxyqABRG",
];

const ENV =
  "EVOLUTION_API_KEY=SEGREDO-EVOLUTION-b9110a3bb5aa9fdb\n" +
  "SUPABASE_SERVICE_ROLE_KEY=SEGREDO-SUPABASE-eyJhbGciOiJIUzI1NiIs\n" +
  "WORKI_WEBHOOK_SECRET=whsec_SEGREDO_DO_WEBHOOK_123456\n" +
  "META_ADS_TOKEN=SEGREDO-META-EAA8VGzZAxyqABRG\n" +
  "WORKI_RECOVERY_POLL_SECONDS=3\r\n" +
  "WORKI_TASK_TIMEOUT_SECONDS=1500\n" +
  "WORKI_WORKER_LEASE_S=90\n" +
  "WORKI_DRY_RUN=0";

const COMMIT = {
  author: "WorkiDigital <x@y.com>",
  date: "Sat Oct 3 16:22:28 2026 -0300",
  hash: "7cd20e77e07949bf508c9064e6b636742b5c37c0",
  message: "merge: liga o Hermes completo\n\ncorpo longo da mensagem",
};

const RESPOSTA = { enabled: true, env: ENV, commit: COMMIT };
const EMBRULHADA = JSON.stringify({ procedure: "inspectAppService", result: RESPOSTA });
const SOLTA = JSON.stringify(RESPOSTA);

describe("extrairCommit", () => {
  it.each([["embrulhada em result", EMBRULHADA], ["objeto solto", SOLTA]])(
    "le o commit (%s)",
    (_n, texto) => {
      const c = extrairCommit(texto);
      expect(c?.hashCurto).toBe("7cd20e7");
      expect(c?.hash).toBe(COMMIT.hash);
      expect(c?.mensagem).toBe("merge: liga o Hermes completo"); // so a primeira linha
      expect(c?.data).toContain("2026");
    },
  );

  it("cai para a leitura por padrao quando o texto nao e JSON valido", () => {
    const quebrado = `{"commit":{"hash":"4bac560abcdef1","message":"merge: receptor responde` + ` imediatamente"} CORTADO`;
    const c = extrairCommit(quebrado);
    expect(c?.hashCurto).toBe("4bac560");
  });

  it("sem commit, devolve nulo", () => {
    expect(extrairCommit(JSON.stringify({ enabled: true }))).toBeNull();
    expect(extrairCommit("")).toBeNull();
  });

  it("recusa hash que nao parece hash", () => {
    expect(extrairCommit(JSON.stringify({ commit: { hash: "isto nao e hash" } }))).toBeNull();
  });
});

describe("extrairParametros", () => {
  const dados = (t: string) => extrairParametros(t);
  const porChave = (t: string) => Object.fromEntries(dados(t).map((p) => [p.chave, p]));

  it.each([["embrulhada", EMBRULHADA], ["solta", SOLTA]])("le os valores configurados (%s)", (_n, texto) => {
    const p = porChave(texto);
    expect(p.WORKI_RECOVERY_POLL_SECONDS.valor).toBe("3");
    expect(p.WORKI_TASK_TIMEOUT_SECONDS.valor).toBe("1500");
    expect(p.WORKI_WORKER_LEASE_S.valor).toBe("90");
    expect(p.WORKI_DRY_RUN.valor).toBe("0");
  });

  it("variavel ausente vira nulo e o valor em vigor e o padrao do codigo", () => {
    const p = porChave(EMBRULHADA);
    expect(p.WORKI_WHATSAPP_MAX_CHARS.valor).toBeNull();
    expect(valorEmVigor(p.WORKI_WHATSAPP_MAX_CHARS)).toBe("1500");
    expect(valorEmVigor(p.WORKI_ATALHO_ANDAMENTO)).toBe("1");
    expect(valorEmVigor(p.WORKI_RECOVERY_POLL_SECONDS)).toBe("3");
  });

  it("NENHUM segredo do env aparece na saida", () => {
    for (const texto of [EMBRULHADA, SOLTA, EMBRULHADA.replace(/\\n/g, "\\n")]) {
      const saida = JSON.stringify({ params: dados(texto), commit: extrairCommit(texto) });
      for (const segredo of SEGREDOS) {
        expect(saida, segredo).not.toContain(segredo);
      }
    }
  });

  it("so devolve as chaves da lista fechada", () => {
    const permitidas = new Set(PARAMETROS.map((p) => p.chave));
    for (const p of dados(EMBRULHADA)) expect(permitidas.has(p.chave)).toBe(true);
    expect(dados(EMBRULHADA)).toHaveLength(PARAMETROS.length);
    expect(PARAMETROS.every((p) => !/KEY|SECRET|TOKEN|PASSWORD|URL/i.test(p.chave))).toBe(true);
  });

  it("um segredo colado por engano num parametro permitido nao passa", () => {
    const env = "WORKI_ACK_AFTER_SECONDS=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.segredo\nWORKI_DRY_RUN=1";
    const p = porChave(JSON.stringify({ env }));
    expect(p.WORKI_ACK_AFTER_SECONDS.valor).toBeNull();
    expect(p.WORKI_DRY_RUN.valor).toBe("1");
  });

  it("funciona com o texto bruto com \\n escapado, sem JSON valido", () => {
    const bruto = `lixo {"env":"WORKI_WORKER_CONCURRENCY=2\\nWORKI_DRY_RUN=0\\nSEGREDO=abc" CORTADO`;
    const p = porChave(bruto);
    expect(p.WORKI_WORKER_CONCURRENCY.valor).toBe("2");
    expect(p.WORKI_DRY_RUN.valor).toBe("0");
  });
});
