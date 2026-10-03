import "server-only";

/**
 * Leitura de variaveis de ambiente com separacao rigorosa entre o que pode
 * chegar ao navegador e o que e segredo de servidor.
 *
 * Regra do projeto, e o motivo deste arquivo existir:
 *
 *   - NEXT_PUBLIC_* e INLINADO no bundle pelo Next no momento do build.
 *     Tudo que for lido assim vai para o navegador de forma permanente,
 *     visivel em "View Source", mesmo apos deletar a variavel na Vercel.
 *     Por isso so existem duas NEXT_PUBLIC_* aqui: URL e anon key, que
 *     por design nao concedem acesso as tabelas de runtime (o banco tem
 *     RLS sem policies para anon/authenticated).
 *
 *   - Tudo o mais e lido por process.env em modulo de servidor. Vem a
 *    _service role_ e o _token do EasyPanel. Se qualquer um deles for
 *     importado por um Client Component, o Next passa a inlinar o valor e
 *     o segredo vaza.
 *
 * Por isso `servidor()` e `publico()` lancam se o modulo acabar no bundle
 * do cliente: e melhor o build quebrar do que vazar credencial.
 */

const NOME_SERVICE_ROLE = "SUPABASE_SERVICE_ROLE_KEY";
const NOME_TOKEN_EASYPANEL = "EASYPANEL_API_TOKEN";

export class ErroDeConfiguracao extends Error {
  readonly variaveis: string[];

  constructor(variaveis: string[]) {
    super(
      `Configuracao ausente no servidor: ${variaveis.join(", ")}. ` +
        "Configure na Vercel (Settings > Environment Variables).",
    );
    this.name = "ErroDeConfiguracao";
    this.variaveis = variaveis;
  }
}

function pegar(nome: string): string {
  const v = process.env[nome];
  if (!v || !v.trim()) {
    throw new ErroDeConfiguracao([nome]);
  }
  return v.trim();
}

/**
 * Le uma variavel opcional: devolve null em vez de estourar.
 * Usado pelo EasyPanel, que e opcional no painel.
 */
function opcional(nome: string): string | null {
  const v = process.env[nome];
  return v && v.trim() ? v.trim() : null;
}

export {};

/**
 * Guard de modulo: impede que um arquivo de servidor seja puxado para o
 * bundle do cliente. Um `import 'client-only'` faria isso na importacao,
 * mas a mensagem de erro dai nao ajuda ninguem a entender o motivo.
 */
function emServidor(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "src/lib/env.ts foi importado em contexto de cliente. " +
        "Nenhuma variavel de servidor pode chegar ao bundle.",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Publico: seguro para o navegador                                     */
/* ------------------------------------------------------------------ */

export type ConfigPublica = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function publico(): ConfigPublica {
  return {
    supabaseUrl: pegar("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: pegar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

/* ------------------------------------------------------------------ */
/* Servidor: nunca sai do container                                    */
/* ------------------------------------------------------------------ */

export type ConfigServidor = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  emailsPermitidos: string[];

  /**
   * Integracao com o EasyPanel e OPCIONAL. Sem essas duas variaveis a
   * pagina /servico mostra "nao configurado" em vez de derrubar a rota
   * inteira — o painel funciona sem elas, so perde a leitura de status.
   */
  easypanelUrl: string;
  easypanelApiToken: string | null;
};

export function servidor(): ConfigServidor {
  emServidor();

  const bruta = process.env.DASHBOARD_ALLOWED_EMAILS ?? "";
  const emailsPermitidos = bruta
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    supabaseUrl: pegar("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: pegar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: pegar(NOME_SERVICE_ROLE),
    emailsPermitidos,
    // `opcional()` ja devolve null, entao nao precisa de encadeamento
    // opcional: o replace seria aplicado sobre undefined.
    easypanelUrl: (opcional("EASYPANEL_URL") ?? "").replace(/\/+$/, ""),
    easypanelApiToken: opcional(NOME_TOKEN_EASYPANEL),
  };
}

/**
 * Existe service role configurada? Usado pela pagina de login para falhar
 * com mensagem clara em vez de erro 500 opaco.
 */
export function serviceRoleConfigurada(): boolean {
  return Boolean(process.env[NOME_SERVICE_ROLE]?.trim());
}

/**
 * Trava de seguranca: nenhuma variavel de servidor pode ter prefixo
 * NEXT_PUBLIC_. Se alguem criar NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, ela
 * passa a ser inlinada no bundle e o segredo fica publico.
 *
 * Roda no build e nos testes.
 */
export function auditarVariaveisDeServidor(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const problemas: string[] = [];

  const nomeDaChave = (v: string) =>
    v.toUpperCase().includes("SERVICE_ROLE") ? NOME_SERVICE_ROLE : "segredo";

  for (const [nome, valor] of Object.entries(env)) {
    if (!nome.startsWith("NEXT_PUBLIC_")) continue;
    const alvo = nome.slice("NEXT_PUBLIC_".length);
    if (
      alvo.includes("SERVICE_ROLE") ||
      alvo.includes("API_TOKEN") ||
      alvo.includes("SECRET") ||
      alvo.includes("PRIVATE")
    ) {
      problemas.push(
        `${nome} e ${nomeDaChave(alvo)} com prefixo NEXT_PUBLIC_: ` +
          "esta variavel seria inlinada no bundle do navegador. " +
          "Remova o prefixo NEXT_PUBLIC_ imediatamente.",
      );
    }
    if (valor && valor.length < 20) {
      problemas.push(
        `${nome} tem ${valor.length} caracteres, curto demais para ser ` +
          "uma credencial real. Se e placeholder, o build passa e a tela quebra em runtime.",
      );
    }
  }

  return problemas;
}
