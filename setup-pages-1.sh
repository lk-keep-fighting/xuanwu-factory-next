#!/bin/bash

# Layout
cat > src/app/layout.tsx << 'LAYOUTEOF'
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "玄武工厂平台",
  description: "云原生应用管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
LAYOUTEOF

# Home Page (redirect to projects)
cat > src/app/page.tsx << 'HOMEEOF'
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/projects')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">加载中...</p>
    </div>
  )
}
HOMEEOF

echo "✅ Layout 和首页创建完成"
