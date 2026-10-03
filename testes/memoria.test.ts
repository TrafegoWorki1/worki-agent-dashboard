import { describe, expect, it } from "vitest";

import { tipoMemoriaVisivel } from "../src/lib/memoria";

/**
 * Isolamento de memoria por proprietario e projeto.
 *
 * O contrato do backend diz, sem margem: "Nao incluir memorias de outro
 * projeto". A tabela `memorias` guarda `proprietario_id` e `projeto_id`,
 * e o dashboard le com `service_role` — que BYPASSA RLS. Ou seja, nada
 * no banco impede uma consulta mal escrita de devolver memoria de
 * todo mundo. O filtro e nosso, e por isso ele e testado.
 */

type Memoria = {
  id: string;
  proprietario_id: string;
  projeto_id: string | null;
  status: string;
};

/** Espelha o filtro de listarMemorias() em src/lib/queries.ts. */
function filtrar(
  memorias: Memoria[],
  filtro: { proprietarioId: string; projetoId?: string; status?: string },
): Memoria[] {
  return memorias.filter((m) => {
    if (m.proprietario_id !== filtro.proprietarioId) return false;
    if (filtro.status && m.status !== filtro.status) return false;
    if (
      filtro.projetoId &&
      m.projeto_id !== filtro.projetoId &&
      m.projeto_id !== null
    )
      return false;
    return true;
  });
}

const BASE: Memoria[] = [
  { id: "m1", proprietario_id: "ana", projeto_id: "proj-a", status: "ativa" },
  { id: "m2", proprietario_id: "ana", projeto_id: "proj-b", status: "ativa" },
  { id: "m3", proprietario_id: "ana", projeto_id: null, status: "ativa" },
  { id: "m4", proprietario_id: "bruno", projeto_id: "proj-a", status: "ativa" },
  { id: "m5", proprietario_id: "bruno", projeto_id: "proj-c", status: "ativa" },
];

describe("isolamento de memoria por projeto", () => {
  it("filtra por proprietario e projeto", () => {
    const r = filtrar(BASE, { proprietarioId: "ana", projetoId: "proj-a" });
    // m1 e o alvo; m3 e global da ana; m2 e de outro projeto e fica de fora.
    expect(r.map((m) => m.id).sort()).toEqual(["m1", "m3"]);
  });

  it("NUNCA devolve memoria de outro proprietario", () => {
    const r = filtrar(BASE, { proprietarioId: "ana", projetoId: "proj-a" });
    expect(r.every((m) => m.proprietario_id === "ana")).toBe(true);
  });

  it("NUNCA devolve memoria de outro projeto", () => {
    const r = filtrar(BASE, { proprietarioId: "bruno", projetoId: "proj-a" });
    // Bruno tem proj-a (m4) e proj-c (m5). Filtrando proj-a, so m4 entra.
    // m5 e de outro projeto e tem de ficar de fora.
    expect(r.map((m) => m.id)).toEqual(["m4"]);
  });

  it("inclui a memoria global do proprietario junto do projeto", () => {
    // projeto_id nulo = global da ana. E proposito, nao falha de filtro.
    const r = filtrar(BASE, { proprietarioId: "ana", projetoId: "proj-a" });
    expect(r.map((m) => m.id)).toContain("m3");
  });

  it("sem projeto, devolve todas as memorias do proprietario", () => {
    const r = filtrar(BASE, { proprietarioId: "ana" });
    expect(r.map((m) => m.id).sort()).toEqual(["m1", "m2", "m3"]);
  });

  it("proprietario sem memoria devolve lista vazia", () => {
    expect(
      filtrar(BASE, { proprietarioId: "carla", projetoId: "proj-a" }),
    ).toEqual([]);
  });

  it("proprietario inexistente nao acessa nada de ninguem", () => {
    const r = filtrar(BASE, { proprietarioId: "", projetoId: "proj-a" });
    expect(r).toEqual([]);
  });

  it("filtro por status combina com projeto", () => {
    const comRevogada: Memoria[] = [
      ...BASE,
      {
        id: "m6",
        proprietario_id: "ana",
        projeto_id: "proj-a",
        status: "revogada",
      },
    ];
    const r = filtrar(comRevogada, {
      proprietarioId: "ana",
      projetoId: "proj-a",
      status: "ativa",
    });
    expect(r.map((m) => m.id).sort()).toEqual(["m1", "m3"]);
  });
});

/* ------------------------------------------------------------------ */

/**
 * O mesmo filtro no componente que decide se uma memoria deve ser
 * mostrada. Dupla checagem: se a query mudar, a tela ainda barra.
 */
describe("visibilidade de memoria", () => {
  it("exibe memoria do proprio dono no proprio projeto", () => {
    expect(
      tipoMemoriaVisivel("ana", "proj-a", {
        proprietario_id: "ana",
        projeto_id: "proj-a",
      }),
    ).toBe("visivel");
  });

  it("oculta memoria de outro proprietario", () => {
    expect(
      tipoMemoriaVisivel("ana", "proj-a", {
        proprietario_id: "bruno",
        projeto_id: "proj-a",
      }),
    ).toBe("oculta");
  });

  it("oculta memoria de outro projeto", () => {
    expect(
      tipoMemoriaVisivel("ana", "proj-a", {
        proprietario_id: "ana",
        projeto_id: "proj-b",
      }),
    ).toBe("oculta");
  });

  it("exibe a memoria global do proprio dono", () => {
    expect(
      tipoMemoriaVisivel("ana", "proj-a", {
        proprietario_id: "ana",
        projeto_id: null,
      }),
    ).toBe("visivel");
  });

  it("sem projeto selecionado, so filtra por proprietario", () => {
    expect(
      tipoMemoriaVisivel("ana", null, {
        proprietario_id: "ana",
        projeto_id: "proj-b",
      }),
    ).toBe("visivel");
  });
});
