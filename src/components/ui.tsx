import type { ReactNode } from "react";

import { formatarDuracao, type Alerta } from "@/lib/fila";
import {
  STATUS_ACAO,
  STATUS_ENTRADA,
  STATUS_ETAPA,
  STATUS_MEMORIA,
  STATUS_SAIDA,
  STATUS_TAREFA,
} from "@/lib/tipos";

/**
 * Formatacao em pt-BR e mapeamento de status para cor.
 *
 * Tudo aqui e Server Component puro: nao usa `useState` nem `useEffect`,
 * entao nao precisa de 'use client' e nao entra no bundle do navegador.
 */

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const fmtDataCurta = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fmtData.format(d);
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fmtDataCurta.format(d);
}

export function hora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fmtHora.format(d);
}

/** "há 5 min", "há 2 h", "há 3 d". Cai para a data se for antigo demais. */
export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const segundos = (Date.now() - d.getTime()) / 1000;
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `há ${Math.floor(segundos / 3600)} h`;
  if (segundos < 2592000) return `há ${Math.floor(segundos / 86400)} d`;
  return fmtDataCurta.format(d);
}

/* ------------------------------------------------------------------ */
/* Identificadores                                                     */
/* ------------------------------------------------------------------ */

/** Ultimos 8 caracteres do id: suficiente para localizar, curto para a tela. */
export function idCurto(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length <= 8 ? id : id.slice(-8);
}

/**
 * Numero de telefone a partir do JID do WhatsApp.
 * `5585999515154@s.whatsapp.net` vira `+55 85 99951-5154`.
 */
export function telefoneDoJid(jid: string | null | undefined): string {
  if (!jid) return "—";
  const numero = jid.split("@")[0].replace(/\D/g, "");
  if (numero.length < 10) return jid;

  const pais = numero.startsWith("55") ? numero.slice(2) : numero;
  if (pais.length !== 11) return jid;

  return `+55 ${pais.slice(0, 2)} ${pais.slice(2, 7)}-${pais.slice(7)}`;
}

