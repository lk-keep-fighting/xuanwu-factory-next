import React from 'react'

import { cn } from '@/lib/utils'

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g

const renderInline = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0

  text.replace(INLINE_PATTERN, (match, _group, offset) => {
    if (offset > lastIndex) {
      nodes.push(text.slice(lastIndex, offset))
    }

    if (match.startsWith('**') && match.endsWith('**')) {
      nodes.push(
        <strong key={`${offset}-strong`} className="text-gray-900">
          {match.slice(2, -2)}
        </strong>
      )
    } else if (match.startsWith('*') && match.endsWith('*')) {
      nodes.push(
        <em key={`${offset}-em`} className="text-gray-700">
          {match.slice(1, -1)}
        </em>
      )
    } else if (match.startsWith('`') && match.endsWith('`')) {
      nodes.push(
        <code
          key={`${offset}-code`}
          className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono text-slate-700"
        >
          {match.slice(1, -1)}
        </code>
      )
    } else if (match.startsWith('[')) {
      const labelMatch = /\[([^\]]+)\]\(([^\)]+)\)/.exec(match)
      if (labelMatch) {
        const [, label, href] = labelMatch
        nodes.push(
          <a
            key={`${offset}-link`}
            href={href}
            className="text-primary underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {label}
          </a>
        )
      } else {
        nodes.push(match)
      }
    } else {
      nodes.push(match)
    }

    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

const wrapParagraph = (content: React.ReactNode, index: number) => (
  <p key={`p-${index}`} className="text-sm leading-7 text-gray-700">
    {content}
  </p>
)

export function SimpleMarkdownViewer({ content, className }: { content: string; className?: string }) {
  const lines = content.split(/\r?\n/)
  const elements: React.ReactNode[] = []

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null
  let codeBlock: { language?: string; lines: string[] } | null = null

  const flushList = () => {
    if (!currentList) return
    if (currentList.type === 'ul') {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc space-y-1 pl-6 text-sm leading-7 text-gray-700">
          {currentList.items.map((item, index) => (
            <li key={`ul-item-${index}`}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal space-y-1 pl-6 text-sm leading-7 text-gray-700">
          {currentList.items.map((item, index) => (
            <li key={`ol-item-${index}`}>{renderInline(item)}</li>
          ))}
        </ol>
      )
    }
    currentList = null
  }

  const flushCodeBlock = () => {
    if (!codeBlock) return
    elements.push(
      <pre
        key={`code-${elements.length}`}
        className="overflow-x-auto rounded-md bg-slate-900 px-4 py-3 text-xs text-slate-100"
      >
        <code>{codeBlock.lines.join('\n')}</code>
      </pre>
    )
    codeBlock = null
  }

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (codeBlock) {
        flushCodeBlock()
      } else {
        const language = trimmed.replace('```', '').trim() || undefined
        codeBlock = { language, lines: [] }
      }
      return
    }

    if (codeBlock) {
      codeBlock.lines.push(line)
      return
    }

    if (trimmed === '') {
      flushList()
      elements.push(<div key={`space-${elements.length}`} className="h-3" />)
      return
    }

    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (headingMatch) {
      flushList()
      const level = Math.min(headingMatch[1].length, 4)
      const text = headingMatch[2]
      const headingClass =
        level === 1
          ? 'text-2xl font-bold text-gray-900'
          : level === 2
            ? 'text-xl font-semibold text-gray-900'
            : level === 3
              ? 'text-lg font-semibold text-gray-900'
              : 'text-base font-semibold text-gray-900'
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
      elements.push(
        React.createElement(
          HeadingTag,
          {
            key: `heading-${elements.length}`,
            className: headingClass
          },
          renderInline(text)
        )
      )
      return
    }

    if (trimmed.startsWith('>')) {
      flushList()
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="border-l-4 border-slate-200 pl-4 text-sm italic text-gray-600"
        >
          {renderInline(trimmed.replace(/^>\s?/, ''))}
        </blockquote>
      )
      return
    }

    const orderedMatch = /^\d+\.\s+(.*)$/.exec(trimmed)
    if (orderedMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(orderedMatch[1])
      return
    }

    const unorderedMatch = /^([-*+])\s+(.*)$/.exec(trimmed)
    if (unorderedMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(unorderedMatch[2])
      return
    }

    flushList()
    elements.push(wrapParagraph(renderInline(line), elements.length))
  })

  flushList()
  flushCodeBlock()

  return <div className={cn('flex flex-col gap-4', className)}>{elements}</div>
}
