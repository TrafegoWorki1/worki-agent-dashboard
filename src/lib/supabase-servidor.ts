import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { servidor } from "@/lib/env";

/**
 * Cliente Supabase de SERVIDOR com `service_role`.
 *
 * Onde pode ser usado: Server Components, Route Handlers, Server Actions.
 * NUNCA em Client Component — `import 'server-only'` faz o build quebrar
 * se alguem tentar, em vez de vazar a chave no bundle.
 *
 * Por que service_role e nao a sessao do usuario:
 * o banco tem RLS ligado sem policies nas tabelas de runtime, e as 13
 * RPCs sao `backend_execute` com `anon_execute: false`. Nao ha como
 * ler `conversas` ou `tarefas` com a anon key, por construcao.
 *
 * Consequencia obrigatoria: a checagem de quem pode ver o que NAO pode
 * depender do banco. Ela acontece em `src/lib/auth.ts`, que valida a
 * sessao e a allowlist antes de qualquer consulta sair daqui.
 */
export function supabaseServidor(): SupabaseClient {
  const cfg = servidor();

  return createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
