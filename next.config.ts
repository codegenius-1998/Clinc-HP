import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a minimal server.js plus only the node_modules actually reached at
  // runtime — instead of the full node_modules tree. The Docker image for Cloudflare Containers
  // (see Dockerfile) copies just that output rather than the whole project.
  output: "standalone",
};

export default nextConfig;
