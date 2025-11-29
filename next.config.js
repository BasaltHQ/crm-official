const withNextIntl = require("next-intl/plugin")("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    domains: ["localhost", "res.cloudinary.com", "lh3.googleusercontent.com"]
  }
};

module.exports = withNextIntl(nextConfig);
