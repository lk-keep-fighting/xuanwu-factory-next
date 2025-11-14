'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AiModuleRoot() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/ai/employees')
  }, [router])

  return (
    <div className="py-20 text-center text-gray-500">正在加载 AI 员工模块...</div>
  )
}
