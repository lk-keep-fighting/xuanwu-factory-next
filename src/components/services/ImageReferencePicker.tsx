'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatImageReference } from '@/lib/service-image'

export type ImageReferenceValue = {
  optionId?: string | null
  image: string
  tag?: string
}

export type ImageReferenceOption = {
  id?: string
  image: string
  tag?: string
  label?: string
  status?: 'pending' | 'building' | 'success' | 'failed'
  description?: string
  disabled?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  success: '构建成功',
  building: '构建中',
  failed: '构建失败',
  pending: '等待构建'
}

const STATUS_STYLES: Record<string, string> = {
  success: 'text-green-600',
  building: 'text-blue-600',
  failed: 'text-red-600',
  pending: 'text-gray-500'
}

interface ImageReferencePickerProps {
  value: ImageReferenceValue
  options?: ImageReferenceOption[]
  label?: string
  description?: string
  disabled?: boolean
  allowCustom?: boolean
  imagePlaceholder?: string
  tagPlaceholder?: string
  className?: string
  onChange: (value: ImageReferenceValue) => void
}

export function ImageReferencePicker({
  value,
  options = [],
  label,
  description,
  disabled,
  allowCustom = true,
  imagePlaceholder,
  tagPlaceholder,
  className,
  onChange
}: ImageReferencePickerProps) {
  const hasOptions = options.length > 0
  const inputsDisabled = disabled || (!allowCustom && hasOptions)
  const showInputs = allowCustom || !hasOptions

  const optionEntries = useMemo(
    () =>
      options.map((option, index) => ({
        option,
        value: option.id ?? `${option.image}:${option.tag ?? ''}:${index}`
      })),
    [options]
  )

  const normalizedImage = value.image?.trim() ?? ''
  const normalizedTag = value.tag?.trim() ?? ''

  const matchedById = value.optionId
    ? optionEntries.find((entry) => entry.option.id === value.optionId)
    : undefined

  const matchedByValue = !matchedById
    ? optionEntries.find(
        (entry) =>
          entry.option.image === normalizedImage &&
          (entry.option.tag ?? '') === normalizedTag
      )
    : undefined

  const selectedEntry = matchedById ?? matchedByValue ?? null
  const selectValue = selectedEntry
    ? selectedEntry.value
    : allowCustom
      ? '__custom__'
      : ''

  const handleSelectChange = (selected: string) => {
    if (selected === '__custom__') {
      onChange({
        optionId: null,
        image: normalizedImage,
        tag: normalizedTag
      })
      return
    }

    const entry = optionEntries.find((item) => item.value === selected)
    if (entry) {
      onChange({
        optionId: entry.option.id ?? null,
        image: entry.option.image,
        tag: entry.option.tag
      })
    }
  }

  const handleImageChange = (next: string) => {
    onChange({
      optionId: null,
      image: next,
      tag: value.tag
    })
  }

  const handleTagChange = (next: string) => {
    onChange({
      optionId: null,
      image: value.image,
      tag: next
    })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {label ? <Label className="text-sm font-medium text-gray-900">{label}</Label> : null}
      {description ? <p className="text-sm text-gray-500">{description}</p> : null}

      {hasOptions ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">选择已有镜像</Label>
          <Select
            value={selectValue}
            onValueChange={handleSelectChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择镜像" />
            </SelectTrigger>
            <SelectContent>
              {optionEntries.map(({ option, value: optionValue }) => {
                const display = option.label ?? formatImageReference(option.image, option.tag)
                const status = option.status ?? 'pending'
                return (
                  <SelectItem
                    key={optionValue}
                    value={optionValue}
                    disabled={disabled || option.disabled}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">{display}</span>
                      {option.status ? (
                        <span className={cn('text-xs', STATUS_STYLES[status] ?? 'text-gray-500')}>
                          {STATUS_LABELS[status] ?? status}
                        </span>
                      ) : null}
                      {option.description ? (
                        <span className="text-xs text-gray-500">{option.description}</span>
                      ) : null}
                    </div>
                  </SelectItem>
                )
              })}
              {allowCustom ? (
                <SelectItem value="__custom__">自定义镜像</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showInputs ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label className="text-sm font-medium text-gray-700">镜像仓库</Label>
            <Input
              value={value.image}
              onChange={(event) => handleImageChange(event.target.value)}
              placeholder={imagePlaceholder ?? 'registry/project/service'}
              disabled={inputsDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">镜像标签</Label>
            <Input
              value={value.tag ?? ''}
              onChange={(event) => handleTagChange(event.target.value)}
              placeholder={tagPlaceholder ?? 'latest'}
              disabled={inputsDisabled}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
