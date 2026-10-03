import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import { tarefasComStatusDesconhecido } from "@/lib/exibicao";
import { hrefDaPagina, lerPagina, paginar } from "@/lib/paginacao";
import { etapasDe, listarSaidas, listarTarefas } from "@/lib/queries";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { Paginacao } from "@/components/paginacao";
import {
  ErroBox,
  Etiqueta,
  Metrica,
  Tempo,
  Vazio,
  dataHora,
  idCurto,
  textoTruncado,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  status?: string;
  projeto?: string;
  tarefa?: string;
  pagina?: string;
  p_etapas?: string;
};

const LIMITE_DE_CARGA = 100;

const ABAS = [
  { valor: "ativa", rotulo: "Ativas" },
  { valor: "bloqueada", rotulo: "Bloqueadas" },
  { valor: "concluida", rotulo: "Concluídas" },
  { valor: "falhou", rotulo: "Falharam" },
  { valor: "todas", rotulo: "Todas" },
];

/** Monta o link de uma aba/tarefa preservando o que ainda vale do filtro. */
function href(busca: Busca, mudancas: Partial<Busca>): string {
  const q = new URLSearchParams();
  const alvo: Busca = { ...busca, pagina: undefined, p_etapas: undefined, ...mudancas };
  for (const [k, v] of Object.entries(alvo)) if (v) q.set(k, v);
  const texto = q.toString();
  return texto ? `/tarefas?${texto}` : "/tarefas";
}

