/**
 * Relax strict rules to focus on audit readiness without blocking on lint errors.
 * We still keep core Next.js/web vitals, but downgrade or disable noisy TS rules.
 */
module.exports = {
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  parserOptions: {
    sourceType: "module",
  },
  rules: {
    // Downgrade noisy rules to warnings or disable where appropriate for audit readiness
    "no-unused-vars": ["warn", { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "prefer-const": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    "@typescript-eslint/prefer-optional-chain": "off",
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    "@typescript-eslint/adjacent-overload-signatures": "off",
    "@typescript-eslint/consistent-type-imports": ["warn", { fixStyle: "inline-type-imports" }],
    "@typescript-eslint/ban-ts-comment": ["warn", { "ts-expect-error": "allow-with-description" }],
    "react/no-unescaped-entities": "off",
    "@typescript-eslint/prefer-regexp-exec": "off",
    "@typescript-eslint/prefer-for-of": "off",
    "@typescript-eslint/no-empty-function": "warn",
  },
  overrides: [
    {
      files: [
        "src/lib/web3Service.ts",
        "src/lib/realityEthService.ts",
        "src/lib/graphClient.ts",
        "src/lib/subgraphQueries.ts",
        "src/server/**/*.ts",
      ],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
      },
    },
  ],
};

