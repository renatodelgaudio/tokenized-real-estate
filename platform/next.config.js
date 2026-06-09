/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a fully static export (plain HTML/CSS/JS) so the app can be hosted
  // for free on Cloudflare Pages, GitHub Pages, Vercel, S3, etc. — no server.
  output: "export",

  // Static export can't optimize images on a server, so serve them as-is.
  images: { unoptimized: true },

  // Emit each route as a folder with index.html (nicer on static hosts).
  trailingSlash: true,

  webpack: (config) => {
    // wagmi's connector bundle references optional WalletConnect / MetaMask-SDK
    // dependencies we don't use (we only use the injected connector). Mark them
    // as not-resolvable to silence build warnings.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
