import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import { lerPagina, paginar } from "@/lib/paginacao";
import { listarAuditoria } from "@/lib/queries";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { Paginacao } from "@/components/paginacao";
import {
  Metrica,
  Tempo,
  Vazio,
  duracaoMs,
  textoTruncado,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  resultado?: string;
  periodo?: string;
  pagina?: string;
};

/** Quantos registros uma consulta carrega. Acima disso, o filtro de periodo ajuda. */
const LIMITE_DE_CARGA = 300;

const RESULTADOS = [
  { valor: "", rotulo: "Todos" },
  { valor: "sucesso", rotulo: "Sucesso" },
  { valor: "erro", rotulo: "Erro" },
  { valor: "bloqueado", rotulo: "Bloqueado" },
  { valor: "aprovado", rotulo: "Aprovado" },
];

function desdeDoPeriodo(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  const mapa: Record<string, number> = {
    "24h": 86400_000,
    "7d": 7 * 86400_000,
    "30d": 30 * 86400_000,
  };
  const delta = mapa[bruto];
  return delta ? new Date(Date.now() - delta).toISOString() : undefined;
}

/** Cor do resultado. Resultado desconhecido fica neutro, sem "?" de erro de schema. */
function classeDoResultado(resultado: string | null): string {
  switch (resultado) {
    case "sucesso":
      return "etiqueta-ok";
    case "erro":
      return "etiqueta-erro";
    case "bloqueado":
      return "etiqueta-alerta";
    case "aprovado":
      return "etiqueta-info";
    default:
      return "etiqueta-neutra";
  }
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
    limite: LIMITE_DE_CARGA,
  });

  const pg = paginar(registros, lerPagina(busca.pagina), {
    teto: LIMITE_DE_CARGA,
  });

  const comAprovacao = registros.filter((r) => r.aguardou_aprovacao).length;
  const comErro = registros.filter(
    (r) => r.resultado && r.resultado !== "sucesso",
  ).length;
  const comDuracao = registros.filter((r) => r.duracao_ms !== null);
  const duracaoMedia =
    comDuracao.length === 0
      ? null
      : comDuracao.reduce((acc, r) => acc + (r.duracao_ms ?? 0), 0) /
        comDuracao.length;

  const filtrando = Boolean(busca.resultado || busca.periodo);

  return (
    <LayoutPainel usuario={usuario} ativo="/auditoria">
      <Cabecalho
        titulo="Auditoria"
        descricao="Tudo o que o agente executou, com resultado e duração. Registro somente de leitura."
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica
          rotulo="Registros no filtro"
          valor={registros.length}
          detalhe={
            pg.truncado ? `limite de ${LIMITE_DE_CARGA} atingido` : undefined
          }
          tom={pg.truncado ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Não bem-sucedidos"
          valor={comErro}
          tom={comErro > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica rotulo="Aguardaram aprovação" valor={comAprovacao} />
        <Metrica rotulo="Duração média" valor={duracaoMs(duracaoMedia)} />
      </section>

      <form method="get" className="cartao barra-filtros">
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
            Período
          </label>
          <select
            id="periodo"
            name="periodo"
            className="campo"
            defaultValue={busca.periodo ?? ""}
          >
            <option value="">Tudo</option>
            <option value="24h">Últimas 24 h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>

        <button type="submit" className="botao botao-primario">
          Filtrar
        </button>
        {filtrando && (
          <Link href="/auditoria" className="botao">
            Limpar filtros
          </Link>
        )}
      </form>

      <section id="registros" className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Registros</h2>
          <p>Mais recentes primeiro</p>
        </div>

        {pg.total === 0 ? (
          <Vazio>
            {filtrando
              ? "Nenhum registro com este filtro. Tente ampliar o período."
              : "Nenhuma ação registrada ainda."}
          </Vazio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Remetente</th>
                    <th>Comando</th>
                    <th>Ferramenta</th>
                    <th>Resultado</th>
                    <th className="col-numero">Duração</th>
                    <th>Aprovação</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.itens.map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={r.criado_em} />
                      </td>
                      <td className="mono text-xs">{r.remetente ?? "—"}</td>
                      <td
                        className="truncar text-[0.8125rem]"
                        title={r.comando ?? undefined}
                      >
                        {textoTruncado(r.comando, 140)}
                      </td>
                      <td className="mono text-xs">
                        {r.ferramenta ?? r.skill ?? "—"}
                      </td>
                      <td>
                        {r.resultado ? (
                          <span
                            className={`etiqueta ${classeDoResultado(r.resultado)}`}
                          >
                            {r.resultado}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="mono col-numero text-xs">
                        {duracaoMs(r.duracao_ms)}
                      </td>
                      <td>
                        {r.aguardou_aprovacao ? (
                          <span className="etiqueta etiqueta-alerta">
                            aguardou
                          </span>
                        ) : (
                          <span className="text-[var(--texto-tenue)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={pg}
              caminho="/auditoria"
              params={busca}
              ancora="registros"
            />
          </>
        )}
      </section>
    </LayoutPainel>
  );
}
