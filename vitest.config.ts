import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['testes/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Espelha o `@/*` do tsconfig, senao os testes nao resolvem os
      // imports que o Next resolve em dev e build.
      '@': fileURLToPath(new URL('./src', import.meta.url)),

      // `server-only` lanca em runtime fora de um Server Component, e o
      // pacote nao funciona no ambiente node do vitest. Os testes cobrem
      // a logica de autorizacao direto, sem passar por ele.
      'server-only': fileURLToPath(new URL('./testes/mocks/server-only.ts', import.meta.url)),
    },
  },
});