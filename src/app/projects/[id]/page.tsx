'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  useEffect(() => {
    if (projectId) {
      // 重定向到概览页面
      router.replace(`/projects/${projectId}/overview`)
    }
  }, [projectId, router])

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-gray-500">正在跳转...</div>
    </div>
  )
}
