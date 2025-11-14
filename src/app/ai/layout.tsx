'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/ai/employees', label: 'AI 员工列表' },
  { href: '/ai/role-templates', label: '角色模板管理' }
]

export default function AiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-primary font-semibold tracking-wide uppercase">AI 模块预览</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">AI 员工运营中心</h1>
            <p className="text-gray-500 mt-2 max-w-2xl">
              根据《AI 员工模块设计》构建的前端功能原型，覆盖 AI 员工管理、角色模板维护与任务派发流程。
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden lg:inline">需要返回项目管理？</span>
            <Link
              href="/projects"
              className="rounded-full border border-gray-200 px-4 py-2 bg-white hover:bg-gray-50 transition"
            >
              返回项目列表
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
                    {isActive ? (
                      <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-primary rounded-t" />
                    ) : null}
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
