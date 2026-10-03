"use client";

import { useState } from "react";

import { PALAVRA_POR_ACAO } from "@/lib/tipos";

/**
 * Aprovacao de acao pendente.
 *
 * Client Component porque precisa de estado: mostrar o resultado da RPC
 * sem recarregar a pagina. Nenhum segredo entra aqui — o componente
 * recebe so ids e o e-mail do aprovador, que ja foi validado no servidor.
 *
 * A chamada vai para a Server Action, que roda com `service_role`.
 * O navegador nunca ve essa chave.
 */
export function AprovarAcao({
  acaoId,
  conversaId,
  status,
  expirada,
  aprovador,
}: {
  acaoId: number;
  conversaId: string | null;
  status: string;
  expirada: boolean;
  aprovador: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);

  // Aprovavel so se estiver aguardando, dentro do prazo e com conversa:
  // a RPC exige p_conversa_id e recusa acao expirada.
  const podeAprovar =
    status === "aguardando" && !expirada && Boolean(conversaId);

  if (!podeAprovar) {
    return (
      <div className="shrink-0 text-right text-xs text-[var(--texto-tenue)]">
        {status !== "aguardando" && <div>ja decidida</div>}
        {status === "aguardando" && expirada && (
          <div className="text-[var(--erro)]">expirada</div>
        )}
        {status === "aguardando" && !expirada && !conversaId && (
          <div>sem conversa</div>
        )}
      </div>
    );
  }

  async function aprovar() {
    setEnviando(true);
    setResultado(null);

    try {
      const resposta = await fetch("/api/aprovacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acaoId, palavra, aprovador }),
      });

      const corpo = (await resposta.json()) as {
        ok: boolean;
        mensagem?: string;
        erro?: string;
      };

      if (corpo.ok) {
        setResultado({
          ok: true,
          texto: corpo.mensagem ?? "Aprovacao registrada.",
        });
        setAberto(false);
        setPalavra("");
      } else {
        setResultado({ ok: false, texto: corpo.erro ?? "Aprovacao recusada." });
      }
    } catch {
      setResultado({ ok: false, texto: "Falha de rede ao aprovar." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="shrink-0">
      {!aberto ? (
        <button
          type="button"
          className="botao botao-primario"
          onClick={() => setAberto(true)}
        >
          Aprovar
        </button>
      ) : (
        <div className="flex flex-col items-end gap-2">
          <input
            className="campo w-32 text-right"
            placeholder="palavra"
            value={palavra}
            onChange={(e) => setPalavra(e.target.value)}
            autoFocus
            // Lista de palavras aceitas por acao, sem expor o banco.
            list="palavras-aprovacao"
          />
          <datalist id="palavras-aprovacao">
            {Object.entries(PALAVRA_POR_ACAO).map(([acao, p]) => (
              <option key={acao} value={p} />
            ))}
          </datalist>

          <div className="flex gap-2">
            <button
              type="button"
              className="botao"
              onClick={() => {
                setAberto(false);
                setResultado(null);
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="botao botao-primario"
              onClick={aprovar}
              disabled={enviando || !palavra.trim()}
            >
              {enviando ? "Enviando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <p
          className={`mt-2 max-w-64 text-right text-xs ${
            resultado.ok ? "text-[var(--ok)]" : "text-[var(--erro)]"
          }`}
        >
          {resultado.texto}
        </p>
      )}
    </div>
  );
}
