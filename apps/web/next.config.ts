import type { NextConfig } from "next";
import { BROWSER_API_BASE_PATH } from "./lib/api/base-path";
import { serverEnv } from "./lib/env";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        // Proxying keeps browser API calls same-origin, so the session cookie is
        // first-party and no CORS preflight runs on a slow connection.
        source: `${BROWSER_API_BASE_PATH}/:path*`,
        destination: `${serverEnv.API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
