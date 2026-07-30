import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { AUTH_BASE_PATH } from "./lib/auth/auth-paths";
import { BROWSER_API_BASE_PATH } from "./lib/api/base-path";
import { serverEnv } from "./lib/env";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        // Better Auth builds OAuth callbacks and email links from the origin the
        // browser loaded, so its paths must survive the hop unchanged — hence a
        // rule of its own, ahead of the general one that strips `/api`.
        source: `${AUTH_BASE_PATH}/:path*`,
        destination: `${serverEnv.API_URL}${AUTH_BASE_PATH}/:path*`,
      },
      {
        // Proxying keeps browser API calls same-origin, so the session cookie is
        // first-party and no CORS preflight runs on a slow connection.
        source: `${BROWSER_API_BASE_PATH}/:path*`,
        destination: `${serverEnv.API_URL}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
