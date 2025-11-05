import { setTimeout as delay } from 'node:timers/promises'

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 5000
const MAX_CONSOLE_TEXT_LENGTH = 20000

export class JenkinsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JenkinsConfigError'
  }
}

export class JenkinsBuildError extends Error {
  queueUrl?: string
  buildUrl?: string
  result?: string | null
  consoleText?: string

  constructor(
    message: string,
    options: {
      queueUrl?: string
      buildUrl?: string
      result?: string | null
      consoleText?: string
    } = {}
  ) {
    super(message)
    this.name = 'JenkinsBuildError'
    this.queueUrl = options.queueUrl
    this.buildUrl = options.buildUrl
    this.result = options.result
    this.consoleText = options.consoleText
  }
}

type JenkinsConfig = {
  baseUrl: string
  user: string
  apiToken: string
  jobName: string
  jobToken?: string
  timeoutMs?: number
  pollIntervalMs?: number
}

type JenkinsBuildParameters = Record<string, string | number | boolean | null | undefined>

type JenkinsBuildOptions = {
  jobName?: string
  parameters: JenkinsBuildParameters
  timeoutMs?: number
  pollIntervalMs?: number
}

export type JenkinsBuildResult = {
  buildNumber: number
  queueUrl: string
  buildUrl: string
  result: string | null
  durationMs?: number
  consoleText?: string
}

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

export class JenkinsClient {
  private readonly baseUrl: string
  private readonly user: string
  private readonly apiToken: string
  private readonly jobName: string
  private readonly jobToken?: string
  private readonly authorizationHeader: string
  private readonly timeoutMs: number
  private readonly pollIntervalMs: number
  private crumbPromise?: Promise<{ header: string; value: string } | null>

  constructor(config: JenkinsConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.user = config.user
    this.apiToken = config.apiToken
    this.jobName = config.jobName
    this.jobToken = config.jobToken
    this.authorizationHeader = `Basic ${Buffer.from(`${this.user}:${this.apiToken}`).toString('base64')}`
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  }

