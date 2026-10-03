import { STATUS_TAREFA, type Mensagem, type Saida, type Tarefa } from "@/lib/tipos";

/**
 * Regras de exibicao das telas, em funcoes puras (sem Supabase, sem React)
 * para serem testadas. Cada uma corrige um defeito de UX encontrado na
 * auditoria das telas; o comentario diz qual.
 */

/* ------------------------------------------------------------------ */
/* Conversa: linha do tempo com os dois lados                          */
/* ------------------------------------------------------------------ */

export type ItemDaConversa = {
  id: string;
  /** `entrada`: o que o dono mandou. `saida`: o que o agente respondeu. */
  lado: "entrada" | "saida";
  texto: string;
  quando: string;
  /** So nas saidas: enviada, pendente, falhou... */
  statusEnvio: Saida["status"] | null;
  tipo: string | null;
};

/**
 * Junta as mensagens recebidas e as respostas do agente numa unica linha do
 * tempo, da mais recente para a mais antiga.
 *
 * Antes a tela da conversa mostrava SO o que o dono mandou: as respostas do
 * agente ficam na tabela `saidas`, que ela nunca lia. Era uma conversa com um
 * lado so, e ninguem conseguia conferir o que o agente de fato respondeu.
 */
export function montarLinhaDoTempo(
  mensagens: Mensagem[],
  saidas: Saida[],
): ItemDaConversa[] {
  const itens: ItemDaConversa[] = [
    ...mensagens.map(
      (m): ItemDaConversa => ({
        id: `m-${m.id}`,
        lado: "entrada",
        texto: m.texto,
        quando: m.criado_em,
        statusEnvio: null,
        tipo: m.tipo_mensagem,
      }),
    ),
    ...saidas.map(
      (s): ItemDaConversa => ({
        id: `s-${s.id}`,
        lado: "saida",
        texto: s.texto,
        // Quando saiu de fato; se o envio nao foi registrado, quando ficou pronta.
        quando: s.enviado_em ?? s.criado_em,
        statusEnvio: s.status,
        tipo: null,
      }),
    ),
  ];
  return itens.sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));
}

/* ------------------------------------------------------------------ */
/* Proprietario (Memorias)                                              */
/* ------------------------------------------------------------------ */

/**
 * Formata 55 + DDD + numero como "+55 85 99249-4552". Outro formato volta como veio.
 */
export function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return digitos;
}

/**
 * Nome de um proprietario no menu de memorias.
 *
 * Antes o menu mostrava a CHAVE da primeira memoria encontrada (por exemplo
 * "preferencia_tom") como se fosse o nome da pessoa. O identificador real e o
 * numero de WhatsApp; ele e o que aparece agora. Ids que nao sao numero ficam
 * encurtados.
 */
export function rotuloProprietario(id: string): string {
  const somenteDigitos = /^\d{10,15}$/.test(id);
  if (somenteDigitos) return formatarTelefone(id);
  return id.length > 14 ? `…${id.slice(-12)}` : id;
}

/* ------------------------------------------------------------------ */
/* Tarefas                                                              */
/* ------------------------------------------------------------------ */

/**
 * Tarefas com status que o painel nao conhece (o backend mudou o schema?).
 *
 * Antes a tela fazia `tarefas.some(conhecido) === false`, que e VERDADEIRO
 * para lista vazia: toda vez que um filtro nao devolvia tarefa nenhuma,
 * aparecia o alerta falso "ha tarefas com status fora da lista conhecida".
 */
export function tarefasComStatusDesconhecido(tarefas: Tarefa[]): Tarefa[] {
  const conhecidos = STATUS_TAREFA as readonly string[];
  return tarefas.filter((t) => !conhecidos.includes(t.status));
}

/* ------------------------------------------------------------------ */
/* Conversas                                                            */
/* ------------------------------------------------------------------ */

/** Conversa direta: o chat e o participante sao a mesma pessoa. */
export function conversaDireta(
  chatJid: string,
  participanteJid: string | null,
): boolean {
  return !participanteJid || participanteJid === chatJid;
}
