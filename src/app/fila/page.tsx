import Link from "next/link";

import { exigirAcesso } from "@/lib/auth";
import { formatarDuracao } from "@/lib/fila";
import { lerPagina, paginar } from "@/lib/paginacao";
import { listarSaidas, saudeDaFila, temposDeResposta } from "@/lib/queries";
import { STATUS_SAIDA } from "@/lib/tipos";

import { Cabecalho, LayoutPainel } from "@/components/layout";
import { Paginacao } from "@/components/paginacao";
import {
  Etiqueta,
  ListaAlertas,
  Metrica,
  Tempo,
  Vazio,
  idCurto,
  dataHora,
  textoTruncado,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export type Busca = {
  status?: string;
  p_tempos?: string;
  p_espera?: string;
  p_saidas?: string;
};

const AMOSTRA_DE_TEMPOS = 50;
const LIMITE_DE_SAIDAS = 200;

function hrefStatus(status: string | undefined): string {
  return status ? `/fila?status=${status}#saidas` : "/fila#saidas";
}

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
    temposDeResposta(AMOSTRA_DE_TEMPOS),
    listarSaidas({ status, limite: LIMITE_DE_SAIDAS }),
  ]);
  const { resumo } = tempos;

  // Cada lista tem o seu parametro de pagina; os outros ficam na URL ao trocar.
  const parametros = { status, p_tempos: busca.p_tempos, p_espera: busca.p_espera, p_saidas: busca.p_saidas };
  const pgTempos = paginar(tempos.tempos, lerPagina(busca.p_tempos));
  const pgEspera = paginar(saude.esperando, lerPagina(busca.p_espera));
  const pgSaidas = paginar(saidas, lerPagina(busca.p_saidas), { teto: LIMITE_DE_SAIDAS });

  return (
    <LayoutPainel usuario={usuario} ativo="/fila">
      <Cabecalho
        titulo="Fila e entregas"
        descricao="Quanto o agente demora para responder e se as respostas estão chegando ao WhatsApp."
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold">Alertas</h2>
        <ListaAlertas alertas={saude.alertas} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metrica rotulo="Respostas enviadas (24 h)" valor={saude.saidas.enviadas24h} />
        <Metrica rotulo="Em andamento" valor={saude.saidas.emAndamento} />
        <Metrica
          rotulo="Paradas há mais de 1 h"
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

      <section id="tempos" className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Tempo de resposta</h2>
          <p>
            Últimas {tempos.tempos.length} mensagens. O atalho de andamento fica
            fora das médias: não passa pelo Hermes e esconderia a lentidão real.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-[var(--borda)] p-4 md:grid-cols-4">
          <Metrica
            rotulo="Mediana (total)"
            valor={formatarDuracao(resumo.medianaTotalS)}
            detalhe={`${resumo.amostras} mensagens medidas`}
          />
          <Metrica rotulo="90% respondem em até" valor={formatarDuracao(resumo.p90TotalS)} />
          <Metrica rotulo="Espera na fila (mediana)" valor={formatarDuracao(resumo.medianaEsperaS)} />
          <Metrica rotulo="Hermes (mediana)" valor={formatarDuracao(resumo.medianaHermesS)} />
        </div>

        {pgTempos.total === 0 ? (
          <Vazio>Nenhuma mensagem registrada.</Vazio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Mensagem</th>
                    <th>Chegou</th>
                    <th className="col-numero">Fila</th>
                    <th className="col-numero">Hermes</th>
                    <th className="col-numero">Envio</th>
                    <th className="col-numero">Total</th>
                    <th>Pedido</th>
                    <th>Resposta</th>
                  </tr>
                </thead>
                <tbody>
                  {pgTempos.itens.map((t) => (
                    <tr key={t.entradaId}>
                      <td className="truncar" title={t.texto}>
                        {textoTruncado(t.texto, 60)}
                      </td>
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={t.chegouEm} />
                      </td>
                      <td className="mono col-numero text-xs">{formatarDuracao(t.esperaFilaS)}</td>
                      <td className="mono col-numero text-xs">
                        {t.atalho ? "atalho" : formatarDuracao(t.hermesS)}
                      </td>
                      <td className="mono col-numero text-xs">{formatarDuracao(t.envioS)}</td>
                      <td className="mono col-numero text-xs font-semibold">
                        {formatarDuracao(t.totalS)}
                      </td>
                      <td>
                        <Etiqueta status={t.statusEntrada} />
                      </td>
                      <td>
                        {t.statusSaida ? (
                          <Etiqueta status={t.statusSaida} />
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
              pagina={pgTempos}
              caminho="/fila"
              params={parametros}
              nome="p_tempos"
              ancora="tempos"
              rotulo="mensagens"
            />
          </>
        )}
      </section>

      {pgEspera.total > 0 && (
        <section id="espera" className="cartao overflow-hidden">
          <div className="cartao-cabecalho">
            <h2>Mensagens esperando</h2>
            <p>Entradas que ainda não começaram a ser processadas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Entrada</th>
                  <th>Conversa</th>
                  <th className="col-numero">Esperando há</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {pgEspera.itens.map((e) => (
                  <tr key={e.entradaId}>
                    <td className="mono text-xs">{idCurto(e.entradaId)}</td>
                    <td className="mono text-xs">
                      <Link href={`/conversas?conversa=${e.conversaId}`} className="link-acao">
                        {idCurto(e.conversaId)}
                      </Link>
                    </td>
                    <td className="mono col-numero text-xs">{formatarDuracao(e.esperandoS)}</td>
                    <td>
                      {e.motivo === "aguardando_anterior" ? (
                        <span className="etiqueta etiqueta-info">aguardando o pedido anterior (normal)</span>
                      ) : (
                        <span className="etiqueta etiqueta-erro">nenhum pedido em execução — verificar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao
            pagina={pgEspera}
            caminho="/fila"
            params={parametros}
            nome="p_espera"
            ancora="espera"
            rotulo="mensagens"
          />
        </section>
      )}

      <section id="saidas" className="cartao overflow-hidden">
        <div className="cartao-cabecalho">
          <h2>Respostas enviadas ao WhatsApp</h2>
          <p>
            “incerto” bloqueia as entregas seguintes da conversa até a
            reconciliação.
          </p>
        </div>

        <div className="border-b border-[var(--borda)] p-3">
          <div className="abas" role="group" aria-label="Status da resposta">
            <Link href={hrefStatus(undefined)} className={`aba ${!status ? "aba-ativa" : ""}`}>
              Todas
            </Link>
            {STATUS_SAIDA.map((s) => (
              <Link key={s} href={hrefStatus(s)} className={`aba ${status === s ? "aba-ativa" : ""}`}>
                {s}
              </Link>
            ))}
          </div>
        </div>

        {pgSaidas.total === 0 ? (
          <Vazio>Nenhuma resposta neste filtro.</Vazio>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Texto</th>
                    <th>Status</th>
                    <th className="col-numero">Tentativas</th>
                    <th>Criada</th>
                    <th>Enviada</th>
                    <th>Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {pgSaidas.itens.map((s) => (
                    <tr key={s.id}>
                      <td className="truncar" title={s.texto}>
                        {textoTruncado(s.texto, 80)}
                      </td>
                      <td>
                        <Etiqueta status={s.status} />
                      </td>
                      <td className="mono col-numero text-xs">{s.tentativas}</td>
                      <td className="text-xs text-[var(--texto-fraco)]">
                        <Tempo iso={s.criado_em} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-[var(--texto-fraco)]">
                        {s.enviado_em ? dataHora(s.enviado_em) : "—"}
                      </td>
                      <td className="truncar text-xs" title={s.ultimo_erro ?? undefined}>
                        {s.ultimo_erro ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={pgSaidas}
              caminho="/fila"
              params={parametros}
              nome="p_saidas"
              ancora="saidas"
              rotulo="respostas"
            />
          </>
        )}
      </section>
    </LayoutPainel>
  );
}
