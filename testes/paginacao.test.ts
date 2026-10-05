import { describe, expect, it } from "vitest";

import {
  POR_PAGINA,
  hrefDaPagina,
  lerPagina,
  numerosDePagina,
  paginar,
} from "../src/lib/paginacao";

const lista = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginar", () => {
  it("o padrao e 10 por pagina", () => {
    expect(POR_PAGINA).toBe(10);
    const p = paginar(lista(35), 1);
    expect(p.itens).toHaveLength(10);
    expect(p.totalPaginas).toBe(4);
    expect([p.de, p.ate, p.total]).toEqual([1, 10, 35]);
  });

  it("ultima pagina traz so o que sobra", () => {
    const p = paginar(lista(35), 4);
    expect(p.itens).toEqual([31, 32, 33, 34, 35]);
    expect([p.de, p.ate]).toEqual([31, 35]);
  });

  it("nunca passa de 10 por pagina, em nenhuma pagina", () => {
    for (let n = 0; n <= 57; n++) {
      const total = Math.max(1, Math.ceil(n / 10));
      for (let pg = 1; pg <= total; pg++) {
        expect(paginar(lista(n), pg).itens.length).toBeLessThanOrEqual(10);
      }
    }
  });

  it("todas as paginas juntas reconstituem a lista, sem perder nem repetir", () => {
    const todos = lista(47);
    const juntas = [1, 2, 3, 4, 5].flatMap((pg) => paginar(todos, pg).itens);
    expect(juntas).toEqual(todos);
  });

  it("pagina alem do fim cai na ultima, nao numa tela vazia", () => {
    const p = paginar(lista(25), 99);
    expect(p.pagina).toBe(3);
    expect(p.itens).toEqual([21, 22, 23, 24, 25]);
  });

  it("pagina zero, negativa ou lixo vira a primeira", () => {
    expect(paginar(lista(25), 0).pagina).toBe(1);
    expect(paginar(lista(25), -4).pagina).toBe(1);
    expect(paginar(lista(25), Number.NaN).pagina).toBe(1);
  });

  it("lista vazia: uma pagina, sem itens, de 0 a 0", () => {
    const p = paginar([], 1);
    expect(p).toMatchObject({ itens: [], pagina: 1, totalPaginas: 1, total: 0, de: 0, ate: 0 });
  });

  it("exatamente 10 itens e uma pagina so", () => {
    expect(paginar(lista(10), 1).totalPaginas).toBe(1);
    expect(paginar(lista(11), 1).totalPaginas).toBe(2);
  });

  it("avisa quando o teto de carga foi atingido", () => {
    expect(paginar(lista(300), 1, { teto: 300 }).truncado).toBe(true);
    expect(paginar(lista(299), 1, { teto: 300 }).truncado).toBe(false);
    expect(paginar(lista(300), 1).truncado).toBe(false);
  });
});

describe("lerPagina", () => {
  it("le numero valido e trata o resto como 1", () => {
    expect(lerPagina("3")).toBe(3);
    expect(lerPagina(["4", "9"])).toBe(4);
    expect(lerPagina(undefined)).toBe(1);
    expect(lerPagina("abc")).toBe(1);
    expect(lerPagina("0")).toBe(1);
    expect(lerPagina("-2")).toBe(1);
    expect(lerPagina("2.7")).toBe(2);
  });
  it("um numero absurdo nao quebra nada", () => {
    expect(lerPagina("999999999999")).toBe(100_000);
  });
});

describe("numerosDePagina", () => {
  it("poucas paginas: mostra todas", () => {
    expect(numerosDePagina(1, 1)).toEqual([1]);
    expect(numerosDePagina(2, 4)).toEqual([1, 2, 3, 4]);
  });
  it("muitas paginas: primeira, ultima, atual e vizinhas, com reticencias", () => {
    expect(numerosDePagina(1, 20)).toEqual([1, 2, null, 20]);
    expect(numerosDePagina(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(numerosDePagina(20, 20)).toEqual([1, null, 19, 20]);
  });
  it("um unico numero faltando aparece em vez de reticencias", () => {
    expect(numerosDePagina(3, 20)).toEqual([1, 2, 3, 4, null, 20]);
    expect(numerosDePagina(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("hrefDaPagina", () => {
  it("preserva os filtros e troca so a pagina", () => {
    expect(hrefDaPagina("/auditoria", { resultado: "erro", periodo: "7d", pagina: "2" }, "pagina", 3))
      .toBe("/auditoria?resultado=erro&periodo=7d&pagina=3");
  });
  it("a pagina 1 some da URL", () => {
    expect(hrefDaPagina("/auditoria", { resultado: "erro", pagina: "4" }, "pagina", 1))
      .toBe("/auditoria?resultado=erro");
    expect(hrefDaPagina("/fila", {}, "pagina", 1)).toBe("/fila");
  });
  it("ignora filtros vazios e usa o nome de parametro da lista", () => {
    expect(hrefDaPagina("/fila", { status: "", p_saidas: "2" }, "p_saidas", 5)).toBe("/fila?p_saidas=5");
  });
  it("uma lista nao apaga a pagina da outra", () => {
    expect(hrefDaPagina("/fila", { p_tempos: "3", p_saidas: "2" }, "p_saidas", 4))
      .toBe("/fila?p_tempos=3&p_saidas=4");
  });
});
