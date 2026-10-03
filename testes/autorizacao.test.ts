import { describe, expect, it } from "vitest";

import { emailPermitido, normalizarEmail } from "../src/lib/auth";
import { auditarVariaveisDeServidor } from "../src/lib/env";

/**
 * Autorizacao: allowlist e usuario nao autorizado.
 *
 * Cobre o requisito "teste de usuario nao autorizado" sem tocar no
 * Supabase: `emailPermitido` e a funcao que decide, e ela e pura.
 */
describe("allowlist de e-mails", () => {
  const permitidos = ["herickson@workidigital.tech", "admin@workidigital.tech"];

  it("aceita e-mail exatamente na lista", () => {
    expect(emailPermitido("herickson@workidigital.tech", permitidos)).toBe(
      true,
    );
  });

  it("rejeita e-mail fora da lista", () => {
    const r = emailPermitido("estranho@exemplo.com", permitidos);
    expect(r).toBe(false);
  });

  it("normaliza caixa antes de comparar", () => {
    expect(emailPermitido("Herickson@WorkiDigital.tech", permitidos)).toBe(
      true,
    );
  });

  it("ignora espaco em volta", () => {
    expect(emailPermitido("  admin@workidigital.tech  ", permitidos)).toBe(
      true,
    );
  });

  it("rejeita lista vazia: sem allowlist ninguem entra", () => {
    expect(emailPermitido("herickson@workidigital.tech", [])).toBe(false);
  });

  it("nao faz comparacao por substring", () => {
    // "evil-herickson@..." contem o nome, mas nao e o e-mail autorizado.
    expect(emailPermitido("evil-herickson@workidigital.tech", permitidos)).toBe(
      false,
    );
  });

  it("normaliza os dois lados", () => {
    const listaMista = ["  Admin@Workidigital.TECH "];
    expect(
      emailPermitido("admin@workidigital.tech", normalizarLista(listaMista)),
    ).toBe(true);
  });

  it("trata e-mail como string exata, sem trimming interno", () => {
    expect(normalizarEmail("  a@b.com ")).toBe("a@b.com");
    expect(normalizarEmail("A@B.COM")).toBe("a@b.com");
  });
});

function normalizarLista(bruta: string[]): string[] {
  return bruta.map((e) => normalizarEmail(e));
}

/* ------------------------------------------------------------------ */

/**
 * Trava contra segredo em variavel NEXT_PUBLIC_*.
 *
 * O Next INLINA qualquer NEXT_PUBLIC_ no bundle no momento do build.
 * Um NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY deixaria a service role
 * permanentemente publica em "View Source", mesmo depois de deletar a
 * variavel na Vercel.
 */
describe("auditoria de variaveis de servidor", () => {
  it("reprova NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", () => {
    const problemas = auditarVariaveisDeServidor({
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("reprova qualquer NEXT_PUBLIC_ com SERVICE_ROLE, TOKEN ou SECRET", () => {
    const problemas = auditarVariaveisDeServidor({
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "a".repeat(40),
      NEXT_PUBLIC_EASYPANEL_API_TOKEN: "b".repeat(40),
      NEXT_PUBLIC_WEBHOOK_SECRET: "c".repeat(40),
    });
    expect(problemas).toHaveLength(3);
  });

  it("aceita URL e anon key publicas", () => {
    const problemas = auditarVariaveisDeServidor({
      NEXT_PUBLIC_SUPABASE_URL: "https://wxqwtyotkkshdjzzwjsk.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.longenough",
    });
    expect(problemas).toEqual([]);
  });

  it("aceita segredos SEM prefixo NEXT_PUBLIC_", () => {
    const problemas = auditarVariaveisDeServidor({
      SUPABASE_SERVICE_ROLE_KEY: "a".repeat(40),
      EASYPANEL_API_TOKEN: "b".repeat(40),
      DASHBOARD_ALLOWED_EMAILS: "x@y.com",
    });
    expect(problemas).toEqual([]);
  });

  it("sinaliza placeholder curto em variavel publica", () => {
    // "your_key_here" nao quebra o build, so a pagina em runtime.
    const problemas = auditarVariaveisDeServidor({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "your_key_here",
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("curto");
  });
});
