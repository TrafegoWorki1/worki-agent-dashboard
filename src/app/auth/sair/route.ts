import { NextResponse } from "next/server";

import { supabaseAuth } from "@/lib/supabase-auth";

/**
 * Logout.
 *
 * Form POST em vez de link GET: logout por GET pode ser disparado por
 * `<img src>` numa pagina de terceiros, derrubando a sessao de quem
 * esta logado sem querer.
 */
export async function POST(req: Request) {
  const supabase = await supabaseAuth();
  await supabase.auth.signOut();

  const destino = new URL("/login", req.url);
  return NextResponse.redirect(destino, { status: 303 });
}
