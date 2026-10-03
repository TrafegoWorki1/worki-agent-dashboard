import { exigirAcesso } from "@/lib/auth";
import {
  healthDoServico,
  logsResumidos,
  prontidaoDoServico,
  statusServico,
} from "@/lib/easypanel";
import { valorEmVigor } from "@/lib/servico-parse";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { ErroBox, Metrica, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";

function rotulo(v: boolean | null): string {
  return v === null ? "?" : v ? "ok" : "fora";
}

export default async function PaginaServico() {
  const usuario = await exigirAcesso();

  const [status, health, pronto, logs] = await Promise.all([
    statusServico(),
    healthDoServico(),
    prontidaoDoServico(),
    logsResumidos(80),
  ]);

  return (
    <LayoutPainel usuario={usuario} ativo="/servico">
      <Cabecalho
        titulo="Servico e worker"
        descricao="Estado do servico no EasyPanel, versao no ar, prontidao e parametros do worker."
        acoes={
          <span className="etiqueta etiqueta-neutra">
            Somente leitura — o painel nao implanta nem reinicia
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica
          rotulo="Container habilitado"
          valor={
            status.habilitado === null ? "—" : status.habilitado ? "sim" : "nao"
          }
          tom={status.habilitado ? "etiqueta-ok" : "etiqueta-erro"}
        />
        <Metrica
          rotulo="Endpoint /health"
          valor={health.ok ? "200" : "erro"}
          tom={health.ok ? "etiqueta-ok" : "etiqueta-erro"}
        />
        <Metrica
          rotulo="Latencia"
          valor={health.latenciaMs !== null ? `${health.latenciaMs} ms` : "—"}
        />
        <Metrica rotulo="Dominio" valor={status.dominio ?? "—"} />
        <Metrica
          rotulo="Prontidao (/ready)"
          valor={!pronto.alcancou ? "sem resposta" : pronto.pronto ? "pronto" : "nao pronto"}
          detalhe="banco e worker de pe"
          tom={pronto.pronto ? "etiqueta-ok" : "etiqueta-erro"}
        />
        <Metrica
          rotulo="Supabase / Worker"
          valor={`${rotulo(pronto.supabase)} / ${rotulo(pronto.worker)}`}
          detalhe="o /health nao mostra isso"
          tom={pronto.supabase && pronto.worker ? "etiqueta-ok" : "etiqueta-erro"}
        />
        <Metrica
          rotulo="Evolution"
          valor={rotulo(pronto.evolution)}
          detalhe="URL configurada no servico"
        />
        <Metrica
          rotulo="Latencia do /ready"
          valor={pronto.latenciaMs !== null ? `${pronto.latenciaMs} ms` : "—"}
        />
      </section>

      <section className="cartao p-4">
        <div className="cartao-titulo">Versao no ar</div>
        {status.commit ? (
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b py-1.5">
              <dt className="text-[var(--texto-fraco)]">Commit</dt>
              <dd className="mono text-xs">{status.commit.hashCurto}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1.5">
              <dt className="text-[var(--texto-fraco)]">Data</dt>
              <dd className="mono truncate text-xs">{status.commit.data ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b py-1.5 sm:col-span-2">
              <dt className="text-[var(--texto-fraco)]">Mensagem</dt>
              <dd className="truncate text-xs">{status.commit.mensagem || "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--texto-tenue)]">
            Commit nao disponivel (integracao com o EasyPanel indisponivel).
          </p>
        )}
      </section>

      {status.parametros.length > 0 && (
        <section className="cartao overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Parametros do worker</h2>
            <p className="text-xs text-[var(--texto-tenue)]">
              Somente comportamento (tempos, limites, atalhos). Credenciais e
              enderecos nunca aparecem aqui. Valor em vigor; quando a variavel
              nao esta definida, vale o padrao do codigo.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Parametro</th>
                  <th>Em vigor</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {status.parametros.map((p) => (
                  <tr key={p.chave}>
                    <td>
                      <div>{p.rotulo}</div>
                      <div className="mono text-xs text-[var(--texto-tenue)]">{p.chave}</div>
                    </td>
                    <td className="mono">{valorEmVigor(p)}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {p.valor === null ? "padrao do codigo" : "definido no servico"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="cartao p-4">
        <div className="cartao-titulo">Configuracao</div>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b py-1.5">
            <dt className="text-[var(--texto-fraco)]">Repositorio</dt>
            <dd className="mono truncate text-xs">
              {status.repositorio ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b py-1.5">
            <dt className="text-[var(--texto-fraco)]">Branch</dt>
            <dd className="mono truncate text-xs">{status.branch ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b py-1.5">
            <dt className="text-[var(--texto-fraco)]">Porta interna</dt>
            <dd className="mono text-xs">{status.porta ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b py-1.5">
            <dt className="text-[var(--texto-fraco)]">Limites</dt>
            <dd className="mono text-xs">
              {status.cpu ?? "—"} CPU / {status.memoriaMb ?? "—"} MB
            </dd>
          </div>
        </dl>
      </section>

      {health.erro && <ErroBox mensagem={`Health check: ${health.erro}`} />}

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Resposta do /health</h2>
        </div>
        <div className="p-4">
          <pre className="mono text-xs text-[var(--texto-fraco)]">
            {JSON.stringify(health.corpo, null, 2) ?? "sem corpo"}
          </pre>
        </div>
      </section>

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Logs</h2>
          <p className="text-xs text-[var(--texto-tenue)]">
            Tokens e credenciais sao mascarados antes de exibir.
          </p>
        </div>
        {logs.erro ? (
          <div className="p-4">
            <ErroBox mensagem={logs.erro} />
          </div>
        ) : logs.linhas.length === 0 ? (
          <Vazio>Nenhum log disponivel.</Vazio>
        ) : (
          <pre className="max-h-[32rem] overflow-auto p-4 text-xs leading-relaxed text-[var(--texto-fraco)]">
            {logs.linhas.join("\n")}
          </pre>
        )}
      </section>
    </LayoutPainel>
  );
}
