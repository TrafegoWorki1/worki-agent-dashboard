"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const fmt = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

/**
 * "Atualizado as 14:03:22" + botao para recarregar os dados.
 *
 * O painel e renderizado no servidor a cada abertura, mas fica parado depois
 * disso. Sem este indicador a tela parecia ao vivo (a Visao geral dizia "em
 * tempo real") sem ser, e ninguem sabia ha quanto tempo olhava o mesmo dado.
 * `router.refresh()` busca tudo de novo preservando filtros e pagina da URL.
 */
export function Atualizar({ geradoEm }: { geradoEm: string }) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--texto-tenue)]">
      <span title="Horario em que estes dados foram lidos">
        Atualizado às {fmt.format(new Date(geradoEm))}
      </span>
      <button
        type="button"
        className="botao botao-pequeno"
        onClick={() => iniciar(() => router.refresh())}
        disabled={carregando}
        aria-label="Recarregar os dados desta tela"
      >
        <svg
          viewBox="0 0 20 20"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={carregando ? "animate-spin" : ""}
          aria-hidden="true"
        >
          <path d="M16 10a6 6 0 11-1.76-4.24M16 3.5v3.25h-3.25" />
        </svg>
        {carregando ? "Atualizando" : "Atualizar"}
      </button>
    </div>
  );
}
