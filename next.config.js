/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Initialize OpenNext's Cloudflare dev bridge so `next dev` exposes the same
// Cloudflare bindings (env, R2, KV) that production gets. Safe no-op outside
// Cloudflare deploys.
const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
initOpenNextCloudflareForDev();

const { CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET } = process.env;

if (!CIRCLE_API_KEY?.trim()) {
  throw new Error("CIRCLE_API_KEY environment variable is missing or empty");
}

if (!CIRCLE_ENTITY_SECRET?.trim()) {
  throw new Error("CIRCLE_ENTITY_SECRET environment variable is missing or empty");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext Cloudflare reads .next/standalone/.next/BUILD_ID during bundle.
  // Next 15 requires this opt-in; Next 16 sets it automatically.
  output: "standalone",
  // Empty Turbopack config acknowledges the default-on Turbopack runtime in
  // Next 16+. Turbopack resolves the optional MetaMask / WalletConnect deps
  // gracefully on its own; if a future wallet import errors at runtime, add
  // resolveAlias entries here. The webpack block below is preserved for
  // `next dev --webpack` / `next build --webpack` fallback path.
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
