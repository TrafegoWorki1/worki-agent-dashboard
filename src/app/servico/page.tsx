import { exigirAcesso } from "@/lib/auth";
import {
  healthDoServico,
  logsResumidos,
  prontidaoDoServico,
  statusServico,
} from "@/lib/easypanel";
import { lerPagina, paginar } from "@/lib/paginacao";
import { mensagemDeErroDoServico, valorEmVigor } from "@/lib/servico-parse";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { Paginacao } from "@/components/paginacao";
import { Aviso, ErroBox, Metrica, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = { p_parametros?: string };

function rotulo(v: boolean | null): string {
  return v === null ? "?" : v ? "ok" : "fora";
}

/** Dominio sem o esquema, para caber no cartao. */
function semEsquema(dominio: string | null): string {
  return dominio ? dominio.replace(/^https?:\/\//, "") : "—";
}

export default async function PaginaServico({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  const [status, health, pronto, logs] = await Promise.all([
    statusServico(),
    healthDoServico(),
    prontidaoDoServico(),
    logsResumidos(80),
  ]);

  const pgParametros = paginar(status.parametros, lerPagina(busca.p_parametros));

  return (
    <LayoutPainel usuario={usuario} ativo="/servico">
      <Cabecalho
        titulo="Serviço e worker"
        descricao="Estado do serviço no EasyPanel, versão no ar, prontidão e parâmetros do worker."
      />

      <Aviso>
        Somente leitura: este painel não implanta nem reinicia nada. Para isso,
        use o EasyPanel.
      </Aviso>

      {status.erro && (
        <ErroBox mensagem={`EasyPanel: ${mensagemDeErroDoServico(status.erro)}`} />
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica
          rotulo="Container habilitado"
          valor={status.habilitado === null ? "—" : status.habilitado ? "sim" : "não"}
          tom={status.habilitado ? "etiqueta-ok" : "etiqueta-erro"}
        />
        <Metrica
          rotulo="Endpoint /health"
          valor={health.ok ? "200 OK" : "erro"}
          tom={health.ok ? "etiqueta-ok" : "etiqueta-erro"}
          detalhe={health.latenciaMs !== null ? `${health.latenciaMs} ms` : undefined}
        />
        <Metrica
          rotulo="Prontidão (/ready)"
          valor={!pronto.alcancou ? "sem resposta" : pronto.pronto ? "pronto" : "não pronto"}
          detalhe="banco e worker de pé"
          tom={pronto.pronto ? "etiqueta-ok" : "etiqueta-erro"}
        />
        <Metrica
          rotulo="Supabase / Worker"
          valor={`${rotulo(pronto.supabase)} / ${rotulo(pronto.worker)}`}
          detalhe="o /health não mostra isso"
          tom={pronto.supabase && pronto.worker ? "etiqueta-ok" : "etiqueta-erro"}
        />
        <Metrica
          rotulo="Evolution"
          valor={rotulo(pronto.evolution)}
          detalhe="URL configurada no serviço"
        />
        <Metrica
          rotulo="Latência do /ready"
          valor={pronto.latenciaMs !== null ? `${pronto.latenciaMs} ms` : "—"}
        />
        <div className="cartao metrica col-span-2">
          <div className="cartao-titulo">Domínio</div>
          <div className="mt-1 break-all text-sm font-medium">{semEsquema(status.dominio)}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="cartao p-5">
          <div className="cartao-titulo">Versão no ar</div>
          {status.commit ? (
            <dl className="mt-3 text-sm">
              <Linha rotulo="Commit">
                <span className="mono text-xs">{status.commit.hashCurto}</span>
              </Linha>
              <Linha rotulo="Data">
                <span className="mono text-xs">{status.commit.data ?? "—"}</span>
              </Linha>
              <Linha rotulo="Mensagem">
                <span className="text-xs">{status.commit.mensagem || "—"}</span>
              </Linha>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-[var(--texto-tenue)]">
              Commit indisponível (integração com o EasyPanel fora do ar).
            </p>
          )}
        </div>

        <div className="cartao p-5">
          <div className="cartao-titulo">Configuração</div>
          <dl className="mt-3 text-sm">
            <Linha rotulo="Repositório">
              <span className="mono break-all text-xs">{status.repositorio ?? "—"}</span>
            </Linha>
            <Linha rotulo="Branch">
              <span className="mono text-xs">{status.branch ?? "—"}</span>
            </Linha>
            <Linha rotulo="Porta interna">
              <span className="mono text-xs">{status.porta ?? "—"}</span>
            </Linha>
            <Linha rotulo="Limites">
              <span className="mono text-xs">
                {status.cpu ?? "—"} CPU / {status.memoriaMb ?? "—"} MB
              </span>
            </Linha>
          </dl>
        </div>
      </section>

      {pgParametros.total > 0 && (
        <section id="parametros" className="cartao overflow-hidden">
          <div className="cartao-cabecalho">
            <h2>Parâmetros do worker</h2>
            <p>
              Só comportamento (tempos, limites, atalhos). Credenciais e
              endereços nunca aparecem. Sem valor definido, vale o padrão do código.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Parâmetro</th>
                  <th>Em vigor</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {pgParametros.itens.map((p) => (
                  <tr key={p.chave}>
                    <td>
                      <div>{p.rotulo}</div>
                      <div className="mono text-xs text-[var(--texto-tenue)]">{p.chave}</div>
                    </td>
                    <td className="mono">{valorEmVigor(p)}</td>
                    <td>
                      <span
                        className={`etiqueta ${p.valor === null ? "etiqueta-neutra" : "etiqueta-info"}`}
                      >
                        {p.valor === null ? "padrão do código" : "definido no serviço"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao
            pagina={pgParametros}
            caminho="/servico"
            params={busca}
            nome="p_parametros"
            ancora="parametros"
            rotulo="parâmetros"
          />
        </section>
      )}

      {health.erro && (
        <ErroBox mensagem={`Health check: ${mensagemDeErroDoServico(health.erro)}`} />
      )}

      <section className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Resposta do /health</h2>
          <p>O que o próprio serviço diz de si</p>
        </div>
        <div className="p-4">
          <HealthLegivel corpo={health.corpo} />
        </div>
      </section>

      <section id="logs" className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Logs</h2>
          <p>Tokens e credenciais são mascarados antes de exibir. Últimas 80 linhas.</p>
        </div>
        {logs.erro ? (
          <div className="p-4">
            <ErroBox mensagem={logs.erro} />
          </div>
        ) : logs.linhas.length === 0 ? (
          <Vazio>Nenhum log disponível.</Vazio>
        ) : (
          <pre className="mono max-h-[32rem] overflow-auto p-4 text-xs leading-relaxed text-[var(--texto-fraco)]">
            {logs.linhas.join("\n")}
          </pre>
        )}
      </section>
    </LayoutPainel>
  );
}

function Linha({ rotulo: r, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-[var(--borda)] py-2">
      <dt className="shrink-0 text-[var(--texto-fraco)]">{r}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

/**
 * /health como lista de pares chave-valor em vez de JSON cru. Valores que nao
 * sao simples (objeto, lista) continuam em JSON, so que dentro da celula.
 */
function HealthLegivel({ corpo }: { corpo: unknown }) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return <p className="text-sm text-[var(--texto-tenue)]">Sem corpo na resposta.</p>;
  }
  const pares = Object.entries(corpo as Record<string, unknown>);
  if (pares.length === 0) {
    return <p className="text-sm text-[var(--texto-tenue)]">Resposta vazia.</p>;
  }
  return (
    <dl className="text-sm">
      {pares.map(([k, v]) => (
        <Linha key={k} rotulo={k}>
          {typeof v === "boolean" ? (
            <span className={`etiqueta ${v ? "etiqueta-ok" : "etiqueta-erro"}`}>
              {v ? "sim" : "não"}
            </span>
          ) : typeof v === "object" && v !== null ? (
            <span className="mono text-xs">{JSON.stringify(v)}</span>
          ) : (
            <span className="mono text-xs">{String(v)}</span>
          )}
        </Linha>
      ))}
    </dl>
  );
}
