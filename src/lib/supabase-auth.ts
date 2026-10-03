import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publico } from "@/lib/env";

/**
 * Cliente Supabase para AUTENTICACAO, com a sessao do usuario em cookie.
 *
 * Este cliente usa a anon key e a RLS do proprio Supabase. Ele existe
 * para login, logout e leitura do perfil — nao para ler as tabelas de
 * runtime, que nao tem policy para `authenticated`.
 *
 * O acesso aos dados em si e por `supabaseServidor()`, depois da
 * validacao em `src/lib/auth.ts`.
 */
export async function supabaseAuth() {
  const loja = await cookies();
  const cfg = publico();

  return createServerClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(itens) {
        try {
          for (const item of itens) {
            loja.set(item.name, item.value, item.options);
          }
        } catch {
          // Server Component nao pode escrever cookie. O middleware
          // renova a sessao; aqui basta ignorar, como pede o @supabase/ssr.
        }
      },
    },
  });
}
