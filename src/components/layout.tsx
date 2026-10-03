import Link from "next/link";

import type { Usuario } from "@/lib/auth";

import { Atualizar } from "@/components/atualizar";

/** Icones de 20px, tracado simples, herdam a cor do texto. */
const ICONES: Record<string, React.ReactNode> = {
  visao: (
    <path d="M3 3h6v6H3V3zm8 0h6v4h-6V3zM3 11h6v6H3v-6zm8-2h6v8h-6V9z" />
  ),
  fila: <path d="M3 5l7-3 7 3-7 3-7-3zm0 5l7 3 7-3M3 14l7 3 7-3" />,
  servico: (
    <path d="M4 4h12v5H4V4zm0 7h12v5H4v-5zM7 6.5h.01M7 13.5h.01" />
  ),
  conversas: (
    <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v7a2 2 0 01-2 2H9l-4 3v-3a2 2 0 01-2-2V5z" />
  ),
  tarefas: <path d="M4 4h12v12H4V4zm3 6l2 2 4-4" />,
  aprovacoes: (
    <path d="M10 2l6 2.5v4.7c0 3.6-2.4 6.6-6 7.8-3.6-1.2-6-4.2-6-7.8V4.5L10 2zm-2.5 7.5l2 2 3-3.5" />
  ),
  memorias: (
    <path d="M10 3c3.9 0 7 1.1 7 2.5S13.9 8 10 8 3 6.9 3 5.5 6.1 3 10 3zM3 5.5v4C3 10.9 6.1 12 10 12s7-1.1 7-2.5v-4M3 9.5v4C3 14.9 6.1 16 10 16s7-1.1 7-2.5v-4" />
  ),
  auditoria: <path d="M5 3h7l4 4v10H5V3zm7 0v4h4M8 11h5M8 14h5" />,
};

const GRUPOS: Array<{
  titulo: string;
  itens: Array<{ href: string; rotulo: string; icone: keyof typeof ICONES }>;
}> = [
  {
    titulo: "Operação",
    itens: [
      { href: "/", rotulo: "Visão geral", icone: "visao" },
      { href: "/fila", rotulo: "Fila e entregas", icone: "fila" },
      { href: "/servico", rotulo: "Serviço e worker", icone: "servico" },
    ],
  },
  {
    titulo: "Atendimento",
    itens: [
      { href: "/conversas", rotulo: "Conversas", icone: "conversas" },
      { href: "/tarefas", rotulo: "Tarefas", icone: "tarefas" },
      { href: "/aprovacoes", rotulo: "Aprovações", icone: "aprovacoes" },
    ],
  },
  {
    titulo: "Registros",
    itens: [
      { href: "/memorias", rotulo: "Memórias", icone: "memorias" },
      { href: "/auditoria", rotulo: "Auditoria", icone: "auditoria" },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.itens);

function Icone({ nome }: { nome: keyof typeof ICONES }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONES[nome]}
    </svg>
  );
}

function Marca() {
  return (
    <div className="flex items-center gap-3">
      <div className="marca">W</div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight">Worki Agent</div>
        <div className="text-[0.6875rem] text-[var(--texto-tenue)]">
          Agente Dominante
        </div>
      </div>
    </div>
  );
}

/**
 * Estrutura das paginas do painel.
 *
 * Server Component: recebe o usuario ja validado por `exigirAcesso()` e
 * so formata. Nenhuma query, nenhuma interacao no cliente (alem do botao
 * "Atualizar", que vive no Cabecalho).
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
  const inicial = (usuario.email[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen md:flex">
      {/* Lateral fixa: acompanha a rolagem e some no celular */}
      <aside className="lateral hidden w-64 shrink-0 flex-col p-4 md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-2 pb-2 pt-1">
          <Marca />
        </div>

        <nav className="flex-1 overflow-y-auto pt-1" aria-label="Seções do painel">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <div className="nav-grupo">{g.titulo}</div>
              <div className="space-y-0.5">
                {g.itens.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    aria-current={ativo === s.href ? "page" : undefined}
                    className={`nav-item ${ativo === s.href ? "nav-item-ativo" : ""}`}
                  >
                    <Icone nome={s.icone} />
                    {s.rotulo}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 flex items-center gap-3 border-t px-2 pt-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--superficie-3)] text-xs font-bold text-[var(--acento-forte)]">
            {inicial}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-xs text-[var(--texto-fraco)]"
              title={usuario.email}
            >
              {usuario.email}
            </div>
            <form action="/auth/sair" method="post">
              <button
                type="submit"
                className="text-xs text-[var(--texto-tenue)] hover:text-[var(--texto)] hover:underline"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Navegacao horizontal, so no celular */}
        <header className="sticky top-0 z-20 border-b bg-[color-mix(in_srgb,var(--fundo)_88%,transparent)] p-3 backdrop-blur md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <Marca />
            <form action="/auth/sair" method="post">
              <button
                type="submit"
                className="text-xs text-[var(--texto-tenue)]"
              >
                Sair
              </button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Seções do painel">
            {TODOS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                aria-current={ativo === s.href ? "page" : undefined}
                className={`nav-item whitespace-nowrap ${ativo === s.href ? "nav-item-ativo" : ""}`}
              >
                {s.rotulo}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[88rem] space-y-6 p-4 md:p-8">
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
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight md:text-[1.75rem]">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--texto-fraco)]">
            {descricao}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {acoes}
        <Atualizar geradoEm={new Date().toISOString()} />
      </div>
    </div>
  );
}
