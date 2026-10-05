/**
 * Paginacao de listas.
 *
 * Funcoes puras, sem Supabase e sem `server-only`, para serem testadas de
 * verdade. A pagina vive na URL (`?pagina=2`), entao continua tudo
 * server-side e o link de uma pagina pode ser copiado.
 *
 * As listas do painel ja chegam carregadas, com um teto por consulta (100 a
 * 300 linhas). Aqui so se divide o que foi carregado: nada e buscado de novo.
 * Quando o teto e atingido, `truncado` fica verdadeiro para a tela avisar que
 * existem registros mais antigos fora do alcance.
 */

export const POR_PAGINA = 10;

export type Pagina<T> = {
  itens: T[];
  /** Pagina atual, ja corrigida para caber no total (1 a totalPaginas). */
  pagina: number;
  totalPaginas: number;
  /** Total de linhas carregadas (nao o total do banco). */
  total: number;
  porPagina: number;
  /** Posicao humana do primeiro e do ultimo item exibido (1-based); 0 se vazio. */
  de: number;
  ate: number;
  /** O teto de carga foi atingido: pode haver mais registros alem desta lista. */
  truncado: boolean;
};

/** Le `?pagina=` da URL. Qualquer lixo vira 1. */
export function lerPagina(bruto: string | string[] | undefined): number {
  const texto = Array.isArray(bruto) ? bruto[0] : bruto;
  const n = Number.parseInt(texto ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}

/**
 * Fatia a lista na pagina pedida.
 *
 * Pagina alem do fim (por exemplo, depois de um filtro que encolheu a
 * lista) cai na ultima pagina em vez de mostrar tela vazia.
 *
 * `teto`: quantas linhas a consulta carrega no maximo. Se a lista chegou a
 * esse numero, ha provavelmente mais registros no banco.
 */
export function paginar<T>(
  lista: readonly T[],
  paginaPedida: number,
  opcoes: { porPagina?: number; teto?: number } = {},
): Pagina<T> {
  const porPagina = Math.max(1, opcoes.porPagina ?? POR_PAGINA);
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, Math.trunc(paginaPedida) || 1), totalPaginas);

  const inicio = (pagina - 1) * porPagina;
  const itens = lista.slice(inicio, inicio + porPagina);

  return {
    itens,
    pagina,
    totalPaginas,
    total,
    porPagina,
    de: itens.length === 0 ? 0 : inicio + 1,
    ate: inicio + itens.length,
    truncado: opcoes.teto !== undefined && total >= opcoes.teto,
  };
}

/**
 * Numeros de pagina para o navegador, com reticencias: `1 … 4 5 [6] 7 8 … 20`.
 * Sempre mostra a primeira, a ultima, a atual e `vizinhas` de cada lado.
 * `null` e uma reticencia.
 */
export function numerosDePagina(
  atual: number,
  total: number,
  vizinhas = 1,
): Array<number | null> {
  if (total <= 1) return [1];

  const mostrar = new Set<number>([1, total]);
  for (let p = atual - vizinhas; p <= atual + vizinhas; p++) {
    if (p >= 1 && p <= total) mostrar.add(p);
  }

  const ordenados = [...mostrar].sort((a, b) => a - b);
  const saida: Array<number | null> = [];
  ordenados.forEach((p, i) => {
    const anterior = ordenados[i - 1];
    if (anterior !== undefined) {
      // Um unico numero faltando vale mais que uma reticencia.
      if (p - anterior === 2) saida.push(anterior + 1);
      else if (p - anterior > 2) saida.push(null);
    }
    saida.push(p);
  });
  return saida;
}

/**
 * Monta a query string de uma pagina, preservando os outros filtros.
 * Remove `pagina` da pagina 1 para a URL ficar limpa.
 */
export function hrefDaPagina(
  caminho: string,
  params: Record<string, string | undefined>,
  nomeParam: string,
  pagina: number,
): string {
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (chave !== nomeParam && valor) q.set(chave, valor);
  }
  if (pagina > 1) q.set(nomeParam, String(pagina));
  const texto = q.toString();
  return texto ? `${caminho}?${texto}` : caminho;
}
