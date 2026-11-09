import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Ochilgan sahifa brauzerda 30 soniya saqlanadi: shu vaqt ichida unga qaytilsa — serverni kutmasdan darhol.
    // O'zgarishdan keyin (server action → lib/after-change.ts) brauzer keshi tozalanadi, o'z o'zgarishi darhol ko'rinadi.
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
