import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * O painel le o estado do worker-agent e NAO o altera, com uma unica
 * excecao deliberada: aprovar uma acao pendente (`worki_aprovar_acao`).
 *
 * Este teste varre o codigo-fonte. Ele existe porque uma versao anterior
 * chamava `worki_recuperar_leases` a cada abertura da Visao geral: a funcao
 * parece uma consulta, mas ESCREVE (marca entradas como 'falhou', tarefas
 * como 'bloqueada' e envios como 'incerto'). O README dizia "nenhuma consulta
 * escreve" e ninguem percebeu, porque nada verificava.
 */

const RAIZ = join(__dirname, "..", "src");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const CODIGO = arquivos(RAIZ).map((f) => ({ f, fonte: readFileSync(f, "utf8") }));

/** Tira comentarios, para texto explicando o problema nao disparar o teste. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("painel somente leitura", () => {
  it("nenhum insert, update, delete ou upsert", () => {
    for (const { f, fonte } of CODIGO) {
      expect(semComentarios(fonte), f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    }
  });

  it("a unica RPC chamada e worki_aprovar_acao", () => {
    const rpcs = new Set<string>();
    for (const { fonte } of CODIGO) {
      for (const m of semComentarios(fonte).matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)) {
        rpcs.add(m[1]);
      }
    }
    expect([...rpcs]).toEqual(["worki_aprovar_acao"]);
  });

  it("nao chama worki_recuperar_leases nem outra RPC de manutencao da fila", () => {
    for (const { f, fonte } of CODIGO) {
      const limpo = semComentarios(fonte);
      for (const proibida of [
        "worki_recuperar_leases",
        "worki_reservar_entrada",
        "worki_reservar_saida",
        "worki_concluir_entrada",
        "worki_registrar_envio",
        "worki_iniciar_entrada",
      ]) {
        expect(limpo, `${f}: ${proibida}`).not.toContain(proibida);
      }
    }
  });
});
