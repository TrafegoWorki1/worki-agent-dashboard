import Link from "next/link";

import type { Usuario } from "@/lib/auth";

const SECOES = [
  { href: "/", rotulo: "Visao geral" },
  { href: "/servico", rotulo: "Servico e worker" },
  { href: "/conversas", rotulo: "Conversas" },
  { href: "/tarefas", rotulo: "Tarefas" },
  { href: "/aprovacoes", rotulo: "Aprovacoes" },
  { href: "/memorias", rotulo: "Memorias" },
  { href: "/auditoria", rotulo: "Auditoria" },
];

/**
 * Estrutura das paginas do painel.
 *
 * Server Component: recebe o usuario ja validado por `exigirAcesso()` e
 * so formata. Nenhuma query, nenhuma interacao no cliente.
 */
export function LayoutPainel({
  usuario,
  ativo,
  children,
}: {
  usuario: Usuario;
  ativo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:flex">
      {/* Lateral, fixa, some no mobile */}
      <aside className="hidden w-56 shrink-0 border-r p-4 md:block">
        <div className="mb-6 px-2">
          <div className="text-sm font-bold tracking-tight">Worki Agent</div>
          <div className="text-xs text-[var(--texto-tenue)]">
            Agente Dominante
          </div>
        </div>

        <nav className="space-y-0.5">
          {SECOES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`nav-item ${ativo === s.href ? "nav-item-ativo" : ""}`}
            >
              {s.rotulo}
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t pt-4 px-2">
          <div
            className="truncate text-xs text-[var(--texto-fraco)]"
            title={usuario.email}
          >
            {usuario.email}
          </div>
          <form action="/auth/sair" method="post">
            <button
              type="submit"
              className="mt-2 text-xs text-[var(--texto-tenue)] hover:underline"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Navegacao horizontal, so no mobile */}
        <header className="border-b p-3 md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">Worki Agent</span>
            <form action="/auth/sair" method="post">
              <button
                type="submit"
                className="text-xs text-[var(--texto-tenue)]"
              >
                Sair
              </button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {SECOES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`nav-item whitespace-nowrap ${ativo === s.href ? "nav-item-ativo" : ""}`}
              >
                {s.rotulo}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function Cabecalho({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1 text-sm text-[var(--texto-fraco)]">{descricao}</p>
        )}
      </div>
      {acoes}
    </div>
  );
}
