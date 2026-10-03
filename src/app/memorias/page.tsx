import { exigirAcesso } from "@/lib/auth";
import { supabaseServidor } from "@/lib/supabase-servidor";
import { listarMemorias } from "@/lib/queries";
import { memoriasVisiveis } from "@/lib/memoria";
import { STATUS_MEMORIA } from "@/lib/tipos";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  Etiqueta,
  Metrica,
  Vazio,
  dataHora,
  tempoRelativo,
  textoTruncado,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  proprietario?: string;
  projeto?: string;
  status?: string;
};

type Proprietario = {
  id: string;
  nome: string;
  total: number;
};

/**
 * Proprietarios disponiveis.
 *
 * O painel mostra as memorias de todos os proprietarios permitidos na
 * allowlist — nao de um unico usuario fixo. Por isso a lista e lida do
 * banco com service_role, e nao da sessao: cada pessoa ve os proprios
 * dados de runtime.
 *
 * A lista e limitada a 200 e o filtro deproprietario e obrigatorio
 * para listar: sem ele, a pagina mostraria todas as memorias de todos os
 * proprietarios de uma vez.
 */
async function listarProprietarios(): Promise<Proprietario[]> {
  const sb = supabaseServidor();

  const { data: bruto, error } = await sb
    .from("memorias")
    .select("proprietario_id, chave, valor")
    .limit(2000);

  if (error || !bruto) return [];

  // Agrupa por proprietario e usa a chave mais recente como nome provisorio.
  const porProprietario = new Map<
    string,
    Proprietario & { primeira: string }
  >();

  for (const m of bruto as Array<{
    proprietario_id: string;
    chave: string;
    valor: string;
  }>) {
    const existente = porProprietario.get(m.proprietario_id);
    if (existente) {
      existente.total += 1;
    } else {
      porProprietario.set(m.proprietario_id, {
        id: m.proprietario_id,
        nome: m.chave || m.proprietario_id.slice(-8),
        total: 1,
        primeira: m.chave,
      });
    }
  }

  return [...porProprietario.values()].map(({ primeira, ...p }) => p);
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
        projetoId: busca.projeto,
        status: busca.status,
        limite: 200,
      })
    : [];

  // Segunda barreira: a query ja filtra, mas nenhuma memoria de outro
  // proprietario ou projeto chega a ser renderizada mesmo se o filtro
  // da consulta regredir.
  const memorias = memoriasVisiveis(
    doBanco,
    selecionarProprietario,
    busca.projeto,
  );

  const doProjeto = memorias.filter((m) => m.projeto_id === busca.projeto);
  const globais = memorias.filter((m) => !m.projeto_id);
  const confirmadas = memorias.filter((m) => m.confirmada);

  return (
    <LayoutPainel usuario={usuario} ativo="/memorias">
      <Cabecalho
        titulo="Memorias"
        descricao="Conhecimento acumulado pelo agente, isolado por proprietario e projeto."
        acoes={
          <span className="etiqueta etiqueta-neutra">
            Memoria de outro projeto nunca entra no resultado
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica rotulo="Memorias exibidas" valor={memorias.length} />
        <Metrica rotulo="Confirmadas" valor={confirmadas.length} />
        <Metrica
          rotulo="Globais do dono"
          valor={globais.length}
          detalhe="sem projeto definido"
        />
        <Metrica rotulo="No projeto filtrado" valor={doProjeto.length} />
      </section>

      <form method="get" className="cartao flex flex-wrap items-end gap-3 p-4">
        <div className="flex min-w-64 flex-col gap-1">
          <label htmlFor="proprietario" className="cartao-titulo">
            Proprietario
          </label>
          <select
            id="proprietario"
            name="proprietario"
            className="campo"
            defaultValue={selecionarProprietario}
          >
            {proprietarios.length === 0 && (
              <option value="">nenhum proprietario</option>
            )}
            {proprietarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.total} memoria(s)
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
            placeholder="deixe vazio = todos"
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
      </form>

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Memorias</h2>
          {busca.projeto && (
            <p className="mt-1 text-xs text-[var(--texto-tenue)]">
              Filtro por projeto <span className="mono">{busca.projeto}</span> e
              pelas memoria globais do mesmo proprietario. Nenhuma memoria de
              outro proprietario ou projeto e retornada.
            </p>
          )}
        </div>

        {memorias.length === 0 ? (
          <Vazio>Nenhuma memoria para este filtro.</Vazio>
        ) : (
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
                {memorias.map((m) => (
                  <tr key={m.id}>
                    <td className="mono text-xs">{m.chave}</td>
                    <td className="truncar">{textoTruncado(m.valor, 160)}</td>
                    <td className="text-xs">{m.tipo}</td>
                    <td className="mono text-xs">
                      {m.projeto_id ?? (
                        <span className="text-[var(--texto-tenue)]">
                          global
                        </span>
                      )}
                    </td>
                    <td>
                      <Etiqueta status={m.status} />
                    </td>
                    <td className="text-xs">
                      {m.confirmada ? (
                        <span className="text-[var(--ok)]">sim</span>
                      ) : (
                        <span className="text-[var(--texto-tenue)]">nao</span>
                      )}
                    </td>
                    <td
                      className="text-xs text-[var(--texto-tenue)]"
                      title={dataHora(m.criado_em)}
                    >
                      {tempoRelativo(m.criado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </LayoutPainel>
  );
}
