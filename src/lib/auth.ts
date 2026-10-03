import "server-only";

import { redirect } from "next/navigation";

import { servidor } from "@/lib/env";
import { supabaseAuth } from "@/lib/supabase-auth";

/**
 * Autorizacao do dashboard.
 *
 * O banco nao protege o dashboard: ele tem RLS ligado sem policies nas
 * tabelas de runtime, e o dashboard le com `service_role`, que bypassa
 * RLS. Ou seja, TODA a autorizacao acontece aqui, no servidor, antes de
 * qualquer consulta.
 *
 * Tres camadas, nessa ordem:
 *
 *  1. Sessao valida no Supabase Auth. Sem sessao, nao existe usuario.
 *  2. Allowlist em DASHBOARD_ALLOWED_EMAILS. Estar logado nao basta:
 *     qualquer conta criada no projeto do Supabase entraria.
 *  3. O e-mail comparado e o da sessao, normalizado em minusculas e sem
 *     espaco. Nunca o `user_metadata`, que o usuario controla.
 */

export type Usuario = {
  id: string;
  email: string;
};

export type ResultadoAuth =
  | { autorizado: true; usuario: Usuario }
  | { autorizado: false; motivo: MotivoRecusa };

export type MotivoRecusa = "sem-sessao" | "sem-email" | "fora-da-allowlist";

export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase();
}

export function emailPermitido(email: string, permitidos: string[]): boolean {
  return permitidos.includes(normalizarEmail(email));
}

/**
 * Valida a sessao e a allowlist. Nao redireciona: use quando quiser
 * tratar o caso na propria pagina (a tela de login, por exemplo).
 */
export async function verificarAcesso(): Promise<ResultadoAuth> {
  let permitidos: string[];
  try {
    permitidos = servidor().emailsPermitidos;
  } catch {
    // Env nao configurado: nega. Falhar aberto seria pior.
    return { autorizado: false, motivo: "fora-da-allowlist" };
  }

  if (permitidos.length === 0) {
    return { autorizado: false, motivo: "fora-da-allowlist" };
  }

  const supabase = await supabaseAuth();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { autorizado: false, motivo: "sem-sessao" };
  }

  const email = user.email ?? "";
  if (!email) {
    return { autorizado: false, motivo: "sem-email" };
  }

  if (!emailPermitido(email, permitidos)) {
    return { autorizado: false, motivo: "fora-da-allowlist" };
  }

  return {
    autorizado: true,
    usuario: { id: user.id, email: normalizarEmail(email) },
  };
}

/**
 * Igual a `verificarAcesso`, mas redireciona quando negado. Usar em
 * Server Component que so renderizam para usuario autorizado.
 */
export async function exigirAcesso(caminho = "/login"): Promise<Usuario> {
  const resultado = await verificarAcesso();

  if (!resultado.autorizado) {
    redirect(caminho);
  }

  return resultado.usuario;
}

/** Mensagem em pt-BR para cada motivo de recusa. */
export function mensagemDeRecusa(motivo: MotivoRecusa): string {
  switch (motivo) {
    case "sem-sessao":
      return "Faca login para acessar o painel.";
    case "sem-email":
      return "Sua conta do Supabase nao tem e-mail. Cadastre-o antes de entrar.";
    case "fora-da-allowlist":
      return "Seu e-mail nao esta na lista de acesso do painel.";
  }
}