export default async function PaginaTarefas({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  // Sem parametro = "Ativas". "todas" e explicito para o link ser copiavel.
  const status = busca.status ?? "ativa";

  const [tarefas, incertas] = await Promise.all([
    listarTarefas({
      status: status === "todas" ? undefined : status,
      projetoId: busca.projeto || undefined,
      limite: LIMITE_DE_CARGA,
    }),
    listarSaidas({ status: "incerto", limite: 100 }),
  ]);

  const pg = paginar(tarefas, lerPagina(busca.pagina), { teto: LIMITE_DE_CARGA });

  // Etapas so da tarefa selecionada: buscar todas seria N+1.
  const selecionada = busca.tarefa
    ? (tarefas.find((t) => t.id === busca.tarefa) ?? null)
    : null;
  const etapas = selecionada ? await etapasDe(selecionada.id) : [];
  const pgEtapas = paginar(etapas, lerPagina(busca.p_etapas));

  const ativas = tarefas.filter((t) => t.status === "ativa").length;
  const bloqueadas = tarefas.filter((t) => t.status === "bloqueada").length;
  const desconhecidas = tarefasComStatusDesconhecido(tarefas);
  const mostrarProjeto = tarefas.some((t) => t.projeto_id);

  return (
    <LayoutPainel usuario={usuario} ativo="/tarefas">
      <Cabecalho
        titulo="Tarefas"
        descricao="Etapas, checkpoints, próxima ação e resultado de cada execução."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica
          rotulo="No filtro"
          valor={tarefas.length}
          detalhe={pg.truncado ? `limite de ${LIMITE_DE_CARGA} atingido` : undefined}
          tom={pg.truncado ? "etiqueta-alerta" : undefined}
        />
        <Metrica rotulo="Ativas" valor={ativas} />
        <Metrica
          rotulo="Bloqueadas"
          valor={bloqueadas}
          tom={bloqueadas > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Entregas incertas"
          valor={incertas.length}
          detalhe={incertas.length > 0 ? "bloqueiam a conversa — ver Fila e entregas" : undefined}
          tom={incertas.length > 0 ? "etiqueta-erro" : undefined}
        />
      </section>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="cartao-titulo">Status</span>
          <div className="abas" role="group" aria-label="Status da tarefa">
            {ABAS.map((a) => (
              <Link
                key={a.valor}
                href={href(busca, { status: a.valor, tarefa: undefined })}
                className={`aba ${status === a.valor ? "aba-ativa" : ""}`}
              >
                {a.rotulo}
              </Link>
            ))}
          </div>
        </div>

        <form method="get" className="flex items-end gap-2">
          <input type="hidden" name="status" value={status} />
          <div className="flex flex-col gap-1">
            <label htmlFor="projeto" className="cartao-titulo">
              Projeto
            </label>
            <input
              id="projeto"
              name="projeto"
              className="campo"
              defaultValue={busca.projeto ?? ""}
              placeholder="id do projeto"
            />
          </div>
          <button type="submit" className="botao">
            Filtrar
          </button>
          {busca.projeto && (
            <Link href={href(busca, { projeto: undefined, tarefa: undefined })} className="botao">
              Limpar
            </Link>
          )}
        </form>
      </div>

      {selecionada && (
        <section className="cartao p-5" id="detalhe">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="cartao-titulo">Tarefa {idCurto(selecionada.id)}</div>
              <p className="mt-1 text-base font-medium">{selecionada.objetivo}</p>
            </div>
            <Link href={href(busca, { tarefa: undefined })} className="botao botao-pequeno">
              Fechar
            </Link>
          </div>

          <dl className="mt-4 grid gap-x-10 gap-y-1 text-sm md:grid-cols-2">
            <Linha rotulo="Status">
              <Etiqueta status={selecionada.status} />
            </Linha>
            <Linha rotulo="Etapa atual">{selecionada.etapa_atual ?? "—"}</Linha>
            <Linha rotulo="Próxima ação">{selecionada.proxima_acao ?? "—"}</Linha>
            <Linha rotulo="Atualizada">{dataHora(selecionada.atualizado_em)}</Linha>
          </dl>

          {selecionada.checkpoint && Object.keys(selecionada.checkpoint).length > 0 && (
            <div className="mt-4">
              <div className="cartao-titulo">Checkpoint</div>
              <pre className="mono mt-1 max-h-48 overflow-auto rounded-lg bg-[var(--superficie-2)] p-3 text-xs">
                {JSON.stringify(selecionada.checkpoint, null, 2)}
              </pre>
            </div>
          )}

          {selecionada.resultado && (
            <div className="mt-4">
              <div className="cartao-titulo">Resultado</div>
              <p className="mt-1 text-sm text-[var(--texto-fraco)]">{selecionada.resultado}</p>
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-xl border border-[var(--borda)]" id="etapas">
            <div className="cartao-cabecalho">
              <h3>Etapas</h3>
              <p>Operações registradas para esta tarefa</p>
            </div>
            {pgEtapas.total === 0 ? (
              <Vazio>Nenhuma etapa registrada.</Vazio>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Operação</th>
                        <th>Status</th>
                        <th>ID externo</th>
                        <th>Evidência</th>
                        <th>Atualizada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pgEtapas.itens.map((e) => (
                        <tr key={e.id}>
                          <td className="mono text-xs">{e.chave_operacao}</td>
                          <td>
                            <Etiqueta status={e.status} />
                          </td>
                          <td className="mono text-xs">{e.external_id ?? "—"}</td>
                          <td
                            className="truncar mono text-xs"
                            title={e.evidencia ? JSON.stringify(e.evidencia) : undefined}
                          >
                            {e.evidencia ? textoTruncado(JSON.stringify(e.evidencia), 120) : "—"}
                          </td>
                          <td className="text-xs text-[var(--texto-fraco)]">
                            <Tempo iso={e.atualizado_em} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Paginacao
                  pagina={pgEtapas}
                  caminho="/tarefas"
                  params={{ ...busca }}
                  nome="p_etapas"
                  ancora="etapas"
                  rotulo="etapas"
                />
              </>
            )}
          </div>
        </section>
      )}

      <section className="cartao overflow-hidden" id="lista">
        <div className="cartao-cabecalho">
          <h2>Tarefas</h2>
          <p>Clique em uma linha para ver etapas e checkpoint</p>
        </div>

        {pg.total === 0 ? (
          <Vazio>
            {status === "ativa"
              ? "Nenhuma tarefa ativa agora. Veja “Todas” para o histórico."
              : "Nenhuma tarefa com esse filtro."}
          </Vazio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Objetivo</th>
                    <th>Status</th>
                    <th>Etapa</th>
                    {mostrarProjeto && <th>Projeto</th>}
                    <th>Atualizada</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pg.itens.map((t) => (
                    <tr key={t.id} className={t.id === selecionada?.id ? "tabela-linha-ativa" : ""}>
                      <td className="truncar" title={t.objetivo}>
                        {textoTruncado(t.objetivo, 140)}
                      </td>
                      <td>
                        <Etiqueta status={t.status} />
                      </td>
                      <td className="text-xs">{t.etapa_atual ?? "—"}</td>
                      {mostrarProjeto && <td className="mono text-xs">{t.projeto_id ?? "—"}</td>}
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={t.atualizado_em} />
                      </td>
                      <td>
                        <Link
                          href={`${href(busca, { tarefa: t.id, pagina: pg.pagina > 1 ? String(pg.pagina) : undefined })}#detalhe`}
                          className="link-acao"
                        >
                          Ver etapas
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={pg}
              caminho="/tarefas"
              params={{ ...busca, p_etapas: undefined }}
              ancora="lista"
              rotulo="tarefas"
            />
          </>
        )}
      </section>

      {desconhecidas.length > 0 && (
        <ErroBox
          mensagem={`${desconhecidas.length} tarefa(s) com status fora da lista conhecida. O backend mudou o schema?`}
        />
      )}
    </LayoutPainel>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--borda)] py-2">
      <dt className="text-[var(--texto-fraco)]">{rotulo}</dt>
      <dd className="text-right text-[0.8125rem]">{children}</dd>
    </div>
  );
}
