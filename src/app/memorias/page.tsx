import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import { rotuloProprietario } from "@/lib/exibicao";
import { memoriasVisiveis } from "@/lib/memoria";
import { lerPagina, paginar } from "@/lib/paginacao";
import { listarMemorias } from "@/lib/queries";
import { supabaseServidor } from "@/lib/supabase-servidor";
import { STATUS_MEMORIA } from "@/lib/tipos";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { Paginacao } from "@/components/paginacao";
import {
  Aviso,
  Etiqueta,
  Metrica,
  Tempo,
  Vazio,
  textoTruncado,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  proprietario?: string;
  projeto?: string;
  status?: string;
  pagina?: string;
};

const LIMITE_DE_CARGA = 200;

type Proprietario = {
  id: string;
  nome: string;
  total: number;
};

/**
 * Proprietarios disponiveis.
 *
 * Lidos do banco com service_role, nao da sessao: cada proprietario ve os
 * proprios dados. O nome exibido e o numero de WhatsApp (o identificador
 * real), nao a chave de uma memoria qualquer, como era antes.
 *
 * O filtro de proprietario e sempre aplicado: sem ele a pagina mostraria as
 * memorias de todos de uma vez.
 */
async function listarProprietarios(): Promise<Proprietario[]> {
  const sb = supabaseServidor();

  const { data: bruto, error } = await sb
    .from("memorias")
    .select("proprietario_id")
    .limit(2000);

  if (error || !bruto) return [];

  const total = new Map<string, number>();
  for (const m of bruto as Array<{ proprietario_id: string }>) {
    total.set(m.proprietario_id, (total.get(m.proprietario_id) ?? 0) + 1);
  }

  return [...total.entries()]
    .map(([id, n]) => ({ id, nome: rotuloProprietario(id), total: n }))
    .sort((a, b) => b.total - a.total);
}

export default async function PaginaMemorias({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  const proprietarios = await listarProprietarios();

  const selecionarProprietario =
    busca.proprietario || proprietarios[0]?.id || "";

  const doBanco = selecionarProprietario
    ? await listarMemorias({
        proprietarioId: selecionarProprietario,
        projetoId: busca.projeto || undefined,
        status: busca.status || undefined,
        limite: LIMITE_DE_CARGA,
      })
    : [];

  // Segunda barreira: a query ja filtra, mas nenhuma memoria de outro
  // proprietario ou projeto chega a ser renderizada mesmo se o filtro da
  // consulta regredir. A paginacao vem DEPOIS dela, so fatia o que passou.
  const memorias = memoriasVisiveis(
    doBanco,
    selecionarProprietario,
    busca.projeto || undefined,
  );

  const pg = paginar(memorias, lerPagina(busca.pagina), {
    teto: LIMITE_DE_CARGA,
  });

  const doProjeto = busca.projeto
    ? memorias.filter((m) => m.projeto_id === busca.projeto)
    : [];
  const globais = memorias.filter((m) => !m.projeto_id);
  const confirmadas = memorias.filter((m) => m.confirmada);
  const filtrando = Boolean(busca.projeto || busca.status);

  return (
    <LayoutPainel usuario={usuario} ativo="/memorias">
      <Cabecalho
        titulo="Memórias"
        descricao="Conhecimento acumulado pelo agente, isolado por proprietário e projeto."
      />

      <Aviso>
        Memória de outro proprietário ou projeto nunca entra no resultado.
        {busca.projeto && (
          <>
            {" "}
            Filtrando o projeto <span className="mono">{busca.projeto}</span> e as
            memórias globais do mesmo proprietário.
          </>
        )}
      </Aviso>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica
          rotulo="Memórias"
          valor={memorias.length}
          detalhe={pg.truncado ? `limite de ${LIMITE_DE_CARGA} atingido` : undefined}
          tom={pg.truncado ? "etiqueta-alerta" : undefined}
        />
        <Metrica rotulo="Confirmadas" valor={confirmadas.length} />
        <Metrica
          rotulo="Globais"
          valor={globais.length}
          detalhe="sem projeto definido"
        />
        {busca.projeto ? (
          <Metrica rotulo="No projeto filtrado" valor={doProjeto.length} />
        ) : (
          <Metrica
            rotulo="Proprietários"
            valor={proprietarios.length}
            detalhe="com memória registrada"
          />
        )}
      </section>

      <form method="get" className="cartao barra-filtros">
        <div className="flex min-w-64 flex-col gap-1">
          <label htmlFor="proprietario" className="cartao-titulo">
            Proprietário
          </label>
          <select
            id="proprietario"
            name="proprietario"
            className="campo"
            defaultValue={selecionarProprietario}
          >
            {proprietarios.length === 0 && (
              <option value="">nenhum proprietário</option>
            )}
            {proprietarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.total} {p.total === 1 ? "memória" : "memórias"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-48 flex-col gap-1">
          <label htmlFor="projeto" className="cartao-titulo">
            Projeto
          </label>
          <input
            id="projeto"
            name="projeto"
            className="campo"
            defaultValue={busca.projeto ?? ""}
            placeholder="vazio = todos"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="cartao-titulo">
            Status
          </label>
          <select
            id="status"
            name="status"
            className="campo"
            defaultValue={busca.status ?? ""}
          >
            <option value="">Todos</option>
            {STATUS_MEMORIA.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="botao botao-primario">
          Filtrar
        </button>
        {filtrando && (
          <Link
            href={`/memorias?proprietario=${encodeURIComponent(selecionarProprietario)}`}
            className="botao"
          >
            Limpar filtros
          </Link>
        )}
      </form>

      <section id="lista" className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Memórias</h2>
          <p>
            {selecionarProprietario
              ? rotuloProprietario(selecionarProprietario)
              : "nenhum proprietário"}
          </p>
        </div>

        {pg.total === 0 ? (
          <Vazio>Nenhuma memória para este filtro.</Vazio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Chave</th>
                    <th>Valor</th>
                    <th>Tipo</th>
                    <th>Projeto</th>
                    <th>Status</th>
                    <th>Confirmada</th>
                    <th>Criada</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.itens.map((m) => (
                    <tr key={m.id}>
                      <td className="mono text-xs">{m.chave}</td>
                      <td className="truncar" title={m.valor}>
                        {textoTruncado(m.valor, 160)}
                      </td>
                      <td className="text-xs">{m.tipo}</td>
                      <td className="mono text-xs">
                        {m.projeto_id ?? (
                          <span className="text-[var(--texto-tenue)]">global</span>
                        )}
                      </td>
                      <td>
                        <Etiqueta status={m.status} />
                      </td>
                      <td className="text-xs">
                        {m.confirmada ? (
                          <span className="text-[var(--ok)]">sim</span>
                        ) : (
                          <span className="text-[var(--texto-tenue)]">não</span>
                        )}
                      </td>
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={m.criado_em} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={pg}
              caminho="/memorias"
              params={{ ...busca, proprietario: selecionarProprietario }}
              ancora="lista"
              rotulo="memórias"
            />
          </>
        )}
      </section>
    </LayoutPainel>
  );
}
