import { createBrowserClient } from "@supabase/ssr";

/**
 * Acesso as variaveis PUBLICAS, do lado do navegador.
 *
 * Este e o unico arquivo que pode ser importado por Client Component e
 * tocar `process.env`. Ele so le `NEXT_PUBLIC_SUPABASE_URL` e
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que por design vao para o bundle.
 *
 * Existe separado de `env.ts` justamente para tornar impossivel o erro:
 * um Client Component que precise de config chama `env-publico.ts` e o
 * compilador barra qualquer tentativa de puxar a service role daqui.
 */
export type ConfigPublica = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function publico(): ConfigPublica {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Configure-as na Vercel.",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

/** Cliente Supabase para o navegador: so autenticacao, nunca dados de runtime. */
export function cliente() {
  const { supabaseUrl, supabaseAnonKey } = publico();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
