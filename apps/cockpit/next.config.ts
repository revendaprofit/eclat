import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Só vale em desenvolvimento: sem isso o Next bloqueia os recursos de dev servidos para
  // http://127.0.0.1 e a página carrega "morta" — o HTML aparece, mas o React nunca hidrata e
  // nenhum clique funciona. Não tem efeito no build de produção.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
