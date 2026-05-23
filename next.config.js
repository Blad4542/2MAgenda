/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "igzxgawkalsqyydqxbqf.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
