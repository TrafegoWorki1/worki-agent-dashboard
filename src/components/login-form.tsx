"use client";

import { useState } from "react";

import { cliente } from "@/lib/env-publico";

/**
 * Formulario de login com senha.
 *
 * Client Component, mas so o necessario: a URL e a anon key sao publicas
 * por design (o banco nao tem RLS liberado para elas). A service role
 * nao aparece em lugar nenhum deste arquivo.
 *
 * "Invalid login credentials" vira "e-mail ou senha incorretos", sem dizer
 * qual dos dois: o Supabase tambem nao diz, e nao ha por que confirmar a
 * um desconhecido que um e-mail existe. Qualquer outro erro aparece como veio.
 */
function traduzir(mensagem: string): string {
  return /invalid login credentials/i.test(mensagem)
    ? "E-mail ou senha incorretos."
    : mensagem;
}

export function LoginForm({ mensagem }: { mensagem?: string }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);

    try {
      const supabase = cliente();
      const { error: falha } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (falha) {
        setErro(traduzir(falha.message));
        setCarregando(false);
        return;
      }

      // Sessao gravada: recarrega para o middleware ver o cookie novo.
      window.location.href = "/";
    } catch {
      setErro("Falha de rede ao entrar. Tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="space-y-4">
      {(erro || mensagem) && (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--erro)_35%,transparent)] bg-[color-mix(in_srgb,var(--erro)_10%,transparent)] p-2.5 text-xs text-[var(--erro)]">
          {erro ?? mensagem}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="cartao-titulo">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          className="campo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="senha" className="cartao-titulo">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          className="campo"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        className="botao botao-primario w-full"
        disabled={carregando}
      >
        {carregando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
