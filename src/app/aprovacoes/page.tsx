import { exigirAcesso } from "@/lib/auth";
import { listarAprovacoes } from "@/lib/queries";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  Etiqueta,
  Metrica,
  Vazio,
  dataHora,
  idCurto,
  tempoRelativo,
} from "@/components/ui";

import { AprovarAcao } from "@/components/aprovar";

export const dynamic = "force-dynamic";

export type Busca = {
  status?: string;
  conversa?: string;
};

const ABAS = [
  { valor: "", rotulo: "Todas" },
  { valor: "aguardando", rotulo: "Aguardando" },
  { valor: "confirmada", rotulo: "Confirmadas" },
  { valor: "consumida", rotulo: "Consumidas" },
  { valor: "expirada", rotulo: "Expiradas" },
];

export default async function PaginaAprovacoes({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  const aprovacoes = await listarAprovacoes({
    status: busca.status || undefined,
    conversaId: busca.conversa,
    limite: 200,
  });

  const aguardando = aprovacoes.filter((a) => a.status === "aguardando");
  const expiradas = aprovacoes.filter((a) => a.status === "expirada");
  const semConversa = aguardando.filter((a) => !a.conversa_id);

  return (
    <LayoutPainel usuario={usuario} ativo="/aprovacoes">
      <Cabecalho
        titulo="Aprovacoes"
        descricao="Acoes que exigem confirmacao humana antes de executar."
        acoes={
          <span className="etiqueta etiqueta-neutra">
            Aprovar registra a autorizacao — a execucao e do worker
          </span>
        }
      />

      <section className="grid grid-cols-3 gap-3">
        <Metrica rotulo="Aguardando" valor={aguardando.length} />
        <Metrica
          rotulo="Expiradas"
          valor={expiradas.length}
          tom={expiradas.length > 0 ? "etiqueta-erro" : undefined}
        />
        <Metrica
          rotulo="Sem conversa definida"
          valor={semConversa.length}
          detalhe="nao aprovaveis por conversa"
          tom={semConversa.length > 0 ? "etiqueta-alerta" : undefined}
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
            defaultValue={busca.status ?? ""}
          >
            {ABAS.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-64 flex-col gap-1">
          <label htmlFor="conversa" className="cartao-titulo">
            Conversa
          </label>
          <input
            id="conversa"
            name="conversa"
            className="campo"
            defaultValue={busca.conversa ?? ""}
            placeholder="id da conversa"
          />
        </div>

        <button type="submit" className="botao botao-primario">
          Filtrar
        </button>
      </form>

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Acoes pendentes</h2>
        </div>

        {aprovacoes.length === 0 ? (
          <Vazio>Nenhuma aprovacao neste filtro.</Vazio>
        ) : (
          <ul className="divide-y">
            {aprovacoes.map((a) => (
              <li key={a.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {a.acao ?? "acao sem nome"}
                      </span>
                      <Etiqueta status={a.status} />
                      <span className="mono text-xs text-[var(--texto-tenue)]">
                        #{a.id}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-[var(--texto-fraco)]">
                      {a.descricao}
                    </p>

                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--texto-tenue)]">
                      {a.alvo && (
                        <div>
                          <span className="mono">alvo: {a.alvo}</span>
                        </div>
                      )}
                      <div>
                        <span className="mono">
                          conversa: {idCurto(a.conversa_id)}
                        </span>
                      </div>
                      {a.aprovador && (
                        <div>
                          <span className="mono">aprovador: {a.aprovador}</span>
                        </div>
                      )}
                      <div>criada {tempoRelativo(a.criado_em)}</div>
                      {a.expira_em && (
                        <div
                          className={
                            estaExpirada(a.expira_em)
                              ? "text-[var(--erro)]"
                              : ""
                          }
                        >
                          expira {dataHora(a.expira_em)}
                        </div>
                      )}
                    </dl>

                    {a.payload && Object.keys(a.payload).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-[var(--acento)]">
                          Ver payload
                        </summary>
                        <pre className="mono mt-1 max-h-40 overflow-auto rounded bg-[var(--superficie-2)] p-2 text-xs">
                          {JSON.stringify(a.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  <AprovarAcao
                    acaoId={a.id}
                    conversaId={a.conversa_id}
                    status={a.status}
                    expirada={a.expira_em ? estaExpirada(a.expira_em) : false}
                    aprovador={usuario.email}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </LayoutPainel>
  );
}

function estaExpirada(expiraEm: string): boolean {
  const t = new Date(expiraEm).getTime();
  return !Number.isNaN(t) && t < Date.now();
}
