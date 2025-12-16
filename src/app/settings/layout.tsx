'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Settings, 
  GitBranch, 
  FileText, 
  ChevronLeft,
  Menu,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

interface SettingsLayoutProps {
  children: React.ReactNode
}

const menuItems = [
  {
    id: 'git',
    label: 'Git配置',
    icon: GitBranch,
    href: '/settings',
    description: '配置Git提供商和访问凭据'
  },
  {
    id: 'dockerfile-templates',
    label: 'Dockerfile模板',
    icon: FileText,
    href: '/settings/dockerfile-templates',
    description: '管理Dockerfile构建模板'
  }
]

function SettingsNavigation({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={cn("space-y-2", className)}>
      {menuItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              "hover:bg-gray-100 hover:text-gray-900",
              isActive 
                ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700" 
                : "text-gray-600"
            )}
          >
            <Icon className="h-4 w-4" />
            <div className="flex-1">
              <div className="font-medium">{item.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {item.description}
              </div>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 移动端顶部栏 */}
      <div className="lg:hidden border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold">系统配置</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4">
                  <SettingsNavigation />
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">系统配置</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/projects" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              返回项目
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* 桌面端侧边栏 */}
        <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0">
          <div className="flex flex-col flex-1 bg-white border-r">
            {/* 侧边栏头部 */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <Settings className="h-6 w-6 text-blue-600" />
                <span className="text-xl font-semibold">系统配置</span>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects" className="flex items-center gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>

            {/* 导航菜单 */}
            <div className="flex-1 p-6">
              <SettingsNavigation />
            </div>

            {/* 侧边栏底部 */}
            <div className="p-6 border-t bg-gray-50">
              <div className="text-xs text-gray-500">
                <div className="font-medium mb-1">系统配置管理</div>
                <div>管理全局系统设置和模板配置</div>
              </div>
            </div>
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 lg:ml-80">
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}