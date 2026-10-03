import { redirect } from "next/navigation";

import { mensagemDeRecusa, verificarAcesso } from "@/lib/auth";
import {
  ErroDeConfiguracao,
  servidor,
  serviceRoleConfigurada,
} from "@/lib/env";

import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export type Busca = { erro?: string };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const busca = await searchParams;

  const resultado = await verificarAcesso();
  if (resultado.autorizado) {
    redirect("/");
  }

  // Erro de configuracao e falha de deploy, nao erro do usuario. Fala
  // com o deploy, nao com quem esta tentando entrar.
  let erroDeConfiguracao: string | null = null;
  try {
    const cfg = servidor();
    if (cfg.emailsPermitidos.length === 0) {
      erroDeConfiguracao =
        "DASHBOARD_ALLOWED_EMAILS esta vazio. Sem ele ninguem entra no painel. " +
        "Configure a variavel na Vercel com os e-mails autorizados, separados por virgula.";
    }
  } catch (erro) {
    erroDeConfiguracao =
      erro instanceof ErroDeConfiguracao
        ? `Faltam variaveis de ambiente: ${erro.variaveis.join(", ")}.`
        : "Configuracao do painel invalida. Verifique as variaveis na Vercel.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight">Worki Agent</h1>
          <p className="mt-1 text-sm text-[var(--texto-fraco)]">
            Painel de operacao do Agente Dominante
          </p>
        </div>

        <div className="cartao p-6">
          {erroDeConfiguracao ? (
            <div className="space-y-3 text-sm">
              <p className="text-[var(--erro)]">
                O painel nao esta pronto para uso.
              </p>
              <p className="text-[var(--texto-fraco)]">{erroDeConfiguracao}</p>
            </div>
          ) : (
            <>
              <LoginForm
                mensagem={busca.erro ?? mensagemDeRecusa(resultado.motivo)}
              />
              <p className="mt-4 text-xs leading-relaxed text-[var(--texto-tenue)]">
                O acesso e restrito aos e-mails autorizados na configuracao do
                painel. Estar logado no Supabase nao e suficiente: o e-mail
                precisa estar na lista.
              </p>
            </>
          )}
        </div>

        {!serviceRoleConfigurada() && !erroDeConfiguracao && (
          <p className="mt-4 text-center text-xs text-[var(--alerta)]">
            SUPABASE_SERVICE_ROLE_KEY nao configurada: o login funciona, mas as
            telas vao falhar.
          </p>
        )}
      </div>
    </main>
  );
}
