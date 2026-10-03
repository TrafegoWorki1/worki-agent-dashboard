import { NextResponse } from "next/server";

import { mensagemDeRecusa, verificarAcesso } from "@/lib/auth";
import { aprovarAcao } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Rota de aprovacao. Unico POST do dashboard.
 *
 * Autorizacao: `exigirAcesso()` redireciona para /login. Numa Route
 * Handler isso vira um 307 do Next em vez de um redirect visivel, entao
 * o `catch` abaixo devolve 401 — nunca 200 com pagina de login.
 *
 * O `aprovador` chega do cliente, mas nao e confiavel: e substituido
 * pelo e-mail validado da sessao aqui. Um cliente malicioso nao poderia
 * assumir o nome de outro aprovador.
 */
export async function POST(req: Request) {
  // `exigirAcesso()` nao serve aqui: ele chama `redirect()`, que o Next
  // relanca como erro interno mesmo dentro de um try/catch — o handler
  // responderia 307 em vez do 401 que uma API precisa devolver.
  //
  // `verificarAcesso()` e a mesma checagem sem o redirect: sessao valida
  // no Supabase e e-mail na allowlist. Quem nega, devolve 401.
  const acesso = await verificarAcesso();

  if (!acesso.autorizado) {
    return NextResponse.json(
      { ok: false, erro: mensagemDeRecusa(acesso.motivo) },
      { status: 401 },
    );
  }

  const usuario = acesso.usuario;

  let corpo: { acaoId?: unknown; palavra?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json(
      { ok: false, erro: "Corpo invalido." },
      { status: 400 },
    );
  }

  const acaoId = Number(corpo.acaoId);
  const palavra =
    typeof corpo.palavra === "string" ? corpo.palavra.trim().toLowerCase() : "";

  if (!Number.isInteger(acaoId) || acaoId <= 0) {
    return NextResponse.json(
      { ok: false, erro: "acaoId invalido." },
      { status: 400 },
    );
  }
  if (!palavra) {
    return NextResponse.json(
      { ok: false, erro: "Informe a palavra de aprovacao." },
      { status: 400 },
    );
  }

  // Descobre a conversa pela propria acao: o cliente nao escolhe o
  // destino, e sim a acao. Isso impede aprovar a acao A apontando para
  // a conversa B.
  const { supabaseServidor } = await import("@/lib/supabase-servidor");
  const { data, error } = await supabaseServidor()
    .from("acoes_pendentes")
    .select("conversa_id, status, expira_em")
    .eq("id", acaoId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, erro: "Falha ao consultar a acao." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, erro: "Acao nao encontrada." },
      { status: 404 },
    );
  }

  if (data.status !== "aguardando") {
    return NextResponse.json(
      {
        ok: false,
        erro: `Acao ja esta "${data.status}" e nao aceita aprovacao.`,
      },
      { status: 409 },
    );
  }

  // `<=`: quem expira exatamente no instante atual ja esta fora do prazo,
  // e e o mesmo corte que o backend usa ao consumir a aprovacao.
  if (data.expira_em && new Date(data.expira_em).getTime() <= Date.now()) {
    return NextResponse.json(
      {
        ok: false,
        erro: "Acao expirada. Registre uma nova aprovacao no chat.",
      },
      { status: 409 },
    );
  }

  if (!data.conversa_id) {
    return NextResponse.json(
      {
        ok: false,
        erro: "Acao sem conversa definida nao pode ser aprovada pelo painel.",
      },
      { status: 409 },
    );
  }

  const resultado = await aprovarAcao({
    conversaId: data.conversa_id,
    palavra,
    // O aprovador vem da sessao validada, nunca do corpo da requisicao.
    aprovador: usuario.email,
    acaoId,
  });

  if (!resultado.ok) {
    return NextResponse.json(
      { ok: false, erro: resultado.erro },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    mensagem: "Aprovacao registrada. O worker executa no proximo ciclo.",
  });
}
