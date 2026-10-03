import { exigirAcesso } from "@/lib/auth";
import { listarAuditoria } from "@/lib/queries";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  Metrica,
  Vazio,
  dataHora,
  tempoRelativo,
  textoTruncado,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  resultado?: string;
  periodo?: string;
};

const RESULTADOS = [
  { valor: "", rotulo: "Todos" },
  { valor: "sucesso", rotulo: "Sucesso" },
  { valor: "erro", rotulo: "Erro" },
  { valor: "bloqueado", rotulo: "Bloqueado" },
  { valor: "aprovado", rotulo: "Aprovado" },
];

function desdeDoPeriodo(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  const agora = Date.now();
  const mapa: Record<string, number> = {
    "24h": 86400_000,
    "7d": 7 * 86400_000,
    "30d": 30 * 86400_000,
  };
  const delta = mapa[bruto];
  return delta ? new Date(agora - delta).toISOString() : undefined;
}

/**
 * Auditoria: registro append-only de tudo que o agente fez.
 *
 * So leitura, como o resto. Nao ha acao aqui.
 */
export default async function PaginaAuditoria({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;

  const registros = await listarAuditoria({
    status: busca.resultado || undefined,
    desde: desdeDoPeriodo(busca.periodo),
    limite: 300,
  });

  const comAprovacao = registros.filter((r) => r.aguardou_aprovacao).length;
  const comErro = registros.filter(
    (r) => r.resultado && r.resultado !== "sucesso",
  ).length;
  const duracaoMedia =
    registros
      .filter((r) => r.duracao_ms !== null)
      .reduce((acc, r) => acc + (r.duracao_ms ?? 0), 0) /
    Math.max(1, registros.filter((r) => r.duracao_ms !== null).length);

  return (
    <LayoutPainel usuario={usuario} ativo="/auditoria">
      <Cabecalho
        titulo="Auditoria"
        descricao="Acoes executadas pelo agente, com resultado e duracao."
        acoes={
          <span className="etiqueta etiqueta-neutra">Somente leitura</span>
        }
      />

      <section className="grid grid-cols-3 gap-3">
        <Metrica rotulo="Registros no filtro" valor={registros.length} />
        <Metrica
          rotulo="Nao bem-sucedidos"
          valor={comErro}
          tom={comErro > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Duracao media"
          valor={`${Math.round(duracaoMedia)} ms`}
        />
      </section>

      <form method="get" className="cartao flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="resultado" className="cartao-titulo">
            Resultado
          </label>
          <select
            id="resultado"
            name="resultado"
            className="campo"
            defaultValue={busca.resultado ?? ""}
          >
            {RESULTADOS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
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
            <option value="">Tudo</option>
            <option value="24h">24 h</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
          </select>
        </div>

        <button type="submit" className="botao botao-primario">
          Filtrar
        </button>
      </form>

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Registros</h2>
          {comAprovacao > 0 && (
            <p className="mt-1 text-xs text-[var(--texto-tenue)]">
              {comAprovacao} registro(s) aguardaram aprovacao humana.
            </p>
          )}
        </div>

        {registros.length === 0 ? (
          <Vazio>Nenhum registro neste filtro.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Remetente</th>
                  <th>Comando</th>
                  <th>Ferramenta</th>
                  <th>Resultado</th>
                  <th>Duracao</th>
                  <th>Aprovacao</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td
                      className="whitespace-nowrap text-xs"
                      title={dataHora(r.criado_em)}
                    >
                      {tempoRelativo(r.criado_em)}
                    </td>
                    <td className="mono text-xs">{r.remetente ?? "—"}</td>
                    <td className="truncar text-xs">
                      {textoTruncado(r.comando, 80)}
                    </td>
                    <td className="mono text-xs">
                      {r.ferramenta ?? r.skill ?? "—"}
                    </td>
                    <td className="text-xs">
                      <span
                        className={
                          r.resultado && r.resultado !== "sucesso"
                            ? "text-[var(--erro)]"
                            : "text-[var(--ok)]"
                        }
                      >
                        {r.resultado ?? "—"}
                      </span>
                    </td>
                    <td className="mono text-xs">
                      {r.duracao_ms !== null ? `${r.duracao_ms} ms` : "—"}
                    </td>
                    <td className="text-xs">
                      {r.aguardou_aprovacao ? (
                        <span className="text-[var(--alerta)]">sim</span>
                      ) : (
                        <span className="text-[var(--texto-tenue)]">nao</span>
                      )}
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
