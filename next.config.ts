import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker部署必需：生成自包含的standalone目录
  output: 'standalone',
  // reactStrictMode: false,
  // 优化生产构建
  poweredByHeader: false,
  compress: true,

  // 构建时跳过类型检查（临时用于构建镜像）
  typescript: {
    ignoreBuildErrors: true,
  },

  // 图片优化配置
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