export function textoTruncado(
  texto: string | null | undefined,
  max = 120,
): string {
  if (!texto) return "—";
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max - 1)}…`;
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

type Classe =
  | "etiqueta-ok"
  | "etiqueta-alerta"
  | "etiqueta-erro"
  | "etiqueta-neutra"
  | "etiqueta-info";

const CLASSE_POR_STATUS: Record<string, Classe> = {
  // tarefa
  ativa: "etiqueta-info",
  bloqueada: "etiqueta-alerta",
  concluida: "etiqueta-ok",
  cancelada: "etiqueta-neutra",
  // entrada
  aguardando: "etiqueta-neutra",
  processando: "etiqueta-info",
  // etapa
  executando: "etiqueta-info",
  pendente: "etiqueta-neutra",
  incerto: "etiqueta-alerta",
  // saida
  pendente_saida: "etiqueta-neutra",
  enviando: "etiqueta-info",
  enviada: "etiqueta-ok",
  falhou: "etiqueta-erro",
  // acao
  aguardando_acao: "etiqueta-alerta",
  confirmada: "etiqueta-ok",
  consumida: "etiqueta-info",
  executada: "etiqueta-ok",
  expirada: "etiqueta-erro",
  // memoria
  substituida: "etiqueta-neutra",
  revogada: "etiqueta-erro",
};

export function classeDoStatus(status: string | null | undefined): Classe {
  if (!status) return "etiqueta-neutra";
  return CLASSE_POR_STATUS[status] ?? "etiqueta-neutra";
}

/**
 * Status que significam coisas diferentes conforme a tabela. O principal:
 * `aguardando` numa ENTRADA e so uma fila normal (neutro), mas numa ACAO
 * pendente e uma pessoa precisando decidir (alerta).
 */
const CLASSE_POR_STATUS_DE_ACAO: Record<string, Classe> = {
  aguardando: "etiqueta-alerta",
};

/**
 * Status desconhecido aparece marcado, nunca silencio.
 * Um status novo no banco sem mapeamento aqui deve ser visivel.
 */
export function Etiqueta({
  status,
  contexto,
}: {
  status: string | null | undefined;
  contexto?: "acao";
}) {
  const texto = status ?? "desconhecido";
  const desconhecido = !status || !(status in CLASSE_POR_STATUS);
  const classe =
    (contexto === "acao" && status ? CLASSE_POR_STATUS_DE_ACAO[status] : undefined) ??
    classeDoStatus(status);

  return (
    <span className={`etiqueta ${classe}`}>
      {desconhecido && <span aria-hidden="true">?</span>}
      {texto}
    </span>
  );
}

/** Instante com o horario completo ao passar o mouse (ou tocar), alem do "ha 5 min". */
export function Tempo({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-[var(--texto-tenue)]">—</span>;
  return (
    <time dateTime={iso} title={dataHora(iso)} className="whitespace-nowrap">
      {tempoRelativo(iso)}
    </time>
  );
}

/** Duracao em milissegundos, legivel: "850 ms", "12 s", "3 min 20 s". */
export function duracaoMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return formatarDuracao(Math.round(ms / 1000));
}

/* ------------------------------------------------------------------ */
/* Cartesianos                                                        */
/* ------------------------------------------------------------------ */

export function Metrica({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: number | string;
  detalhe?: string;
  tom?: Classe;
}) {
  // Valor em texto longo (dominio, "nao pronto") nao cabe no tamanho de
  // numero grande e vazava para fora do cartao.
  const emTexto = typeof valor === "string" && valor.length > 9;
  const cor =
    tom === "etiqueta-erro"
      ? "text-[var(--erro)]"
      : tom === "etiqueta-alerta"
        ? "text-[var(--alerta)]"
        : tom === "etiqueta-ok"
          ? "text-[var(--ok)]"
          : "";

  return (
    <div className="cartao metrica">
      <div className="cartao-titulo">{rotulo}</div>
      <div className={`metrica-valor ${emTexto ? "metrica-valor-texto" : ""} ${cor}`}>
        {valor}
      </div>
      {detalhe && <div className="metrica-detalhe">{detalhe}</div>}
    </div>
  );
}

const COR_ALERTA: Record<Alerta["nivel"], string> = {
  erro: "var(--erro)",
  alerta: "var(--alerta)",
  info: "var(--info)",
};

const ROTULO_ALERTA: Record<Alerta["nivel"], string> = {
  erro: "Atenção",
  alerta: "Aviso",
  info: "Informação",
};

/** Lista de alertas, do mais grave para o menos. Sem alertas, diz que esta tudo certo. */
export function ListaAlertas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <div className="cartao flex items-center gap-3 p-4 text-sm">
        <span className="etiqueta etiqueta-ok">tudo certo</span>
        <span className="text-[var(--texto-fraco)]">
          Fila e entregas dentro do esperado.
        </span>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {alertas.map((a, i) => (
        <li
          key={i}
          className="cartao flex gap-3 p-3.5 text-sm leading-relaxed"
          style={{ borderLeft: `3px solid ${COR_ALERTA[a.nivel]}` }}
        >
          <span
            className="shrink-0 pt-px text-[0.6875rem] font-bold uppercase tracking-wider"
            style={{ color: COR_ALERTA[a.nivel] }}
          >
            {ROTULO_ALERTA[a.nivel]}
          </span>
          <span className="text-[var(--texto-fraco)]">{a.texto}</span>
        </li>
      ))}
    </ul>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-[var(--texto-tenue)]">
      {children}
    </div>
  );
}

/** Orientacao neutra, sem tom de erro: "selecione uma conversa", dica de filtro. */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="aviso" role="note">
      <svg
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="currentColor"
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-[var(--info)]"
      >
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 11.5h-1.5v-5h1.5v5zm0-6.5h-1.5V5.5h1.5V7z" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

export function ErroBox({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-lg border border-[color-mix(in_srgb,var(--erro)_35%,transparent)] bg-[color-mix(in_srgb,var(--erro)_10%,transparent)] p-3 text-sm text-[var(--erro)]">
      {mensagem}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exportacoes dos tipos de status, para uso nos filtros                */
/* ------------------------------------------------------------------ */

export const LISTAS_STATUS = {
  tarefa: STATUS_TAREFA,
  etapa: STATUS_ETAPA,
  saida: STATUS_SAIDA,
  acao: STATUS_ACAO,
  memoria: STATUS_MEMORIA,
  entrada: STATUS_ENTRADA,
} as const;
