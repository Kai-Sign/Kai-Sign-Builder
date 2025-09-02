import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    CURVEGRID_JWT: z.string().optional(),
    ETHERSCAN_API_KEY: z.string().optional(),
    ALCHEMY_RPC_URL: z.string().optional(),
    USE_MOCK: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   * 
   * WARNING: Only add variables here that are safe to expose publicly!
   */
  client: {
    NEXT_PUBLIC_GTM: z.string().optional(),
    NEXT_PUBLIC_ONETRUST: z.string().optional(),
    NEXT_PUBLIC_API_URL: z.string().optional(),
    NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS: z.string().optional(),
    NEXT_PUBLIC_IPFS_GATEWAY_URL: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_GTM: process.env.NEXT_PUBLIC_GTM,
    NEXT_PUBLIC_ONETRUST: process.env.NEXT_PUBLIC_ONETRUST,
    CURVEGRID_JWT: process.env.CURVEGRID_JWT,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,
    ALCHEMY_RPC_URL: process.env.ALCHEMY_RPC_URL,
    USE_MOCK: process.env.USE_MOCK,
    NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_KAISIGN_CONTRACT_ADDRESS,
    NEXT_PUBLIC_IPFS_GATEWAY_URL: process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,

});
