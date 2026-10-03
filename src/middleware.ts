import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

/**
 * Renova a sessao do Supabase e bloqueia rota protegida antes do render.
 *
 * Duas coisas acontecem aqui, nesta ordem:
 *
 *  1. `getUser()` valida a sessao no servidor. Usar `getSession()` seria
 *     errado: ele le o cookie sem conferir com o Supabase, e aceitaria
 *     um token adulterado.
 *
 *  2. Sem usuario autenticado, qualquer rota diferente de `/login` e das
 *     rotas de API do Supabase vai para `/login`.
 *
 * Isto NAO e a unica protecao. O middleware confere sessao; a allowlist
 * por e-mail fica em `src/lib/auth.ts`, e cada pagina chama
 * `exigirAcesso()` antes de consultar o banco. Se o middleware for
 * removido por engano, as paginas continuam protegidas.
 */
export async function middleware(req: NextRequest) {
  const resposta = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !chave) {
    // Sem configuracao, so deixa passar /login para o usuario ver o erro.
    if (!req.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return resposta;
  }

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(itens) {
        for (const item of itens) {
          req.cookies.set(item.name, item.value);
          resposta.cookies.set(item.name, item.value, item.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = req.nextUrl.pathname;
  const ehLogin = caminho.startsWith("/login");
  const ehCallback = caminho.startsWith("/auth/callback");

  if (!user && !ehLogin && !ehCallback) {
    const destino = new URL("/login", req.url);
    destino.searchParams.set("origem", caminho);
    return NextResponse.redirect(destino);
  }

  if (user && ehLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return resposta;
}

export const config = {
  matcher: [
    // A API de aprovacao NAO passa pelo middleware: ele redirecionaria
    // quem nao tem sessao para /login, e a rota responderia 307 em vez
    // do 401 com JSON que o client precisa ler. A rota faz a propria
    // checagem em `verificarAcesso()`.
    "/((?!api/aprovacoes|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)",
  ],
};
