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
        "DASHBOARD_ALLOWED_EMAILS está vazio. Sem ele ninguém entra no painel. " +
        "Configure a variavel na Vercel com os e-mails autorizados, separados por vírgula.";
    }
  } catch (erro) {
    erroDeConfiguracao =
      erro instanceof ErroDeConfiguracao
        ? `Faltam variáveis de ambiente: ${erro.variaveis.join(", ")}.`
        : "Configuração do painel inválida. Verifique as variáveis na Vercel.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="marca mb-4" style={{ width: "3rem", height: "3rem", fontSize: "1.25rem" }}>
            W
          </div>
          <h1 className="text-xl font-bold tracking-tight">Worki Agent</h1>
          <p className="mt-1 text-sm text-[var(--texto-fraco)]">
            Painel de operação do agente
          </p>
        </div>

        <div className="cartao p-6">
          {erroDeConfiguracao ? (
            <div className="space-y-3 text-sm">
              <p className="text-[var(--erro)]">
                O painel não está pronto para uso.
              </p>
              <p className="text-[var(--texto-fraco)]">{erroDeConfiguracao}</p>
            </div>
          ) : (
            <>
              <LoginForm
                // "Sem sessao" e o estado normal de quem acabou de chegar: nao e erro.
                mensagem={
                  busca.erro ??
                  (resultado.motivo === "sem-sessao"
                    ? undefined
                    : mensagemDeRecusa(resultado.motivo))
                }
              />
              <p className="mt-4 text-xs leading-relaxed text-[var(--texto-tenue)]">
                O acesso é restrito aos e-mails autorizados na configuração do
                painel. Estar logado no Supabase não basta: o e-mail precisa
                estar na lista.
              </p>
            </>
          )}
        </div>

        {!serviceRoleConfigurada() && !erroDeConfiguracao && (
          <p className="mt-4 text-center text-xs text-[var(--alerta)]">
            SUPABASE_SERVICE_ROLE_KEY não configurada: o login funciona, mas as
            telas vão falhar.
          </p>
        )}
      </div>
    </main>
  );
}
