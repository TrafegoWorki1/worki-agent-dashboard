import Link from "next/link";

import { hrefDaPagina, numerosDePagina, type Pagina } from "@/lib/paginacao";

/**
 * Rodape de paginacao de uma lista.
 *
 * Server Component: a pagina vive na URL (`?pagina=2`) e os filtros ja
 * escolhidos sao preservados. Cada lista de uma tela usa um parametro proprio
 * (`nome`), para duas listas na mesma pagina nao se atrapalharem.
 *
 * `ancora` leva o navegador de volta para a lista, em vez de jogar o usuario
 * para o topo da pagina a cada clique.
 */
export function Paginacao({
  pagina,
  caminho,
  params,
  nome = "pagina",
  ancora,
  rotulo = "registros",
}: {
  pagina: Pagina<unknown>;
  caminho: string;
  params: Record<string, string | undefined>;
  nome?: string;
  ancora?: string;
  rotulo?: string;
}) {
  if (pagina.total === 0) return null;

  const href = (n: number) =>
    hrefDaPagina(caminho, params, nome, n) + (ancora ? `#${ancora}` : "");
  const numeros = numerosDePagina(pagina.pagina, pagina.totalPaginas);

  return (
    <nav className="paginacao" aria-label={`Paginação de ${rotulo}`}>
      <p>
        Mostrando{" "}
        <strong className="font-semibold text-[var(--texto-fraco)]">
          {pagina.de}–{pagina.ate}
        </strong>{" "}
        de {pagina.total} {rotulo}
        {pagina.truncado && (
          <span className="text-[var(--alerta)]">
            {" "}
            · limite de carga atingido: use o filtro de período para ver os
            mais antigos
          </span>
        )}
      </p>

      {pagina.totalPaginas > 1 && (
        <div className="paginacao-nav">
          {pagina.pagina > 1 ? (
            <Link
              href={href(pagina.pagina - 1)}
              className="pag-item"
              aria-label="Página anterior"
              rel="prev"
            >
              ‹
            </Link>
          ) : (
            <span className="pag-item pag-item-desativado" aria-hidden="true">
              ‹
            </span>
          )}

          {numeros.map((n, i) =>
            n === null ? (
              <span key={`r${i}`} className="pag-reticencias" aria-hidden="true">
                …
              </span>
            ) : n === pagina.pagina ? (
              <span
                key={n}
                className="pag-item pag-item-ativo"
                aria-current="page"
              >
                {n}
              </span>
            ) : (
              <Link
                key={n}
                href={href(n)}
                className="pag-item"
                aria-label={`Página ${n}`}
              >
                {n}
              </Link>
            ),
          )}

          {pagina.pagina < pagina.totalPaginas ? (
            <Link
              href={href(pagina.pagina + 1)}
              className="pag-item"
              aria-label="Próxima página"
              rel="next"
            >
              ›
            </Link>
          ) : (
            <span className="pag-item pag-item-desativado" aria-hidden="true">
              ›
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
