/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  rewrites: async () => {
    // Use environment variable or fallback to production URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://kai-sign-production.up.railway.app";
    
    return [
      {
        source: "/api/py/:path*",
        destination: `${apiUrl}/api/py/:path*`,
      },
      {
        source: "/api/py/generateERC7730",
        destination: `${apiUrl}/api/py/generateERC7730`,
      },
      {
        source: "/docs",
        destination: `${apiUrl}/api/py/docs`,
      },
      {
        source: "/openapi.json",
        destination: `${apiUrl}/api/py/openapi.json`,
      },
      {
        source: "/api/trpc/:path*",
        destination: "/api/trpc/:path*",
      },
    ];
  },
};

export default config;
