import { exigirAcesso } from "@/lib/auth";
import { healthDoServico, logsResumidos, statusServico } from "@/lib/easypanel";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { ErroBox, Metrica, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaginaServico() {
  const usuario = await exigirAcesso();

  const [status, health, logs] = await Promise.all([
    statusServico(),
    healthDoServico(),
    logsResumidos(80),
  ]);

  return (
    <LayoutPainel usuario={usuario} ativo="/servico">
      <Cabecalho
        titulo="Servico e worker"
        descricao="Estado do servico no EasyPanel e resposta do endpoint publico."
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
      </section>

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
