import { useState, useEffect } from 'react'
import type { DockerfileTemplate } from '@/types/project'

interface TemplateCategory {
  value: string
  label: string
  count: number
}

interface UseDockerfileTemplatesReturn {
  templates: DockerfileTemplate[]
  categories: TemplateCategory[]
  loading: boolean
  error: string | null
  getTemplateById: (id: string) => DockerfileTemplate | undefined
  getTemplatesByCategory: (category: string) => DockerfileTemplate[]
  refetch: () => Promise<void>
}

/**
 * Hook for managing Dockerfile templates from the database
 */
export function useDockerfileTemplates(): UseDockerfileTemplatesReturn {
  const [templates, setTemplates] = useState<DockerfileTemplate[]>([])
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch templates and categories in parallel
      const [templatesResponse, categoriesResponse] = await Promise.all([
        fetch('/api/dockerfile-templates'),
        fetch('/api/dockerfile-templates/categories')
      ])

      if (!templatesResponse.ok) {
        throw new Error(`获取模板失败: ${templatesResponse.status}`)
      }

      if (!categoriesResponse.ok) {
        throw new Error(`获取分类失败: ${categoriesResponse.status}`)
      }

      const templatesData = await templatesResponse.json()
      const categoriesData = await categoriesResponse.json()

      if (!templatesData.success) {
        throw new Error(templatesData.error || '获取模板失败')
      }

      if (!categoriesData.success) {
        throw new Error(categoriesData.error || '获取分类失败')
      }

      // Transform database format to legacy format
      const transformedTemplates = templatesData.data.map((template: any) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        baseImage: template.baseImage,
        workdir: template.workdir,
        copyFiles: template.copyFiles,
        installCommands: template.installCommands,
        buildCommands: template.buildCommands,
        runCommand: template.runCommand,
        exposePorts: template.exposePorts,
        envVars: template.envVars,
        dockerfile: template.dockerfile
      }))

      setTemplates(transformedTemplates)
      setCategories(categoriesData.data)
    } catch (err) {
      console.error('获取模板数据失败:', err)
      setError(err instanceof Error ? err.message : '未知错误')
      
      // Fallback to hardcoded templates
      try {
        const { getAllTemplates, getTemplateCategories } = await import('@/lib/dockerfile-templates')
        const fallbackTemplates = await getAllTemplates()
        const fallbackCategories = await getTemplateCategories()
        setTemplates(fallbackTemplates)
        setCategories(fallbackCategories)
      } catch (fallbackError) {
        console.error('加载默认模板失败:', fallbackError)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const getTemplateById = (id: string): DockerfileTemplate | undefined => {
    return templates.find(template => template.id === id)
  }

  const getTemplatesByCategory = (category: string): DockerfileTemplate[] => {
    return templates.filter(template => template.category === category)
  }

  return {
    templates,
    categories,
    loading,
    error,
    getTemplateById,
    getTemplatesByCategory,
    refetch: fetchTemplates
  }
}