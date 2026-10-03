import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import { listarConversas, mensagensRecentes } from "@/lib/queries";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  ErroBox,
  Metrica,
  Vazio,
  dataHora,
  idCurto,
  telefoneDoJid,
  tempoRelativo,
} from "@/components/ui";

import { listarTarefas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export type Busca = {
  conversa?: string;
  periodo?: string;
};

function periodoDesde(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  const agora = Date.now();
  switch (bruto) {
    case "24h":
      return new Date(agora - 86400_000).toISOString();
    case "7d":
      return new Date(agora - 7 * 86400_000).toISOString();
    case "30d":
      return new Date(agora - 30 * 86400_000).toISOString();
    default:
      return undefined;
  }
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

  const desde = periodoDesde(busca.periodo);

  const conversas = await listarConversas({
    conversaId: busca.conversa,
    desde,
    limite: 100,
  });

  const comMensagem = busca.conversa
    ? await mensagensRecentes({ conversaId: busca.conversa, limite: 100 })
    : [];

  const tarefasDaConversa = busca.conversa
    ? await listarTarefas({ conversaId: busca.conversa, limite: 50 })
    : [];

  const selecionada = busca.conversa
    ? (conversas.find((c) => c.id === busca.conversa) ?? null)
    : null;

  return (
    <LayoutPainel usuario={usuario} ativo="/conversas">
      <Cabecalho
        titulo="Conversas"
        descricao="Sessoes vinculadas a conversa, mensagens recentes e tarefas relacionadas."
      />

      <section className="grid grid-cols-3 gap-3">
        <Metrica rotulo="Conversas no filtro" valor={conversas.length} />
        <Metrica rotulo="Mensagens exibidas" valor={comMensagem.length} />
        <Metrica
          rotulo="Tarefas na conversa"
          valor={tarefasDaConversa.length}
        />
      </section>

      {/* Filtros por GET: o estado fica na URL e a pagina continua server-side */}
      <form method="get" className="cartao flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="conversa" className="cartao-titulo">
            Conversa
          </label>
          <select
            id="conversa"
            name="conversa"
            className="campo min-w-64"
            defaultValue={busca.conversa ?? ""}
          >
            <option value="">Todas</option>
            {conversas.map((c) => (
              <option key={c.id} value={c.id}>
                {telefoneDoJid(c.chat_jid)} · {idCurto(c.id)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="periodo" className="cartao-titulo">
            Periodo
          </label>
          <select
            id="periodo"
            name="periodo"
            className="campo"
            defaultValue={busca.periodo ?? ""}
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="botao botao-primario">
          Filtrar
        </button>
        <Link href="/conversas" className="botao">
          Limpar
        </Link>
      </form>

      {selecionada ? (
        <section className="cartao p-4">
          <div className="cartao-titulo">Conversa selecionada</div>
          <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b py-1">
              <dt className="text-[var(--texto-fraco)]">Chat</dt>
              <dd className="text-xs">{telefoneDoJid(selecionada.chat_jid)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1">
              <dt className="text-[var(--texto-fraco)]">Participante</dt>
              <dd className="text-xs">
                {telefoneDoJid(selecionada.participante_jid)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1">
              <dt className="text-[var(--texto-fraco)]">Sessao do Hermes</dt>
              <dd className="mono truncate text-xs">
                {selecionada.session_id ? (
                  <span title={selecionada.session_id}>
                    {idCurto(selecionada.session_id)}
                  </span>
                ) : (
                  <span className="text-[var(--alerta)]">nao vinculada</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1">
              <dt className="text-[var(--texto-fraco)]">Atualizada</dt>
              <dd className="text-xs">{dataHora(selecionada.atualizado_em)}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <ErroBox mensagem="Selecione uma conversa para ver a sessao e as mensagens." />
      )}

      {selecionada && tarefasDaConversa.length > 0 && (
        <section className="cartao overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Tarefas da conversa</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Objetivo</th>
                  <th>Status</th>
                  <th>Etapa atual</th>
                  <th>Proxima acao</th>
                  <th>Atualizada</th>
                </tr>
              </thead>
              <tbody>
                {tarefasDaConversa.map((t) => (
                  <tr key={t.id}>
                    <td className="truncar">{t.objetivo}</td>
                    <td>{t.status}</td>
                    <td className="text-xs">{t.etapa_atual ?? "—"}</td>
                    <td className="truncar text-xs">{t.proxima_acao ?? "—"}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(t.atualizado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            {selecionada ? "Mensagens" : "Todas as conversas"}
          </h2>
        </div>

        {selecionada ? (
          comMensagem.length === 0 ? (
            <Vazio>Nenhuma mensagem nesta conversa.</Vazio>
          ) : (
            <ul className="divide-y">
              {comMensagem.map((m) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {telefoneDoJid(m.de)}
                    </span>
                    <span className="text-xs text-[var(--texto-tenue)]">
                      {dataHora(m.criado_em)} · {m.tipo_mensagem ?? "texto"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--texto-fraco)]">
                    {m.texto}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : conversas.length === 0 ? (
          <Vazio>Nenhuma conversa no periodo selecionado.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Chat</th>
                  <th>Participante</th>
                  <th>Sessao</th>
                  <th>Atualizada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {conversas.map((c) => (
                  <tr key={c.id}>
                    <td>{telefoneDoJid(c.chat_jid)}</td>
                    <td className="text-xs">
                      {telefoneDoJid(c.participante_jid)}
                    </td>
                    <td className="mono text-xs">
                      {c.session_id ? (
                        idCurto(c.session_id)
                      ) : (
                        <span className="text-[var(--alerta)]">—</span>
                      )}
                    </td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(c.atualizado_em)}
                    </td>
                    <td>
                      <Link
                        href={`/conversas?conversa=${c.id}${busca.periodo ? `&periodo=${busca.periodo}` : ""}`}
                        className="text-xs text-[var(--acento)] hover:underline"
                      >
                        abrir
                      </Link>
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
