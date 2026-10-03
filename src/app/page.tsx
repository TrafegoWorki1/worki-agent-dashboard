import { exigirAcesso } from "@/lib/auth";
import {
  healthDoServico,
  logsResumidos,
  prontidaoDoServico,
  statusServico,
} from "@/lib/easypanel";
import { formatarDuracao } from "@/lib/fila";
import { saudeDaFila, temposDeResposta, visaoGeral } from "@/lib/queries";
import { STATUS_ENTRADA, STATUS_SAIDA, STATUS_TAREFA } from "@/lib/tipos";

import Link from "next/link";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  Etiqueta,
  ErroBox,
  ListaAlertas,
  Metrica,
  Vazio,
  dataHora,
  telefoneDoJid,
  tempoRelativo,
} from "@/components/ui";

import {
  listarAprovacoes,
  listarTarefas,
  mensagensRecentes,
} from "@/lib/queries";

function simNao(v: boolean | null): string {
  return v === null ? "?" : v ? "ok" : "fora";
}

// O painel mostra estado atual: sem cache estatico.
export const dynamic = "force-dynamic";

export default async function PaginaVisaoGeral() {
  const usuario = await exigirAcesso();

  // Busca em paralelo: a pagina nao depende de nenhuma delas para a outra.
  const [
    dados,
    status,
    health,
    pronto,
    logs,
    mensagens,
    tarefas,
    aprovacoes,
    saude,
    tempos,
  ] = await Promise.all([
    visaoGeral(),
    statusServico(),
    healthDoServico(),
    prontidaoDoServico(),
    logsResumidos(15),
    mensagensRecentes({ limite: 8 }),
    listarTarefas({ limite: 6 }),
    listarAprovacoes({ limite: 6 }),
    saudeDaFila(),
    temposDeResposta(20),
  ]);

  return (
    <LayoutPainel usuario={usuario} ativo="/">
      <Cabecalho
        titulo="Visao geral"
        descricao="Estado do agente dominante em tempo real."
      />

      {/* Status do servico */}
      <section className="cartao p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="cartao-titulo">Servico no EasyPanel</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Etiqueta status={health.ok ? "enviada" : "falhou"} />
              <span className="text-sm text-[var(--texto-fraco)]">
                n8n/worki-agent
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[var(--texto-tenue)]">Branch</dt>
              <dd className="mono">{status.branch ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--texto-tenue)]">No ar (commit)</dt>
              <dd className="mono truncate" title={status.commit?.mensagem}>
                {status.commit
                  ? `${status.commit.hashCurto} ${status.commit.mensagem}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--texto-tenue)]">Latencia</dt>
              <dd className="mono">
                {health.latenciaMs !== null ? `${health.latenciaMs} ms` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--texto-tenue)]">CPU</dt>
              <dd className="mono">{status.cpu ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--texto-tenue)]">Memoria</dt>
              <dd className="mono">
                {status.memoriaMb ? `${status.memoriaMb} MB` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--texto-tenue)]">Prontidao (/ready):</span>
          {pronto.alcancou ? (
            <>
              <Etiqueta status={pronto.pronto ? "enviada" : "falhou"} />
              <span>Supabase {simNao(pronto.supabase)}</span>
              <span>Worker {simNao(pronto.worker)}</span>
              <span>Evolution {simNao(pronto.evolution)}</span>
            </>
          ) : (
            <span className="text-[var(--erro)]">
              {pronto.erro ?? "sem resposta"}
            </span>
          )}
        </div>

        {status.erro && (
          <div className="mt-3">
            <ErroBox mensagem={`EasyPanel: ${status.erro}`} />
          </div>
        )}
      </section>

      {/* Alertas */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Alertas</h2>
          <Link href="/fila" className="text-xs underline">
            Fila e entregas
          </Link>
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
          rotulo="Aprovacoes pendentes"
          valor={dados.aprovacoesPendentes}
        />
        <Metrica
          rotulo="Tempo de resposta (mediana)"
          valor={formatarDuracao(tempos.resumo.medianaTotalS)}
          detalhe={`90% em ate ${formatarDuracao(tempos.resumo.p90TotalS)} (${tempos.resumo.amostras} msgs)`}
        />
        <Metrica
          rotulo="Respostas enviadas (24 h)"
          valor={saude.saidas.enviadas24h}
          detalhe={`${saude.atalhos24h} respondida(s) pelo atalho`}
        />
        <Metrica
          rotulo="Respostas paradas"
          valor={saude.saidas.paradas.total}
          detalhe="sem envio ha mais de 1 h"
          tom={saude.saidas.paradas.total > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Reservas vencidas"
          valor={dados.leasesVencidas}
          detalhe="pedido em execucao sem worker"
          tom={dados.leasesVencidas > 0 ? "etiqueta-erro" : undefined}
        />
      </section>

      {/* Aprovacoes */}
      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Aprovacoes aguardando</h2>
        </div>
        {aprovacoes.length === 0 ? (
          <Vazio>Nenhuma aprovacao pendente.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Acao</th>
                  <th>Alvo</th>
                  <th>Status</th>
                  <th>Expira</th>
                  <th>Criada</th>
                </tr>
              </thead>
              <tbody>
                {aprovacoes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.acao ?? "—"}</td>
                    <td className="mono truncar">{a.alvo ?? a.descricao}</td>
                    <td>
                      <Etiqueta status={a.status} />
                    </td>
                    <td className="text-xs">{dataHora(a.expira_em)}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(a.criado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tarefas recentes */}
      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Tarefas recentes</h2>
        </div>
        {tarefas.length === 0 ? (
          <Vazio>Nenhuma tarefa registrada.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Objetivo</th>
                  <th>Status</th>
                  <th>Etapa</th>
                  <th>Atualizada</th>
                </tr>
              </thead>
              <tbody>
                {tarefas.map((t) => (
                  <tr key={t.id}>
                    <td className="truncar">{t.objetivo}</td>
                    <td>
                      <Etiqueta status={t.status} />
                    </td>
                    <td className="text-xs">{t.etapa_atual ?? "—"}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(t.atualizado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Mensagens recentes */}
      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Mensagens recentes</h2>
        </div>
        {mensagens.length === 0 ? (
          <Vazio>Nenhuma mensagem recebida.</Vazio>
        ) : (
          <ul className="divide-y">
            {mensagens.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {telefoneDoJid(m.de)}
                  </span>
                  <span className="text-xs text-[var(--texto-tenue)]">
                    {tempoRelativo(m.criado_em)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--texto-fraco)]">
                  {m.texto}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Logs */}
      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Logs do servico</h2>
          <p className="text-xs text-[var(--texto-tenue)]">
            Somente leitura. O painel nao reinicia nem implanta.
          </p>
        </div>
        {logs.erro ? (
          <div className="p-4">
            <ErroBox mensagem={logs.erro} />
          </div>
        ) : logs.linhas.length === 0 ? (
          <Vazio>Nenhum log disponivel.</Vazio>
        ) : (
          <pre className="max-h-80 overflow-auto p-4 text-xs leading-relaxed text-[var(--texto-fraco)]">
            {logs.linhas.join("\n")}
          </pre>
        )}
      </section>

      {/* Referencia de status, para quem olha a tabela pela primeira vez */}
      <section className="cartao p-4 text-xs text-[var(--texto-tenue)]">
        <span className="cartao-titulo">Estados possiveis</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...STATUS_TAREFA, ...STATUS_ENTRADA, ...STATUS_SAIDA].map((s) => (
            <Etiqueta key={s} status={s} />
          ))}
        </div>
      </section>
    </LayoutPainel>
  );
}
