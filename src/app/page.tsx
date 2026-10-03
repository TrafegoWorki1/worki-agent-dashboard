import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import {
  healthDoServico,
  logsResumidos,
  prontidaoDoServico,
  statusServico,
} from "@/lib/easypanel";
import { formatarDuracao } from "@/lib/fila";
import { mensagemDeErroDoServico } from "@/lib/servico-parse";
import {
  listarAprovacoes,
  listarTarefas,
  mensagensRecentes,
  saudeDaFila,
  temposDeResposta,
  visaoGeral,
} from "@/lib/queries";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  ErroBox,
  Etiqueta,
  ListaAlertas,
  Metrica,
  Tempo,
  Vazio,
  telefoneDoJid,
  textoTruncado,
} from "@/components/ui";

function simNao(v: boolean | null): string {
  return v === null ? "?" : v ? "ok" : "fora";
}

// O painel mostra estado atual: sem cache estatico.
export const dynamic = "force-dynamic";

function VerTodas({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link href={href} className="link-acao">
      {rotulo} →
    </Link>
  );
}

export default async function PaginaVisaoGeral() {
  const usuario = await exigirAcesso();

  // Busca em paralelo: nenhuma depende da outra.
  const [dados, status, health, pronto, logs, mensagens, tarefas, aprovacoes, saude, tempos] =
    await Promise.all([
      visaoGeral(),
      statusServico(),
      healthDoServico(),
      prontidaoDoServico(),
      logsResumidos(15),
      mensagensRecentes({ limite: 8 }),
      listarTarefas({ status: "ativa", limite: 6 }),
      listarAprovacoes({ limite: 6 }),
      saudeDaFila(),
      temposDeResposta(50),
    ]);

  const noAr = health.ok && pronto.pronto;

  return (
    <LayoutPainel usuario={usuario} ativo="/">
      <Cabecalho
        titulo="Visão geral"
        descricao="Estado do agente em tempo real: o serviço, a fila e o que precisa de atenção."
      />

      {/* Estado do servico */}
      <section className="cartao p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div>
            <div className="cartao-titulo">Serviço no EasyPanel</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`etiqueta ${noAr ? "etiqueta-ok" : "etiqueta-erro"}`}>
                {noAr ? "no ar" : health.ok ? "no ar, com restrições" : "fora do ar"}
              </span>
              <span className="text-sm text-[var(--texto-fraco)]">n8n/worki-agent</span>
            </div>
          </div>

          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[var(--texto-tenue)]">Branch</dt>
              <dd className="mono mt-0.5">{status.branch ?? "—"}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-[var(--texto-tenue)]">No ar (commit)</dt>
              <dd className="mono mt-0.5 truncate" title={status.commit?.mensagem}>
                {status.commit ? `${status.commit.hashCurto} ${status.commit.mensagem}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--texto-tenue)]">Latência</dt>
              <dd className="mono mt-0.5">
                {health.latenciaMs !== null ? `${health.latenciaMs} ms` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--borda)] pt-3 text-xs">
          <span className="text-[var(--texto-tenue)]">Prontidão (/ready)</span>
          {pronto.alcancou ? (
            <>
              <span className={`etiqueta ${pronto.pronto ? "etiqueta-ok" : "etiqueta-erro"}`}>
                {pronto.pronto ? "pronto" : "não pronto"}
              </span>
              <span>Supabase {simNao(pronto.supabase)}</span>
              <span>Worker {simNao(pronto.worker)}</span>
              <span>Evolution {simNao(pronto.evolution)}</span>
            </>
          ) : (
            <span className="text-[var(--erro)]">
              {mensagemDeErroDoServico(pronto.erro ?? "sem resposta")}
            </span>
          )}
          <span className="ml-auto">
            <VerTodas href="/servico" rotulo="Detalhes do serviço" />
          </span>
        </div>

        {status.erro && (
          <div className="mt-3">
            <ErroBox mensagem={`EasyPanel: ${mensagemDeErroDoServico(status.erro)}`} />
          </div>
        )}
      </section>

      {/* Alertas */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Alertas</h2>
          <VerTodas href="/fila" rotulo="Fila e entregas" />
        </div>
        <ListaAlertas alertas={saude.alertas} />
      </section>

      {/* Metricas */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica rotulo="Conversas" valor={dados.conversas} />
        <Metrica rotulo="Mensagens" valor={dados.mensagens} />
        <Metrica
          rotulo="Tarefas ativas"
          valor={dados.tarefasAtivas}
          detalhe={`${dados.tarefasBloqueadas} bloqueada(s)`}
          tom={dados.tarefasBloqueadas > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Aprovações pendentes"
          valor={dados.aprovacoesPendentes}
          tom={dados.aprovacoesPendentes > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Tempo de resposta (mediana)"
          valor={formatarDuracao(tempos.resumo.medianaTotalS)}
          detalhe={`90% em até ${formatarDuracao(tempos.resumo.p90TotalS)} · ${tempos.resumo.amostras} msgs`}
        />
        <Metrica
          rotulo="Respostas enviadas (24 h)"
          valor={saude.saidas.enviadas24h}
          detalhe={`${saude.atalhos24h} pelo atalho de andamento`}
        />
        <Metrica
          rotulo="Respostas paradas"
          valor={saude.saidas.paradas.total}
          detalhe="sem envio há mais de 1 h"
          tom={saude.saidas.paradas.total > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Reservas vencidas"
          valor={dados.leasesVencidas}
          detalhe="pedido em execução sem worker"
          tom={dados.leasesVencidas > 0 ? "etiqueta-erro" : undefined}
        />
      </section>

      {/* Listas recentes: lado a lado em tela larga */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="cartao overflow-hidden">
          <div className="cartao-cabecalho">
            <h2>Aprovações em aberto</h2>
            <VerTodas href="/aprovacoes" rotulo="Ver todas" />
          </div>
          {aprovacoes.length === 0 ? (
            <Vazio>Nenhuma aprovação em aberto.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Alvo</th>
                    <th>Status</th>
                    <th>Criada</th>
                  </tr>
                </thead>
                <tbody>
                  {aprovacoes.map((a) => (
                    <tr key={a.id}>
                      <td>{a.acao ?? "—"}</td>
                      <td className="mono truncar text-xs">{a.alvo ?? a.descricao}</td>
                      <td>
                        <Etiqueta status={a.status} contexto="acao" />
                      </td>
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={a.criado_em} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cartao overflow-hidden">
          <div className="cartao-cabecalho">
            <h2>Tarefas ativas</h2>
            <VerTodas href="/tarefas" rotulo="Ver todas" />
          </div>
          {tarefas.length === 0 ? (
            <Vazio>Nenhuma tarefa ativa agora.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Objetivo</th>
                    <th>Etapa</th>
                    <th>Atualizada</th>
                  </tr>
                </thead>
                <tbody>
                  {tarefas.map((t) => (
                    <tr key={t.id}>
                      <td className="truncar" title={t.objetivo}>
                        {textoTruncado(t.objetivo, 140)}
                      </td>
                      <td className="text-xs">{t.etapa_atual ?? "—"}</td>
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={t.atualizado_em} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Mensagens recentes</h2>
          <VerTodas href="/conversas" rotulo="Ver conversas" />
        </div>
        {mensagens.length === 0 ? (
          <Vazio>Nenhuma mensagem recebida.</Vazio>
        ) : (
          <ul className="divide-y divide-[var(--borda)]">
            {mensagens.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{telefoneDoJid(m.de)}</span>
                  <span className="text-xs text-[var(--texto-tenue)]">
                    <Tempo iso={m.criado_em} />
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--texto-fraco)]">
                  {textoTruncado(m.texto, 220)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Logs do serviço</h2>
          <VerTodas href="/servico#logs" rotulo="Ver mais" />
        </div>
        {logs.erro ? (
          <div className="p-4">
            <ErroBox mensagem={logs.erro} />
          </div>
        ) : logs.linhas.length === 0 ? (
          <Vazio>Nenhum log disponível.</Vazio>
        ) : (
          <pre className="mono max-h-80 overflow-auto p-4 text-xs leading-relaxed text-[var(--texto-fraco)]">
            {logs.linhas.join("\n")}
          </pre>
        )}
      </section>
    </LayoutPainel>
  );
}
