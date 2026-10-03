import { exigirAcesso } from "@/lib/auth";
import { etapasDe, listarSaidas, listarTarefas } from "@/lib/queries";
import { STATUS_TAREFA } from "@/lib/tipos";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  ErroBox,
  Etiqueta,
  Metrica,
  Vazio,
  dataHora,
  idCurto,
  tempoRelativo,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  status?: string;
  projeto?: string;
  tarefa?: string;
};

const ABAS = [
  { valor: "ativa", rotulo: "Ativas" },
  { valor: "bloqueada", rotulo: "Bloqueadas" },
  { valor: "concluida", rotulo: "Concluidas" },
  { valor: "falhou", rotulo: "Falharam" },
  { valor: "", rotulo: "Todas" },
];

export default async function PaginaTarefas({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  const status = busca.status ?? "ativa";

  const [tarefas, saidas] = await Promise.all([
    listarTarefas({
      status: status || undefined,
      projetoId: busca.projeto,
      limite: 100,
    }),
    listarSaidas({ limite: 25 }),
  ]);

  // Etapas so para a tarefa selecionada: buscar todas seria N+1.
  const selecionada = busca.tarefa
    ? (tarefas.find((t) => t.id === busca.tarefa) ?? null)
    : null;
  const etapas = selecionada ? await etapasDe(selecionada.id) : [];

  const ativas = tarefas.filter((t) => t.status === "ativa").length;
  const bloqueadas = tarefas.filter((t) => t.status === "bloqueada").length;
  const incertas = saidas.filter((s) => s.status === "incerto").length;

  return (
    <LayoutPainel usuario={usuario} ativo="/tarefas">
      <Cabecalho
        titulo="Tarefas"
        descricao="Etapas, checkpoints, proxima acao e resultado de cada execucao."
      />

      <section className="grid grid-cols-3 gap-3">
        <Metrica rotulo="Ativas no filtro" valor={ativas} />
        <Metrica
          rotulo="Bloqueadas no filtro"
          valor={bloqueadas}
          tom={bloqueadas > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Saidas incertas"
          valor={incertas}
          tom={incertas > 0 ? "etiqueta-erro" : undefined}
        />
      </section>

      <form method="get" className="cartao flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="cartao-titulo">
            Status
          </label>
          <select
            id="status"
            name="status"
            className="campo"
            defaultValue={status}
          >
            {ABAS.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </div>

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

        <button type="submit" className="botao botao-primario">
          Filtrar
        </button>
      </form>

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Tarefas</h2>
        </div>

        {tarefas.length === 0 ? (
          <Vazio>Nenhuma tarefa com esse filtro.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Objetivo</th>
                  <th>Status</th>
                  <th>Etapa</th>
                  <th>Projeto</th>
                  <th>Atualizada</th>
                  <th />
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
                    <td className="mono text-xs">{t.projeto_id ?? "—"}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(t.atualizado_em)}
                    </td>
                    <td>
                      <a
                        href={`?status=${status}&tarefa=${t.id}`}
                        className="text-xs text-[var(--acento)] hover:underline"
                      >
                        etapas
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selecionada && (
        <section className="space-y-3">
          <div className="cartao p-4">
            <div className="cartao-titulo">
              Tarefa {idCurto(selecionada.id)}
            </div>
            <p className="mt-1 text-sm">{selecionada.objetivo}</p>
            <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b py-1">
                <dt className="text-[var(--texto-fraco)]">Status</dt>
                <dd>
                  <Etiqueta status={selecionada.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b py-1">
                <dt className="text-[var(--texto-fraco)]">Etapa atual</dt>
                <dd className="text-xs">{selecionada.etapa_atual ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b py-1">
                <dt className="text-[var(--texto-fraco)]">Proxima acao</dt>
                <dd className="truncate text-xs">
                  {selecionada.proxima_acao ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b py-1">
                <dt className="text-[var(--texto-fraco)]">Atualizada</dt>
                <dd className="text-xs">
                  {dataHora(selecionada.atualizado_em)}
                </dd>
              </div>
            </dl>

            {selecionada.checkpoint &&
              Object.keys(selecionada.checkpoint).length > 0 && (
                <div className="mt-3">
                  <div className="cartao-titulo">Checkpoint</div>
                  <pre className="mono mt-1 max-h-48 overflow-auto rounded bg-[var(--superficie-2)] p-3 text-xs">
                    {JSON.stringify(selecionada.checkpoint, null, 2)}
                  </pre>
                </div>
              )}

            {selecionada.resultado && (
              <div className="mt-3">
                <div className="cartao-titulo">Resultado</div>
                <p className="mt-1 text-sm text-[var(--texto-fraco)]">
                  {selecionada.resultado}
                </p>
              </div>
            )}
          </div>

          <div className="cartao overflow-hidden">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Etapas</h3>
            </div>
            {etapas.length === 0 ? (
              <Vazio>Nenhuma etapa registrada.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Operacao</th>
                      <th>Status</th>
                      <th>ID externo</th>
                      <th>Evidencia</th>
                      <th>Atualizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etapas.map((e) => (
                      <tr key={e.id}>
                        <td className="mono text-xs">{e.chave_operacao}</td>
                        <td>
                          <Etiqueta status={e.status} />
                        </td>
                        <td className="mono text-xs">{e.external_id ?? "—"}</td>
                        <td className="truncar text-xs">
                          {e.evidencia ? JSON.stringify(e.evidencia) : "—"}
                        </td>
                        <td className="text-xs text-[var(--texto-tenue)]">
                          {tempoRelativo(e.atualizado_em)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Saidas recentes</h2>
          <p className="text-xs text-[var(--texto-tenue)]">
            `incerto` bloqueia as entregas seguintes da conversa ate
            reconciliacao.
          </p>
        </div>
        {saidas.length === 0 ? (
          <Vazio>Nenhuma saida registrada.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Destino</th>
                  <th>Texto</th>
                  <th>Status</th>
                  <th>Tentativas</th>
                  <th>Criada</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((s) => (
                  <tr key={s.id}>
                    <td className="text-xs">{s.chat_jid}</td>
                    <td className="truncar">{s.texto}</td>
                    <td>
                      <Etiqueta status={s.status} />
                    </td>
                    <td className="mono text-xs">{s.tentativas}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(s.criado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {tarefas.some((t) =>
        (STATUS_TAREFA as readonly string[]).includes(t.status),
      ) === false && (
        <ErroBox mensagem="Ha tarefas com status fora da lista conhecida. O backend mudou o schema?" />
      )}
    </LayoutPainel>
  );
}
