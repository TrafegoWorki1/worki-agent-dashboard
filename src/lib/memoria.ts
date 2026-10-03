/**
 * Segunda camada do isolamento de memoria.
 *
 * `queries.ts` ja filtra no banco. Este modulo repete a decisao no ponto
 * de render, para que uma mudanca futura na query nao vaze dado por
 * acidente: se o filtro da consulta regredir, a tela ainda barra.
 *
 * Nao importa `server-only` e nao toca em env — e funcao pura, testavel
 * e usavel de qualquer lado.
 */

export type Visibilidade = "visivel" | "oculta";

/** Campos minimos: o filtro so precisa destes dois. */
export type Memoria = {
  proprietario_id: string;
  projeto_id: string | null;
};

/**
 * Uma memoria e visivel quando pertence ao proprietario pedido E,
 * se houver projeto selecionado, ou e desse projeto ou e global dele.
 *
 * Sem `projetoId` (nenhum projeto escolhido na tela), o filtro e so por
 * proprietario — que e o unico eixo que nunca pode ser ignorado.
 */
export function tipoMemoriaVisivel(
  proprietarioPedido: string,
  projetoPedido: string | null | undefined,
  memoria: Memoria,
): Visibilidade {
  if (memoria.proprietario_id !== proprietarioPedido) {
    return "oculta";
  }

  if (
    projetoPedido &&
    memoria.projeto_id !== null &&
    memoria.projeto_id !== projetoPedido
  ) {
    return "oculta";
  }

  return "visivel";
}

/**
 * Filtra uma lista de memorias pelo proprietario e projeto.
 *
 * Retorna somente as visiveis. Preferivel a filtrar no `.map()` do JSX:
 * memoria oculta nem chega a ser renderizada.
 */
export function memoriasVisiveis<T extends Memoria>(
  memorias: T[],
  proprietarioPedido: string,
  projetoPedido: string | null | undefined,
): T[] {
  return memorias.filter(
    (m) =>
      tipoMemoriaVisivel(proprietarioPedido, projetoPedido, m) === "visivel",
  );
}
