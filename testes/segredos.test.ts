import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Segredos no bundle.
 *
 * Este teste le o build de producao real (`.next/static`) e procura os
 * valores reais de `SUPABASE_SERVICE_ROLE_KEY` e `EASYPANEL_API_TOKEN`.
 *
 * Ele so roda se o build existir — comecado por `npm run test:bundle`.
 * Sem build, ele pula em vez de passar: um teste que nao verifica nada
 * e pior do que um teste ausente, porque parece cobertura.
 */

const RAIZ = process.cwd();
const DIR_BUNDLE = join(RAIZ, ".next", "static");

/** Valores deliberadamente reconheciveis, injected no build de teste. */
const MARCA_SERVICE_ROLE = "srh_MARCADOR_DE_TESTE_NAO_USAR_000000";
const MARCA_TOKEN = "epx_MARCADOR_DE_TESTE_NAO_USAR_000000";

function bundleExiste(): boolean {
  try {
    return statSync(DIR_BUNDLE).isDirectory();
  } catch {
    return false;
  }
}

function arquivosDoBundle(dir: string = DIR_BUNDLE): string[] {
  const achados: string[] = [];

  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosDoBundle(caminho));
    } else if (entrada.endsWith(".js") || entrada.endsWith(".map")) {
      achados.push(caminho);
    }
  }

  return achados;
}

describe.skipIf(!bundleExiste())("segredos nao vazam para o bundle", () => {
  // Ler o diretorio dentro do `it`, nao no topo do describe: sem build,
  // este bloco nem executa e o readdirSync nao estoura.
  it("o bundle tem arquivos para inspecionar", () => {
    expect(arquivosDoBundle().length).toBeGreaterThan(0);
  });

  it("NENHUM arquivo do cliente contem a service role", () => {
    const vazamentos = arquivosDoBundle().filter((a) =>
      readFileSync(a, "utf8").includes(MARCA_SERVICE_ROLE),
    );
    expect(vazamentos).toEqual([]);
  });

  it("NENHUM arquivo do cliente contem o token do EasyPanel", () => {
    const comToken = arquivosDoBundle().filter((a) =>
      readFileSync(a, "utf8").includes(MARCA_TOKEN),
    );
    expect(comToken).toEqual([]);
  });

  it("nao existe arquivo NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY no codigo-fonte", () => {
    const alvos: string[] = [];

    function varrer(dir: string) {
      for (const entrada of readdirSync(dir)) {
        if (
          entrada === "node_modules" ||
          entrada === ".next" ||
          entrada === ".git"
        )
          continue;
        const caminho = join(dir, entrada);
        if (statSync(caminho).isDirectory()) {
          varrer(caminho);
        } else if (/\.(ts|tsx|js|jsx|json)$/.test(entrada)) {
          alvos.push(caminho);
        }
      }
    }

    varrer(RAIZ);

    // Constroi o nome em partes: este arquivo de teste cita o termo em
    // comentario, e uma busca literal casaria com ele mesmo.
    const proibido = ["NEXT_PUBLIC_", "SUPABASE_", "SERVICE_ROLE", "KEY"].join(
      "",
    );

    const infratores = alvos.filter((a) => {
      if (a.endsWith("segredos.test.ts") || a.endsWith("autorizacao.test.ts"))
        return false;
      return readFileSync(a, "utf8").includes(proibido);
    });

    // Nenhum uso, nem em comentario, fora dos proprios testes.
    expect(infratores).toEqual([]);
  });

  it("o codigo-fonte nunca escreve NEXT_PUBLIC_ a partir de valor de servidor", () => {
    const fonte = readFileSync(join(RAIZ, "src", "lib", "env.ts"), "utf8");

    // As duas NEXT_PUBLIC_ permitidas sao URL e anon key. Nada mais.
    // Conjunto, nao lista: publico() aparece duas vezes no arquivo e o
    // que importa e quais nomes existem, nao quantas vezes.
    const padrao = new RegExp(`["']NEXT_PUBLIC_([A-Z_]+)["']`, "g");
    const publicas = [...new Set([...fonte.matchAll(padrao)].map((m) => m[1]))];

    expect(publicas.sort()).toEqual(["SUPABASE_ANON_KEY", "SUPABASE_URL"]);
  });

  it("env-publico.ts expoe APENAS URL e anon key", () => {
    const fonte = readFileSync(
      join(RAIZ, "src", "lib", "env-publico.ts"),
      "utf8",
    );

    expect(fonte).not.toContain("SERVICE_ROLE");
    expect(fonte).not.toContain("EASYPANEL");
    expect(fonte).not.toContain("SECRET");
    expect(fonte).not.toContain("TOKEN");
  });
});

/* ------------------------------------------------------------------ */

/**
 * Guarda de estrutura: independente de build, sempre roda.
 */
describe("separacao de modulos", () => {
  it("clientes autenticados ficam separados do cliente de dados", () => {
    const auth = readFileSync(
      join(RAIZ, "src", "lib", "supabase-auth.ts"),
      "utf8",
    );
    const dados = readFileSync(
      join(RAIZ, "src", "lib", "supabase-servidor.ts"),
      "utf8",
    );

    // O cliente de auth usa anon key; o de dados, service role.
    expect(auth).toContain("supabaseAnonKey");
    expect(auth).not.toContain("serviceRoleKey");

    expect(dados).toContain("serviceRoleKey");
  });

  it("todo modulo com service role declara server-only", () => {
    const alvos = [
      join(RAIZ, "src", "lib", "env.ts"),
      join(RAIZ, "src", "lib", "auth.ts"),
      join(RAIZ, "src", "lib", "queries.ts"),
      join(RAIZ, "src", "lib", "easypanel.ts"),
      join(RAIZ, "src", "lib", "supabase-servidor.ts"),
      join(RAIZ, "src", "lib", "supabase-auth.ts"),
    ];

    for (const alvo of alvos) {
      // Aceita as duas grafias de aspas: o Prettier pode reescrever o
      // arquivo para aspas duplas depois deste teste ser escrito.
      const fonte = readFileSync(alvo, "utf8");
      const temServerOnly =
        fonte.includes("import 'server-only'") ||
        fonte.includes('import "server-only"');
      expect(temServerOnly, alvo).toBe(true);
    }
  });

  it("o modulo do EasyPanel expoe apenas leitura", () => {
    const fonte = readFileSync(
      join(RAIZ, "src", "lib", "easypanel.ts"),
      "utf8",
    );

    // Reiniciar/parar/deploy sao acoes destrutivas e nao entram no painel.
    for (const destrutiva of [
      "restart",
      "stopService",
      "redeploy",
      "deleteService",
      "deploy(",
    ]) {
      expect(fonte, destrutiva).not.toContain(destrutiva);
    }
  });
});
