import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import { conversaDireta, montarLinhaDoTempo } from "@/lib/exibicao";
import { lerPagina, paginar } from "@/lib/paginacao";
import {
  listarConversas,
  listarSaidas,
  listarTarefas,
  mensagensRecentes,
} from "@/lib/queries";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { Paginacao } from "@/components/paginacao";
import {
  Etiqueta,
  Metrica,
  Tempo,
  Vazio,
  dataHora,
  idCurto,
  telefoneDoJid,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  conversa?: string;
  periodo?: string;
  pagina?: string;
  p_tarefas?: string;
};

const LIMITE_DE_CARGA = 100;

function periodoDesde(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  const dias: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30 };
  const d = dias[bruto];
  return d ? new Date(Date.now() - d * 86400_000).toISOString() : undefined;
}

const PERIODOS = [
  { valor: "", rotulo: "Tudo" },
  { valor: "24h", rotulo: "24 h" },
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
];

export default async function PaginaConversas({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  const conversas = await listarConversas({
    desde: periodoDesde(busca.periodo),
    limite: LIMITE_DE_CARGA,
  });

  const selecionada = busca.conversa
    ? (conversas.find((c) => c.id === busca.conversa) ?? null)
    : null;

  // Mensagens recebidas E respostas do agente: antes so o lado do dono
  // aparecia, porque as respostas ficam na tabela `saidas`.
  const [recebidas, respostas, tarefas] = selecionada
    ? await Promise.all([
        mensagensRecentes({ conversaId: selecionada.id, limite: 100 }),
        listarSaidas({ conversaId: selecionada.id, limite: 100 }),
        listarTarefas({ conversaId: selecionada.id, limite: 50 }),
      ])
    : [[], [], []];

  const linhaDoTempo = montarLinhaDoTempo(recebidas, respostas);

  const hrefConversa = (id: string) =>
    `/conversas?conversa=${id}${busca.periodo ? `&periodo=${busca.periodo}` : ""}`;

  return (
    <LayoutPainel usuario={usuario} ativo="/conversas">
      <Cabecalho
        titulo="Conversas"
        descricao={
          selecionada
            ? "O que foi dito dos dois lados, a sessão do Hermes e as tarefas desta conversa."
            : "Escolha uma conversa para ver o que foi dito, a sessão do Hermes e as tarefas."
        }
        acoes={
          selecionada ? (
            <Link href="/conversas" className="botao">
              ← Todas as conversas
            </Link>
          ) : undefined
        }
      />

      {selecionada ? (
        <Detalhe
          selecionada={selecionada}
          recebidas={recebidas.length}
          respostas={respostas.length}
          tarefasTotal={tarefas.length}
          linhaDoTempo={linhaDoTempo}
          tarefas={tarefas}
          busca={busca}
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Metrica rotulo="Conversas" valor={conversas.length} />
            <Metrica
              rotulo="Sem sessão do Hermes"
              valor={conversas.filter((c) => !c.session_id).length}
              detalhe="não vinculadas"
            />
            <Metrica
              rotulo="Em grupo"
              valor={
                conversas.filter((c) => !conversaDireta(c.chat_jid, c.participante_jid))
                  .length
              }
            />
          </section>

          <form method="get" className="cartao barra-filtros">
            <div className="flex flex-col gap-1">
              <span className="cartao-titulo">Atualizadas nos últimos</span>
              <div className="abas" role="group" aria-label="Período">
                {PERIODOS.map((p) => (
                  <Link
                    key={p.valor}
                    href={p.valor ? `/conversas?periodo=${p.valor}` : "/conversas"}
                    className={`aba ${(busca.periodo ?? "") === p.valor ? "aba-ativa" : ""}`}
                  >
                    {p.rotulo}
                  </Link>
                ))}
              </div>
            </div>
          </form>

          <ListaDeConversas conversas={conversas} busca={busca} href={hrefConversa} />
        </>
      )}
    </LayoutPainel>
  );
}

function ListaDeConversas({
  conversas,
  busca,
  href,
}: {
  conversas: Awaited<ReturnType<typeof listarConversas>>;
  busca: Busca;
  href: (id: string) => string;
}) {
  const pg = paginar(conversas, lerPagina(busca.pagina), {
    teto: LIMITE_DE_CARGA,
  });

  return (
    <section id="conversas" className="cartao overflow-hidden">
      <div className="cartao-cabecalho">
        <h2>Todas as conversas</h2>
        <p>Clique numa linha para abrir</p>
      </div>

      {pg.total === 0 ? (
        <Vazio>Nenhuma conversa neste período.</Vazio>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Conversa</th>
                  <th>Sessão do Hermes</th>
                  <th>Atualizada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pg.itens.map((c) => {
                  const direta = conversaDireta(c.chat_jid, c.participante_jid);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={href(c.id)}
                          className="block font-medium hover:text-[var(--acento-forte)]"
                        >
                          {telefoneDoJid(c.chat_jid)}
                        </Link>
                        {/* Participante so interessa em grupo; em conversa direta
                            era a mesma pessoa repetida numa coluna inteira. */}
                        {!direta && (
                          <div className="text-xs text-[var(--texto-tenue)]">
                            grupo · participante{" "}
                            {telefoneDoJid(c.participante_jid)}
                          </div>
                        )}
                      </td>
                      <td>
                        {c.session_id ? (
                          <span
                            className="etiqueta etiqueta-ok"
                            title={c.session_id}
                          >
                            vinculada
                          </span>
                        ) : (
                          <span className="etiqueta etiqueta-alerta">
                            não vinculada
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={c.atualizado_em} />
                      </td>
                      <td className="text-right">
                        <Link href={href(c.id)} className="link-acao">
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacao
            pagina={pg}
            caminho="/conversas"
            params={busca}
            ancora="conversas"
            rotulo="conversas"
          />
        </>
      )}
    </section>
  );
}

function Detalhe({
  selecionada,
  recebidas,
  respostas,
  tarefasTotal,
  linhaDoTempo,
  tarefas,
  busca,
}: {
  selecionada: Awaited<ReturnType<typeof listarConversas>>[number];
  recebidas: number;
  respostas: number;
  tarefasTotal: number;
  linhaDoTempo: ReturnType<typeof montarLinhaDoTempo>;
  tarefas: Awaited<ReturnType<typeof listarTarefas>>;
  busca: Busca;
}) {
  const pgMsgs = paginar(linhaDoTempo, lerPagina(busca.pagina));
  const pgTarefas = paginar(tarefas, lerPagina(busca.p_tarefas));

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica rotulo="Você enviou" valor={recebidas} detalhe="mensagens" />
        <Metrica rotulo="O agente respondeu" valor={respostas} detalhe="respostas" />
        <Metrica rotulo="Tarefas" valor={tarefasTotal} />
        <Metrica
          rotulo="Sessão do Hermes"
          valor={selecionada.session_id ? "vinculada" : "não vinculada"}
          detalhe={selecionada.session_id ? idCurto(selecionada.session_id) : "sem contexto retomável"}
          tom={selecionada.session_id ? "etiqueta-ok" : "etiqueta-alerta"}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Coluna principal: a conversa */}
        <section id="mensagens" className="cartao overflow-hidden">
          <div className="cartao-cabecalho">
            <h2>{telefoneDoJid(selecionada.chat_jid)}</h2>
            <p>Mais recentes primeiro · atualizada {dataHora(selecionada.atualizado_em)}</p>
          </div>

          {pgMsgs.total === 0 ? (
            <Vazio>Nenhuma mensagem nesta conversa.</Vazio>
          ) : (
            <>
              <ul className="space-y-3 p-4">
                {pgMsgs.itens.map((i) => (
                  <li
                    key={i.id}
                    className={`flex flex-col gap-1 ${i.lado === "saida" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`balao ${i.lado === "saida" ? "balao-saida" : "balao-entrada"}`}
                    >
                      {i.texto}
                    </div>
                    <div className="flex items-center gap-2 px-1 text-[0.6875rem] text-[var(--texto-tenue)]">
                      <span>{i.lado === "saida" ? "Agente" : "Você"}</span>
                      <span>·</span>
                      <Tempo iso={i.quando} />
                      {i.statusEnvio && i.statusEnvio !== "enviada" && (
                        <Etiqueta status={i.statusEnvio} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Paginacao
                pagina={pgMsgs}
                caminho="/conversas"
                params={busca}
                ancora="mensagens"
                rotulo="mensagens"
              />
            </>
          )}
        </section>

        {/* Coluna lateral: dados e tarefas */}
        <div className="space-y-6">
          <section className="cartao p-4">
            <div className="cartao-titulo">Detalhes</div>
            <dl className="mt-3 space-y-2 text-sm">
              <Linha rotulo="Chat" valor={telefoneDoJid(selecionada.chat_jid)} />
              {!conversaDireta(selecionada.chat_jid, selecionada.participante_jid) && (
                <Linha
                  rotulo="Participante"
                  valor={telefoneDoJid(selecionada.participante_jid)}
                />
              )}
              <Linha rotulo="Conversa" valor={idCurto(selecionada.id)} mono />
              <Linha
                rotulo="Sessão"
                valor={selecionada.session_id ? idCurto(selecionada.session_id) : "—"}
                mono
              />
            </dl>
          </section>

          <section id="tarefas" className="cartao overflow-hidden">
            <div className="cartao-cabecalho">
              <h2>Tarefas</h2>
              <p>{tarefasTotal} nesta conversa</p>
            </div>
            {pgTarefas.total === 0 ? (
              <Vazio>Nenhuma tarefa nesta conversa.</Vazio>
            ) : (
              <>
                <ul className="divide-y">
                  {pgTarefas.itens.map((t) => (
                    <li key={t.id} className="space-y-1.5 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncar text-sm" title={t.objetivo}>
                          {t.objetivo}
                        </p>
                        <Etiqueta status={t.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-[var(--texto-tenue)]">
                        {t.etapa_atual && <span>{t.etapa_atual}</span>}
                        <Tempo iso={t.atualizado_em} />
                      </div>
                    </li>
                  ))}
                </ul>
                <Paginacao
                  pagina={pgTarefas}
                  caminho="/conversas"
                  params={busca}
                  nome="p_tarefas"
                  ancora="tarefas"
                  rotulo="tarefas"
                />
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Linha({
  rotulo,
  valor,
  mono,
}: {
  rotulo: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[color-mix(in_srgb,var(--borda)_55%,transparent)] pb-2 last:border-0 last:pb-0">
      <dt className="text-[var(--texto-tenue)]">{rotulo}</dt>
      <dd className={`truncate text-right text-[0.8125rem] ${mono ? "mono" : ""}`}>
        {valor}
      </dd>
    </div>
  );
}
