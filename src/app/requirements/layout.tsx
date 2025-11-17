'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const NAV_ITEMS = [{ href: '/requirements', label: '需求列表' }]

export default function RequirementsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">需求管理模块</p>
            <h1 className="text-3xl font-bold text-gray-900">需求协作中枢原型</h1>
            <p className="text-gray-500 max-w-3xl">
              基于《需求管理模块设计》实现的前端原型，展示需求生命周期的核心流程：录入、筛选、派发与状态追踪，便于快速验证交互体验。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden lg:inline">返回至项目管理？</span>
            <Link
              href="/projects"
              className="rounded-full border border-gray-200 px-4 py-2 bg-white hover:bg-gray-50 transition"
            >
              项目列表
            </Link>
          </div>
        </div>
        <nav className="border-t bg-gray-50">
          <div className="max-w-7xl mx-auto px-6">
            <ul className="flex items-center gap-6 text-sm font-medium">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <li key={item.href} className="relative">
                    <Link
                      href={item.href}
                      className={cn(
                        'inline-flex items-center gap-2 px-1 py-4 transition-colors',
                        isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-800'
                      )}
                    >
                      {item.label}
                    </Link>
                    {isActive ? <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-primary rounded-t" /> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
