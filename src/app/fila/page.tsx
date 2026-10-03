import { exigirAcesso } from "@/lib/auth";
import { formatarDuracao } from "@/lib/fila";
import { listarSaidas, saudeDaFila, temposDeResposta } from "@/lib/queries";
import { STATUS_SAIDA } from "@/lib/tipos";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import {
  Etiqueta,
  ListaAlertas,
  Metrica,
  Vazio,
  dataHora,
  idCurto,
  textoTruncado,
  tempoRelativo,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = { status?: string };

export default async function PaginaFila({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirAcesso();
  const busca = await searchParams;
  const status = (STATUS_SAIDA as readonly string[]).includes(busca.status ?? "")
    ? busca.status
    : undefined;

  const [saude, tempos, saidas] = await Promise.all([
    saudeDaFila(),
    temposDeResposta(20),
    listarSaidas({ status, limite: 50 }),
  ]);
  const { resumo } = tempos;

  return (
    <LayoutPainel usuario={usuario} ativo="/fila">
      <Cabecalho
        titulo="Fila e entregas"
        descricao="Quanto o agente demora para responder, e se as respostas estao saindo."
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Alertas</h2>
        <ListaAlertas alertas={saude.alertas} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metrica
          rotulo="Respostas enviadas (24 h)"
          valor={saude.saidas.enviadas24h}
        />
        <Metrica rotulo="Em andamento" valor={saude.saidas.emAndamento} />
        <Metrica
          rotulo="Paradas ha mais de 1 h"
          valor={saude.saidas.paradas.total}
          detalhe="sem envio confirmado"
          tom={saude.saidas.paradas.total > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Falhas (24 h)"
          valor={saude.falhas24h}
          tom={saude.falhas24h > 0 ? "etiqueta-alerta" : undefined}
        />
        <Metrica
          rotulo="Atalho de andamento (24 h)"
          valor={saude.atalhos24h}
          detalhe={'"terminou?" respondido na hora'}
        />
      </section>

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Tempo de resposta</h2>
          <p className="text-xs text-[var(--texto-tenue)]">
            Ultimas {tempos.tempos.length} mensagens. Respostas do atalho de
            andamento ficam fora das medias: nao passam pelo Hermes e
            esconderiam a lentidao real.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b p-4 md:grid-cols-4">
          <Metrica
            rotulo="Mediana (total)"
            valor={formatarDuracao(resumo.medianaTotalS)}
            detalhe={`${resumo.amostras} mensagens medidas`}
          />
          <Metrica
            rotulo="90% respondem em ate"
            valor={formatarDuracao(resumo.p90TotalS)}
          />
          <Metrica
            rotulo="Espera na fila (mediana)"
            valor={formatarDuracao(resumo.medianaEsperaS)}
          />
          <Metrica
            rotulo="Hermes (mediana)"
            valor={formatarDuracao(resumo.medianaHermesS)}
          />
        </div>

        {tempos.tempos.length === 0 ? (
          <Vazio>Nenhuma mensagem registrada.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Mensagem</th>
                  <th>Chegou</th>
                  <th>Fila</th>
                  <th>Hermes</th>
                  <th>Envio</th>
                  <th>Total</th>
                  <th>Entrada</th>
                  <th>Saida</th>
                </tr>
              </thead>
              <tbody>
                {tempos.tempos.map((t) => (
                  <tr key={t.entradaId}>
                    <td className="truncar">{textoTruncado(t.texto, 50)}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(t.chegouEm)}
                    </td>
                    <td className="mono text-xs">
                      {formatarDuracao(t.esperaFilaS)}
                    </td>
                    <td className="mono text-xs">
                      {t.atalho ? "atalho" : formatarDuracao(t.hermesS)}
                    </td>
                    <td className="mono text-xs">
                      {formatarDuracao(t.envioS)}
                    </td>
                    <td className="mono text-xs">
                      {formatarDuracao(t.totalS)}
                    </td>
                    <td>
                      <Etiqueta status={t.statusEntrada} />
                    </td>
                    <td>
                      {t.statusSaida ? (
                        <Etiqueta status={t.statusSaida} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {saude.esperando.length > 0 && (
        <section className="cartao overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Mensagens esperando</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Entrada</th>
                  <th>Conversa</th>
                  <th>Esperando ha</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {saude.esperando.map((e) => (
                  <tr key={e.entradaId}>
                    <td className="mono text-xs">{idCurto(e.entradaId)}</td>
                    <td className="mono text-xs">{idCurto(e.conversaId)}</td>
                    <td className="mono text-xs">
                      {formatarDuracao(e.esperandoS)}
                    </td>
                    <td className="text-xs">
                      {e.motivo === "aguardando_anterior"
                        ? "aguardando o pedido anterior (normal)"
                        : "nenhum pedido em execucao (verificar)"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <form method="get" className="cartao flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="cartao-titulo">
            Status da saida
          </label>
          <select
            id="status"
            name="status"
            className="campo"
            defaultValue={status ?? ""}
          >
            <option value="">Todas</option>
            {STATUS_SAIDA.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="botao">
          Filtrar
        </button>
      </form>

      <section className="cartao overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Saidas (respostas ao WhatsApp)</h2>
        </div>
        {saidas.length === 0 ? (
          <Vazio>Nenhuma saida neste filtro.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Texto</th>
                  <th>Status</th>
                  <th>Tentativas</th>
                  <th>Criada</th>
                  <th>Enviada</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((s) => (
                  <tr key={s.id}>
                    <td className="truncar">{textoTruncado(s.texto, 60)}</td>
                    <td>
                      <Etiqueta status={s.status} />
                    </td>
                    <td className="mono text-xs">{s.tentativas}</td>
                    <td className="text-xs text-[var(--texto-tenue)]">
                      {tempoRelativo(s.criado_em)}
                    </td>
                    <td className="text-xs">{dataHora(s.enviado_em)}</td>
                    <td className="truncar text-xs">{s.ultimo_erro ?? "—"}</td>
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
