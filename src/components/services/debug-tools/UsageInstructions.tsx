'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import type { MultiDebugConfig } from '@/types/project'
import { generateUsageInstructions } from '@/lib/debug-tools-utils'

interface UsageInstructionsProps {
  config: MultiDebugConfig | null | undefined
}

export function UsageInstructions({ config }: UsageInstructionsProps) {
  // Don't show if no tools are enabled
  if (!config || !config.enabled || !config.tools || config.tools.length === 0) {
    return null
  }

  const instructions = generateUsageInstructions(config)

  // Parse the markdown-style instructions into React elements
  const renderInstructions = () => {
    const lines = instructions.split('\n')
    const elements: React.ReactNode[] = []
    let inCodeBlock = false
    let codeLines: string[] = []

    lines.forEach((line, index) => {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          elements.push(
            <pre key={`code-${index}`} className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto my-2">
              {codeLines.join('\n')}
            </pre>
          )
          codeLines = []
          inCodeBlock = false
        } else {
          // Start of code block
          inCodeBlock = true
        }
        return
      }

      if (inCodeBlock) {
        codeLines.push(line)
        return
      }

      // Handle headers
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${index}`} className="font-semibold text-sm mt-3 mb-2">
            {line.replace('## ', '')}
          </h3>
        )
        return
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${index}`} className="font-medium text-sm mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        )
        return
      }

      // Handle bold text with **
      if (line.includes('**')) {
        const parts = line.split('**')
        const rendered = parts.map((part, i) => 
          i % 2 === 1 ? <strong key={i}>{part}</strong> : part
        )
        elements.push(
          <p key={`p-${index}`} className="text-sm my-1">
            {rendered}
          </p>
        )
        return
      }

      // Handle list items
      if (line.startsWith('- ')) {
        elements.push(
          <li key={`li-${index}`} className="text-sm ml-4 my-1">
            {line.replace('- ', '')}
          </li>
        )
        return
      }

      // Handle regular paragraphs
      if (line.trim()) {
        elements.push(
          <p key={`p-${index}`} className="text-sm my-1">
            {line}
          </p>
        )
      }
    })

    return elements
  }

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>使用方法</AlertTitle>
      <AlertDescription>
        <div className="space-y-2 mt-2">
          {renderInstructions()}
          
          <div className="flex items-start gap-2 mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <Info className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800">
              <strong>提示：</strong>调试工具仅在容器内部可用，不会修改原始镜像。
              建议在开发/测试环境使用，生产环境按需启用。
            </p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}
