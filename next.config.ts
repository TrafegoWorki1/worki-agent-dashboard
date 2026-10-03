import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O bundle do cliente nunca deve conter nada de server.
  // As variaveis NEXT_PUBLIC_* sao inlinadas no build pelo Next, entao
  // o unico jeito de garantir que nenhum segredo entre no bundle e nao
  // existir variavel NEXT_PUBLIC_ de servidor. Ver src/lib/env.ts.
};

export default nextConfig;