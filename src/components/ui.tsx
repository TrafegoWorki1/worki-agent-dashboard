import type { ReactNode } from "react";

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

/** "ha 5 min", "ha 2 h", "ha 3 d". Cai para a data se for antigo demais. */
export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const segundos = (Date.now() - d.getTime()) / 1000;
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `ha ${Math.floor(segundos / 60)} min`;
  if (segundos < 86400) return `ha ${Math.floor(segundos / 3600)} h`;
  if (segundos < 2592000) return `ha ${Math.floor(segundos / 86400)} d`;
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
 * Status desconhecido aparece marcado, nunca silencio.
 * Um status novo no banco sem mapeamento aqui deve ser visivel.
 */
export function Etiqueta({ status }: { status: string | null | undefined }) {
  const texto = status ?? "desconhecido";
  const desconhecido = !status || !(status in CLASSE_POR_STATUS);

  return (
    <span className={`etiqueta ${classeDoStatus(status)}`}>
      {desconhecido && <span aria-hidden="true">?</span>}
      {texto}
    </span>
  );
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
  return (
    <div className="cartao p-4">
      <div className="cartao-titulo">{rotulo}</div>
      <div
        className={`metrica-valor mt-1 ${tom === "etiqueta-erro" ? "text-[var(--erro)]" : ""} ${
          tom === "etiqueta-alerta" ? "text-[var(--alerta)]" : ""
        } ${tom === "etiqueta-ok" ? "text-[var(--ok)]" : ""}`}
      >
        {valor}
      </div>
      {detalhe && (
        <div className="mt-1 text-xs text-[var(--texto-tenue)]">{detalhe}</div>
      )}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-[var(--texto-tenue)]">
      {children}
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
