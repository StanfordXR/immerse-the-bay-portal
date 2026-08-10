import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Project context lives in README.md; don't auto-generate AGENTS.md/CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
