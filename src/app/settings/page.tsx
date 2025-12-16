'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCcw, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { systemConfigSvc } from '@/service/systemConfigSvc'
import { GitProvider } from '@/types/project'
import type { GitProviderConfigResponse, UpdateGitProviderConfigPayload } from '@/types/system'

interface GitProviderFormState {
  enabled: boolean
  baseUrl: string
  apiToken: string
  resetToken: boolean
}

const createInitialFormState = (): GitProviderFormState => ({
  enabled: true,
  baseUrl: '',
  apiToken: '',
  resetToken: false
})

const SettingsPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<GitProviderFormState>(createInitialFormState)
  const [hasToken, setHasToken] = useState(false)
  const [lastLoadedConfig, setLastLoadedConfig] = useState<GitProviderConfigResponse>(null)

  const loadConfig = async () => {
    setLoading(true)
    try {
      const config = await systemConfigSvc.getGitProviderConfig()
      setLastLoadedConfig(config)

      if (config) {
        setForm((prev) => ({
          ...prev,
          enabled: config.enabled,
          baseUrl: config.baseUrl,
          apiToken: '',
          resetToken: false
        }))
        setHasToken(config.hasToken)
      } else {
        setForm(createInitialFormState())
        setHasToken(false)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '配置加载失败'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.baseUrl.trim()) {
      toast.error('请填写 GitLab 基础地址')
      return
    }

    setSaving(true)

    try {
      const payload: UpdateGitProviderConfigPayload = {
        provider: GitProvider.GITLAB,
        baseUrl: form.baseUrl.trim(),
        enabled: form.enabled,
        ...(form.apiToken.trim() ? { apiToken: form.apiToken.trim() } : {}),
        ...(form.resetToken ? { resetToken: true } : {})
      }

      const result = await systemConfigSvc.updateGitProviderConfig(payload)

      if (result) {
        setForm((prev) => ({
          ...prev,
          enabled: result.enabled,
          baseUrl: result.baseUrl,
          apiToken: '',
          resetToken: false
        }))
        setHasToken(result.hasToken)
        setLastLoadedConfig(result)
      }

      toast.success('配置已保存')
    } catch (error) {
      const message = error instanceof Error ? error.message : '配置保存失败'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetToken = () => {
    setForm((prev) => ({
      ...prev,
      apiToken: '',
      resetToken: true
    }))
    setHasToken(false)
  }

  const handleReload = () => {
    void loadConfig()
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Git配置</h1>
            <p className="text-sm text-gray-500">管理全局 Git 提供商配置，用于应用服务创建和仓库检索。</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReload} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              重新加载
            </Button>
          </div>
        </div>

        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              GitLab 全局配置
              {form.enabled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  <ShieldCheck className="h-3 w-3" /> 启用
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                  <ShieldOff className="h-3 w-3" /> 已禁用
                </span>
              )}
            </CardTitle>
            <CardDescription>
              使用 GitLab Personal Access Token 进行授权，支持私有化部署的 GitLab 实例。
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>启用状态</Label>
                <Select
                  value={form.enabled ? 'enabled' : 'disabled'}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, enabled: value === 'enabled' }))}
                  disabled={loading || saving}
                >
                  <SelectTrigger className="w-full sm:w-60">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">启用</SelectItem>
                    <SelectItem value="disabled">禁用</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">禁用后，创建应用服务时将无法搜索 Git 仓库。</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gitlab-base-url">GitLab 基础地址 *</Label>
                <Input
                  id="gitlab-base-url"
                  value={form.baseUrl}
                  onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                  placeholder="例如：https://gitlab.example.com"
                  disabled={loading || saving}
                  required
                />
                <p className="text-xs text-gray-500">请输入 GitLab 实例的根地址，无需包含 /api/v4。</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gitlab-api-token">API Token</Label>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {hasToken && !form.resetToken ? <span>已配置 Token</span> : <span>Token 未配置</span>}
                    {hasToken && !form.resetToken ? (
                      <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={handleResetToken} disabled={saving || loading}>
                        清除 Token
                      </Button>
                    ) : null}
                  </div>
                </div>
                <Input
                  id="gitlab-api-token"
                  type="password"
                  value={form.apiToken}
                  onChange={(event) => setForm((prev) => ({ ...prev, apiToken: event.target.value }))}
                  placeholder={hasToken && !form.resetToken ? '留空表示保持现有 Token' : '请输入 GitLab Personal Access Token'}
                  disabled={loading || saving}
                />
                <p className="text-xs text-gray-500">需要至少具有 api 和 read_api 权限的 Personal Access Token。</p>
                {form.resetToken ? (
                  <p className="text-xs text-red-500">保存后将移除当前 Token。</p>
                ) : null}
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t bg-gray-50">
              <div className="text-xs text-gray-500">
                {lastLoadedConfig ? '最近已加载系统配置，可直接进行修改。' : '尚未配置 Git 提供商，请先完成配置。'}
              </div>
              <Button type="submit" disabled={saving || loading} className="min-w-[120px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存配置'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage
