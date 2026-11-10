import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Project context lives in README.md; don't auto-generate AGENTS.md/CLAUDE.md.
  agentRules: false,
  async headers() {
    return [{
      source: "/review/check-in",
      headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=()" }],
    }];
  },
};

export default nextConfig;
