/**
 * Extracao de dados do `inspectAppService` do EasyPanel.
 *
 * Funcoes puras, sem `server-only` e sem rede, para poderem ser testadas.
 *
 * ATENCAO, e o motivo deste arquivo ser cuidadoso: a resposta do EasyPanel
 * traz o bloco `env` INTEIRO do servico, com chave do Supabase, chave da
 * Evolution e segredo do webhook em texto puro. Nada daqui devolve o texto
 * bruto nem o `env`. So sai o que esta numa lista fechada (PARAMETROS), e so
 * se o valor tiver cara de numero ou de sinalizador. Um segredo colado por
 * engano num desses campos nao passa pelo filtro.
 */

export type CommitImplantado = {
  hash: string;
  hashCurto: string;
  mensagem: string;
  data: string | null;
};

export type ParametroServico = {
  chave: string;
  rotulo: string;
  /** Valor configurado, ou null quando a variavel nao esta definida. */
  valor: string | null;
  /** O que vale quando nao esta definida (padrao do codigo do worker-agent). */
  padrao: string;
};

/**
 * Lista fechada de variaveis que podem aparecer na tela. So comportamento do
 * worker: nenhuma credencial, nenhuma URL.
 */
export const PARAMETROS: ReadonlyArray<{
  chave: string;
  rotulo: string;
  padrao: string;
}> = [
  { chave: "WORKI_RECOVERY_POLL_SECONDS", rotulo: "Intervalo de leitura da fila (s)", padrao: "3" },
  { chave: "WORKI_TASK_TIMEOUT_SECONDS", rotulo: "Limite por pedido (s)", padrao: "1500" },
  { chave: "WORKI_WORKER_LEASE_S", rotulo: "Validade da reserva (s)", padrao: "120" },
  { chave: "WORKI_WORKER_CONCURRENCY", rotulo: "Pedidos em paralelo", padrao: "1" },
  { chave: "WORKI_ATALHO_ANDAMENTO", rotulo: "Atalho de andamento", padrao: "1" },
  { chave: "WORKI_ACK_AFTER_SECONDS", rotulo: "Aviso de andamento apos (s)", padrao: "0" },
  { chave: "WORKI_WHATSAPP_MAX_CHARS", rotulo: "Caracteres por mensagem", padrao: "1500" },
  { chave: "WORKI_DRY_RUN", rotulo: "Modo de teste (nao envia)", padrao: "0" },
];

/** Numero curto ou sinalizador. Qualquer outra coisa nao e exibida. */
const VALOR_SEGURO = /^[0-9A-Za-z._-]{1,12}$/;

/** O MCP devolve JSON em texto; as vezes embrulhado em `{ result: ... }`. */
function lerJson(texto: string): Record<string, unknown> | null {
  try {
    const dados = JSON.parse(texto) as unknown;
    if (dados && typeof dados === "object") {
      const raiz = dados as Record<string, unknown>;
      const dentro = raiz.result;
      return dentro && typeof dentro === "object" && !Array.isArray(dentro)
        ? (dentro as Record<string, unknown>)
        : raiz;
    }
  } catch {
    /* cai para a leitura por padrao de texto */
  }
  return null;
}

export function extrairCommit(texto: string): CommitImplantado | null {
  const json = lerJson(texto);
  const c = json?.commit;
  if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    const hash = String(o.hash ?? o.sha ?? "");
    if (/^[0-9a-f]{7,40}$/i.test(hash)) {
      return {
        hash,
        hashCurto: hash.slice(0, 7),
        mensagem: String(o.message ?? "").split("\n")[0].slice(0, 120),
        data: o.date ? String(o.date) : null,
      };
    }
  }

  // Texto fora do formato esperado: tenta so hash e mensagem, sem varrer o resto.
  const hash = texto.match(/"(?:hash|sha)":\s*"([0-9a-f]{7,40})"/i)?.[1];
  if (!hash) return null;
  const mensagem = texto.match(/"message":\s*"([^"\\]*)/)?.[1] ?? "";
  return { hash, hashCurto: hash.slice(0, 7), mensagem: mensagem.slice(0, 120), data: null };
}

function envComoTexto(texto: string): string {
  const json = lerJson(texto);
  if (json && typeof json.env === "string") return json.env;
  // Sem JSON valido: desfaz o escape de quebra de linha para ler linha a linha.
  return texto.replace(/\\r\\n|\\n/g, "\n");
}

export function extrairParametros(texto: string): ParametroServico[] {
  const env = envComoTexto(texto);

  return PARAMETROS.map(({ chave, rotulo, padrao }) => {
    // A chave vem no inicio da linha ou logo depois de uma aspa/espaco (texto
    // bruto, onde o env aparece dentro de `"env":"..."`). O prefixo evita casar
    // com o final de outra variavel, como `XWORKI_DRY_RUN`.
    const linha = env.match(new RegExp(`(?:^|[\\s"])${chave}\\s*=\\s*(.*)$`, "m"));
    // Corta aspas e barras que sobraram de escape; o filtro decide o resto.
    const bruto = linha ? linha[1].replace(/["\\\r]+$/g, "").trim() : "";
    const valor = bruto !== "" && VALOR_SEGURO.test(bruto) ? bruto : null;
    return { chave, rotulo, valor, padrao };
  });
}

/** Valor em vigor: o configurado, ou o padrao do codigo. */
export function valorEmVigor(p: ParametroServico): string {
  return p.valor ?? p.padrao;
}
