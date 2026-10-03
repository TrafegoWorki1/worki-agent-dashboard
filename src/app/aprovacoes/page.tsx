import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import { lerPagina, paginar } from "@/lib/paginacao";
import { listarAprovacoes } from "@/lib/queries";

import { AprovarAcao } from "@/components/aprovar";
import { Cabecalho, LayoutPainel } from "@/components/layout";
import { Paginacao } from "@/components/paginacao";
import {
  Aviso,
  Etiqueta,
  Metrica,
  Tempo,
  Vazio,
  dataHora,
  idCurto,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  status?: string;
  conversa?: string;
  pagina?: string;
};

const LIMITE_DE_CARGA = 200;

/**
 * "Em aberto" e o que a consulta devolve sem filtro (aguardando + confirmada).
 * Antes essa aba se chamava "Todas", o que enganava: ela nao mostrava expiradas.
 */
const ABAS = [
  { valor: "", rotulo: "Em aberto" },
  { valor: "aguardando", rotulo: "Aguardando" },
  { valor: "confirmada", rotulo: "Confirmadas" },
  { valor: "consumida", rotulo: "Consumidas" },
  { valor: "expirada", rotulo: "Expiradas" },
];

function hrefAba(busca: Busca, status: string): string {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (busca.conversa) q.set("conversa", busca.conversa);
  const texto = q.toString();
  return texto ? `/aprovacoes?${texto}` : "/aprovacoes";
}

function estaExpirada(expiraEm: string): boolean {
  const t = new Date(expiraEm).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export default async function PaginaAprovacoes({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  const aprovacoes = await listarAprovacoes({
    status: busca.status || undefined,
    conversaId: busca.conversa || undefined,
    limite: LIMITE_DE_CARGA,
  });

  const pg = paginar(aprovacoes, lerPagina(busca.pagina), {
    teto: LIMITE_DE_CARGA,
  });

  const aguardando = aprovacoes.filter((a) => a.status === "aguardando");
  const expiradas = aprovacoes.filter((a) => a.status === "expirada");
  const semConversa = aguardando.filter((a) => !a.conversa_id);

  return (
    <LayoutPainel usuario={usuario} ativo="/aprovacoes">
      <Cabecalho
        titulo="Aprovações"
        descricao="Ações que exigem confirmação humana antes de executar."
      />

      <Aviso>
        Aprovar <strong>registra a autorização</strong>. Quem executa a ação é o
        worker, na sequência — este painel não executa nada.
      </Aviso>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metrica
          rotulo="Aguardando decisão"
          valor={aguardando.length}
          tom={aguardando.length > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Expiradas"
          valor={expiradas.length}
          tom={expiradas.length > 0 ? "etiqueta-erro" : undefined}
        />
        <Metrica
          rotulo="Sem conversa definida"
          valor={semConversa.length}
          detalhe="não podem ser aprovadas por aqui"
          tom={semConversa.length > 0 ? "etiqueta-alerta" : undefined}
        />
      </section>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="cartao-titulo">Status</span>
          <div className="abas" role="group" aria-label="Status da aprovação">
            {ABAS.map((a) => (
              <Link
                key={a.valor}
                href={hrefAba(busca, a.valor)}
                className={`aba ${(busca.status ?? "") === a.valor ? "aba-ativa" : ""}`}
              >
                {a.rotulo}
              </Link>
            ))}
          </div>
        </div>

        <form method="get" className="flex items-end gap-2">
          {busca.status && <input type="hidden" name="status" value={busca.status} />}
          <div className="flex flex-col gap-1">
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
          <button type="submit" className="botao">
            Filtrar
          </button>
          {busca.conversa && (
            <Link href={hrefAba({}, busca.status ?? "")} className="botao">
              Limpar
            </Link>
          )}
        </form>
      </div>

      <section id="lista" className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Ações</h2>
          <p>Mais recentes primeiro</p>
        </div>

        {pg.total === 0 ? (
          <Vazio>
            {(busca.status ?? "") === ""
              ? "Nenhuma ação esperando decisão. Veja “Consumidas” e “Expiradas” para o histórico."
              : "Nenhuma aprovação neste filtro."}
          </Vazio>
        ) : (
          <>
            <ul className="divide-y divide-[var(--borda)]">
              {pg.itens.map((a) => {
                const expirada = a.expira_em ? estaExpirada(a.expira_em) : false;
                return (
                  <li key={a.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {a.acao ?? "ação sem nome"}
                          </span>
                          <Etiqueta status={a.status} contexto="acao" />
                          <span className="mono text-xs text-[var(--texto-tenue)]">
                            #{a.id}
                          </span>
                        </div>

                        {a.descricao && (
                          <p className="mt-1 text-sm text-[var(--texto-fraco)]">
                            {a.descricao}
                          </p>
                        )}

                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--texto-tenue)]">
                          {a.alvo && <div className="mono">alvo: {a.alvo}</div>}
                          <div className="mono">conversa: {idCurto(a.conversa_id)}</div>
                          {a.aprovador && (
                            <div className="mono">aprovador: {a.aprovador}</div>
                          )}
                          <div>
                            criada <Tempo iso={a.criado_em} />
                          </div>
                          {a.expira_em && (
                            <div className={expirada ? "text-[var(--erro)]" : ""}>
                              {expirada ? "expirou" : "expira"} {dataHora(a.expira_em)}
                            </div>
                          )}
                        </dl>

                        {a.payload && Object.keys(a.payload).length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-[var(--acento)]">
                              Ver detalhes da ação
                            </summary>
                            <pre className="mono mt-1 max-h-40 overflow-auto rounded-lg bg-[var(--superficie-2)] p-3 text-xs">
                              {JSON.stringify(a.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>

                      <AprovarAcao
                        acaoId={a.id}
                        acao={a.acao}
                        conversaId={a.conversa_id}
                        status={a.status}
                        expirada={expirada}
                        aprovador={usuario.email}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <Paginacao
              pagina={pg}
              caminho="/aprovacoes"
              params={busca}
              ancora="lista"
              rotulo="ações"
            />
          </>
        )}
      </section>
    </LayoutPainel>
  );
}