  static fromEnvironment(overrides: Partial<JenkinsConfig> = {}): JenkinsClient {
    const baseUrl = (overrides.baseUrl ?? process.env.JENKINS_BASE_URL ?? '').trim()
    if (!baseUrl) {
      throw new JenkinsConfigError('Jenkins 未配置：请设置 JENKINS_BASE_URL 环境变量。')
    }

    const user = (overrides.user ?? process.env.JENKINS_USER ?? process.env.JENKINS_USERNAME ?? '').trim()
    if (!user) {
      throw new JenkinsConfigError('Jenkins 未配置：请设置 JENKINS_USER（或 JENKINS_USERNAME）环境变量。')
    }

    const apiToken = (overrides.apiToken ?? process.env.JENKINS_API_TOKEN ?? '').trim()
    if (!apiToken) {
      throw new JenkinsConfigError('Jenkins 未配置：请设置 JENKINS_API_TOKEN 环境变量。')
    }

    const jobName = (overrides.jobName ?? process.env.JENKINS_JOB_NAME ?? '').trim()
    if (!jobName) {
      throw new JenkinsConfigError('Jenkins 未配置：请设置 JENKINS_JOB_NAME 环境变量。')
    }

    const jobToken = (overrides.jobToken ?? process.env.JENKINS_JOB_TOKEN ?? '').trim() || undefined
    const timeoutMs = overrides.timeoutMs ?? parsePositiveInt(process.env.JENKINS_BUILD_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
    const pollIntervalMs = overrides.pollIntervalMs ?? parsePositiveInt(process.env.JENKINS_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS)

    return new JenkinsClient({
      baseUrl,
      user,
      apiToken,
      jobName,
      jobToken,
      timeoutMs,
      pollIntervalMs
    })
  }

  async triggerBuild(options: JenkinsBuildOptions): Promise<JenkinsBuildResult> {
    const jobName = options.jobName ?? this.jobName
    const jobPath = this.normalizeJobPath(jobName)
    const endpoint = `${this.baseUrl}/${jobPath}/buildWithParameters`
    const buildUrl = this.jobToken ? `${endpoint}?token=${encodeURIComponent(this.jobToken)}` : endpoint

    const params = new URLSearchParams()
    for (const [key, rawValue] of Object.entries(options.parameters ?? {})) {
      if (rawValue === null || rawValue === undefined) {
        continue
      }
      params.append(key, String(rawValue))
    }

    const crumb = await this.resolveCrumb()
    const headers: Record<string, string> = {
      Authorization: this.authorizationHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    }

    if (crumb) {
      headers[crumb.header] = crumb.value
    }

    const response = await fetch(buildUrl, {
      method: 'POST',
      headers,
      body: params.toString()
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new JenkinsBuildError(`触发 Jenkins 构建失败（${response.status}）`, {
        consoleText: errorText || undefined
      })
    }

    const queueLocation = response.headers.get('location')
    if (!queueLocation) {
      throw new JenkinsBuildError('Jenkins 响应缺少队列地址。')
    }

    const queueUrl = this.ensureAbsoluteUrl(queueLocation)
    const pollIntervalMs = options.pollIntervalMs ?? this.pollIntervalMs
    const timeoutMs = options.timeoutMs ?? this.timeoutMs

    const { buildNumber, buildUrl: absoluteBuildUrl } = await this.waitForQueueItem(queueUrl, pollIntervalMs, timeoutMs)
    const buildInfo = await this.waitForBuildCompletion(absoluteBuildUrl, pollIntervalMs, timeoutMs)

    return {
      buildNumber,
      queueUrl,
      buildUrl: absoluteBuildUrl,
      result: buildInfo.result,
      durationMs: buildInfo.durationMs,
      consoleText: buildInfo.consoleText
    }
  }

  private async waitForQueueItem(queueUrl: string, pollIntervalMs: number, timeoutMs: number) {
    const apiUrl = this.appendApiJson(queueUrl)
    const deadline = Date.now() + timeoutMs

    while (true) {
      const response = await fetch(apiUrl, {
        headers: this.buildHeaders({ Accept: 'application/json' })
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new JenkinsBuildError(`查询 Jenkins 队列信息失败（${response.status}）`, {
          queueUrl,
          consoleText: errorText || undefined
        })
      }

      const data: any = await response.json().catch(() => ({}))

      if (data?.cancelled) {
        const reason = typeof data?.why === 'string' ? data.why : undefined
        throw new JenkinsBuildError('Jenkins 构建已被取消或中止。', {
          queueUrl,
          consoleText: reason
        })
      }

      if (data?.executable && typeof data.executable.number === 'number' && data.executable.url) {
        const buildNumber = data.executable.number as number
        const buildUrl = this.ensureAbsoluteUrl(String(data.executable.url))
        return { buildNumber, buildUrl }
      }

      if (Date.now() > deadline) {
        throw new JenkinsBuildError('等待 Jenkins 队列分配执行器超时。', {
          queueUrl
        })
      }

      await delay(pollIntervalMs)
    }
  }

  private async waitForBuildCompletion(buildUrl: string, pollIntervalMs: number, timeoutMs: number) {
    const apiUrl = this.appendApiJson(buildUrl)
    const deadline = Date.now() + timeoutMs

    while (true) {
      const response = await fetch(apiUrl, {
        headers: this.buildHeaders({ Accept: 'application/json' })
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new JenkinsBuildError(`查询 Jenkins 构建状态失败（${response.status}）`, {
          buildUrl,
          consoleText: errorText || undefined
        })
      }

      const data: any = await response.json().catch(() => ({}))
      const building = Boolean(data?.building)
      const result = typeof data?.result === 'string' ? (data.result as string) : null

      if (!building) {
        const consoleText = await this.fetchConsoleText(buildUrl)
        return {
          result,
          durationMs: typeof data?.duration === 'number' ? (data.duration as number) : undefined,
          consoleText
        }
      }

      if (Date.now() > deadline) {
        throw new JenkinsBuildError('等待 Jenkins 构建完成超时。', {
          buildUrl
        })
      }

      await delay(pollIntervalMs)
    }
  }

  private async fetchConsoleText(buildUrl: string): Promise<string | undefined> {
    const consoleUrl = this.ensureConsoleUrl(buildUrl)

    try {
      const response = await fetch(consoleUrl, {
        headers: this.buildHeaders({ Accept: 'text/plain' })
      })

      if (!response.ok) {
        return undefined
      }

      const text = await response.text()
      if (text.length > MAX_CONSOLE_TEXT_LENGTH) {
        return text.slice(text.length - MAX_CONSOLE_TEXT_LENGTH)
      }

      return text
    } catch (error) {
      console.warn('[Jenkins] 获取控制台日志失败:', error)
      return undefined
    }
  }

  private async resolveCrumb(): Promise<{ header: string; value: string } | null> {
    if (this.crumbPromise) {
      return this.crumbPromise
    }

    this.crumbPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/crumbIssuer/api/json`, {
          headers: this.buildHeaders({ Accept: 'application/json' })
        })

        if (!response.ok) {
          if (response.status === 404) {
            return null
          }
          const errorText = await response.text().catch(() => '')
          console.warn(`[Jenkins] 获取 Crumb 失败（${response.status}）: ${errorText}`)
          return null
        }

        const data: any = await response.json().catch(() => ({}))
        const header = typeof data?.crumbRequestField === 'string' ? (data.crumbRequestField as string) : null
        const crumb = typeof data?.crumb === 'string' ? (data.crumb as string) : null

        if (!header || !crumb) {
          return null
        }

        return { header, value: crumb }
      } catch (error) {
        console.warn('[Jenkins] 请求 Crumb 时发生异常:', error)
        return null
      }
    })()

    return this.crumbPromise
  }

  private normalizeJobPath(jobName: string): string {
    return jobName
      .split('/')
      .filter(Boolean)
      .map((segment) => `job/${encodeURIComponent(segment)}`)
      .join('/')
  }

  private ensureAbsoluteUrl(value: string): string {
    try {
      return new URL(value).toString()
    } catch {
      return new URL(value.replace(/^\/+/u, ''), `${this.baseUrl}/`).toString()
    }
  }

  private appendApiJson(url: string): string {
    return url.endsWith('/') ? `${url}api/json` : `${url}/api/json`
  }

  private ensureConsoleUrl(buildUrl: string): string {
    return buildUrl.endsWith('/') ? `${buildUrl}consoleText` : `${buildUrl}/consoleText`
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: this.authorizationHeader,
      ...(extra ?? {})
    }
  }
}
