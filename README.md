This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 🚀 新功能：CPU与内存监控 + 趋势图

在服务详情页的"服务状态"Tab中，现已支持实时的CPU和内存使用监控，以及资源使用趋势图！

### 快速开始

```bash
# 1. 安装 Metrics Server（如果尚未安装）
./scripts/install-metrics-server.sh

# 2. 验证安装
./scripts/check-metrics-server.sh

# 3. 访问服务详情页查看监控数据
```

### 功能特性

#### 实时监控
- ✅ 实时 CPU 和内存使用量显示
- ✅ 使用率百分比计算
- ✅ 彩色进度条可视化（绿色<60%，黄色60-80%，红色>80%）
- ✅ 自动刷新支持
- ✅ 友好的错误提示

#### 趋势图（新增）
- ✅ 折线图显示最近1小时的资源使用趋势
- ✅ 自动采集数据（每30秒一次）
- ✅ 数据持久化（刷新页面不丢失）
- ✅ 统计信息（平均值、峰值）
- ✅ 交互式图表（鼠标悬停查看详情）

### 文档

#### 基础功能
- 📖 [快速开始指南](doc/METRICS_QUICKSTART.md) - 5分钟上手
- 📚 [完整功能文档](doc/METRICS_MONITORING.md) - 详细说明和故障排查
- 🧪 [测试指南](doc/METRICS_TESTING.md) - 测试场景和方法
- 📊 [功能总结](doc/METRICS_SUMMARY.md) - 技术实现和验收标准

#### 趋势图功能
- 📈 [趋势图使用指南](doc/METRICS_CHART_GUIDE.md) - 详细使用说明
- 🎬 [趋势图演示](doc/METRICS_CHART_DEMO.md) - 5分钟快速演示

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
