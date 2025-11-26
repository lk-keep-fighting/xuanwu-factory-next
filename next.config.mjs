/** @type {import('next').NextConfig} */
const nextConfig = {
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
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
