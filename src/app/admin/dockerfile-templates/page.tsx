'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 重定向页面 - 将旧的admin路径重定向到新的settings路径
 */
export default function DockerfileTemplatesRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    // 重定向到新的settings路径
    router.replace('/settings/dockerfile-templates')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-lg text-gray-600">正在重定向到系统配置...</div>
        <div className="text-sm text-gray-500 mt-2">
          Dockerfile模板管理已移动到系统配置中
        </div>
      </div>
    </div>
  )
}