import { randomUUID } from 'crypto'

import {
  type RequirementAiTaskLink,
  type RequirementCreatePayload,
  type RequirementDetail,
  type RequirementDispatchPayload,
  type RequirementDispatchResult,
  type RequirementFilterOptions,
  type RequirementListItem,
  type RequirementListQuery,
  type RequirementListResponse,
  type RequirementProjectRef,
  type RequirementServiceRef,
  type RequirementUpdatePayload
} from '@/types/requirement'
import { type AIEmployeeType, type AITaskPriority, type AITaskStatus } from '@/types/ai'

const iso = (date: Date) => date.toISOString()
const now = new Date()
const daysAgo = (days: number) => {
  const clone = new Date(now)
  clone.setDate(clone.getDate() - days)
  return clone
}

const projects: RequirementProjectRef[] = [
  { id: 'proj-xuanwu', name: '玄武工厂平台', identifier: 'xuanwu-factory' },
  { id: 'proj-nova', name: 'Nova 计费中台', identifier: 'nova-billing' },
  { id: 'proj-lake', name: '数据湖治理平台', identifier: 'lake-governance' }
]

const services: RequirementServiceRef[] = [
  { id: 'svc-portal-web', projectId: 'proj-xuanwu', name: 'Portal Web 前端' },
  { id: 'svc-ai-center-api', projectId: 'proj-xuanwu', name: 'AI 执行中心 API' },
  { id: 'svc-billing-engine', projectId: 'proj-nova', name: '计费引擎服务' },
  { id: 'svc-billing-console', projectId: 'proj-nova', name: '计费运营后台' },
  { id: 'svc-data-quality', projectId: 'proj-lake', name: '数据质量服务' }
]

const aiEmployees: Array<{ id: string; name: string; type: AIEmployeeType }> = [
  { id: 'ai-employee-frontend-01', name: '前端小玄', type: 'ENGINEER' },
  { id: 'ai-employee-backend-01', name: '后端玄策', type: 'ENGINEER' },
  { id: 'ai-employee-qa-01', name: '质量守护者', type: 'QA' }
]

const projectMap = new Map(projects.map((item) => [item.id, item]))
const serviceMap = new Map(services.map((item) => [item.id, item]))
const aiEmployeeMap = new Map(aiEmployees.map((item) => [item.id, item]))

type RequirementTaskLinkInternal = {
  id: string
  aiTaskAssignmentId: string
  aiEmployeeId: string
  taskTitle: string
  projectId: string
  serviceId?: string
  branchName?: string
  expectedOutputs?: string[]
  priority: AITaskPriority
  status: AITaskStatus
  resultSummary?: string
  createdAt: string
  updatedAt: string
}

type RequirementRecord = {
  id: string
  title: string
  projectId: string
  serviceIds: string[]
  createdAt: string
  updatedAt: string
  lastAiDispatchAt?: string
  taskLinks: RequirementTaskLinkInternal[]
}

const requirementRecords: RequirementRecord[] = [
  {
    id: 'req-001',
    title: '搭建需求管理原型界面',
    projectId: 'proj-xuanwu',
    serviceIds: ['svc-portal-web', 'svc-ai-center-api'],
    createdAt: iso(daysAgo(10)),
    updatedAt: iso(daysAgo(1)),
    lastAiDispatchAt: iso(daysAgo(2)),
    taskLinks: [
      {
        id: 'req-001-task-01',
        aiTaskAssignmentId: 'ai-task-frontend-prototype',
        aiEmployeeId: 'ai-employee-frontend-01',
        taskTitle: '实现需求列表页布局',
        projectId: 'proj-xuanwu',
        serviceId: 'svc-portal-web',
        branchName: 'feature/requirements-ui',
        expectedOutputs: ['界面截图', '交互说明'],
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        resultSummary: '已完成基础架构，等待联调',
        createdAt: iso(daysAgo(4)),
        updatedAt: iso(daysAgo(1))
      },
      {
        id: 'req-001-task-02',
        aiTaskAssignmentId: 'ai-task-qa-check',
        aiEmployeeId: 'ai-employee-qa-01',
        taskTitle: '联调检验 AI 派发流程',
        projectId: 'proj-xuanwu',
        serviceId: 'svc-ai-center-api',
        expectedOutputs: ['验证报告'],
        priority: 'MEDIUM',
        status: 'PENDING',
        createdAt: iso(daysAgo(2)),
        updatedAt: iso(daysAgo(2))
      }
    ]
  },
  {
    id: 'req-002',
    title: '整理计费项目的需求池',
    projectId: 'proj-nova',
    serviceIds: ['svc-billing-console'],
    createdAt: iso(daysAgo(6)),
    updatedAt: iso(daysAgo(3)),
    taskLinks: []
  },
  {
    id: 'req-003',
    title: '为数据质量服务补充监控指标',
    projectId: 'proj-lake',
    serviceIds: ['svc-data-quality'],
    createdAt: iso(daysAgo(14)),
    updatedAt: iso(daysAgo(5)),
    taskLinks: [
      {
        id: 'req-003-task-01',
        aiTaskAssignmentId: 'ai-task-backend-metrics',
        aiEmployeeId: 'ai-employee-backend-01',
        taskTitle: '输出监控指标建议',
        projectId: 'proj-lake',
        serviceId: 'svc-data-quality',
        expectedOutputs: ['指标列表'],
        priority: 'MEDIUM',
        status: 'SUCCESS',
        resultSummary: '生成 5 条监控指标建议，并附带监控频率。',
        createdAt: iso(daysAgo(9)),
        updatedAt: iso(daysAgo(6))
      }
    ],
    lastAiDispatchAt: iso(daysAgo(6))
  }
]

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const buildTaskLinks = (record: RequirementRecord): RequirementAiTaskLink[] => {
  const projectName = projectMap.get(record.projectId)?.name ?? ''
  return record.taskLinks.map((link) => {
    const employee = aiEmployeeMap.get(link.aiEmployeeId) ?? aiEmployees[0]
    const serviceName = link.serviceId ? serviceMap.get(link.serviceId)?.name : undefined
    return {
      id: link.id,
      aiTaskAssignmentId: link.aiTaskAssignmentId,
      aiEmployee: clone(employee),
      taskTitle: link.taskTitle,
      projectId: link.projectId,
      projectName,
      serviceId: link.serviceId,
      serviceName,
      branchName: link.branchName,
      expectedOutputs: link.expectedOutputs,
      priority: link.priority,
      status: link.status,
      resultSummary: link.resultSummary,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt
    }
  })
}

const buildDetail = (record: RequirementRecord): RequirementDetail => {
  const project = clone(projectMap.get(record.projectId) ?? projects[0])
  const serviceRefs = record.serviceIds
    .map((id) => serviceMap.get(id))
    .filter((svc): svc is RequirementServiceRef => Boolean(svc))
    .map((svc) => clone(svc))

  const taskLinks = buildTaskLinks(record)

  return {
    id: record.id,
    title: record.title,
    project,
    services: serviceRefs,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    aiTaskCount: taskLinks.length,
    lastAiDispatchAt: record.lastAiDispatchAt,
    taskLinks
  }
}

const toListItem = (record: RequirementRecord): RequirementListItem => {
  const detail = buildDetail(record)
  return {
    id: detail.id,
    title: detail.title,
    project: detail.project,
    services: detail.services,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    aiTaskCount: detail.aiTaskCount,
    lastAiDispatchAt: detail.lastAiDispatchAt
  }
}

const collectFilters = (): RequirementFilterOptions => ({
  projects: clone(projects),
  services: clone(services)
})

const applySort = (records: RequirementRecord[], sortBy: RequirementListQuery['sortBy'], sortOrder: RequirementListQuery['sortOrder']) => {
  const order = sortOrder === 'asc' ? 1 : -1
  return [...records].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title) * order
    }
    return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * order
  })
}

const filterRecords = (records: RequirementRecord[], query: RequirementListQuery) => {
  return records.filter((record) => {
    if (query.projectId && record.projectId !== query.projectId) {
      return false
    }
    if (query.serviceId && !record.serviceIds.includes(query.serviceId)) {
      return false
    }
    if (query.search && query.search.trim() !== '') {
      const keyword = query.search.trim().toLowerCase()
      const projectName = projectMap.get(record.projectId)?.name.toLowerCase() ?? ''
      const serviceNames = record.serviceIds
        .map((id) => serviceMap.get(id)?.name.toLowerCase())
        .filter(Boolean)
        .join(' ')
      const title = record.title.toLowerCase()
      if (!title.includes(keyword) && !projectName.includes(keyword) && !serviceNames.includes(keyword)) {
        return false
      }
    }
    return true
  })
}

const ensureServiceIds = (projectId: string, serviceIds: string[]): string[] => {
  const allowedServiceIds = services.filter((service) => service.projectId === projectId).map((service) => service.id)
  const unique = Array.from(new Set(serviceIds))
  const filtered = unique.filter((id) => allowedServiceIds.includes(id))
  return filtered.length > 0 ? filtered : allowedServiceIds.slice(0, 1)
}

export const requirementsMockStore = {
  list(query: RequirementListQuery = {}): RequirementListResponse {
    const filtered = filterRecords(requirementRecords, query)
    const sorted = applySort(filtered, query.sortBy ?? 'updatedAt', query.sortOrder ?? 'desc')
    const items = sorted.map((record) => toListItem(record))

    return {
      items,
      total: items.length,
      filters: collectFilters()
    }
  },

  get(id: string): RequirementDetail | null {
    const record = requirementRecords.find((item) => item.id === id)
    if (!record) return null
    return buildDetail(record)
  },

  create(payload: RequirementCreatePayload): RequirementDetail {
    const project = projectMap.get(payload.projectId)
    if (!project) {
      throw new Error('无效的项目 ID')
    }

    const serviceIds = ensureServiceIds(payload.projectId, payload.serviceIds)

    const nowIso = iso(new Date())
    const newRecord: RequirementRecord = {
      id: randomUUID(),
      title: payload.title.trim(),
      projectId: payload.projectId,
      serviceIds,
      createdAt: nowIso,
      updatedAt: nowIso,
      taskLinks: []
    }

    requirementRecords.unshift(newRecord)
    return buildDetail(newRecord)
  },

  update(id: string, payload: RequirementUpdatePayload): RequirementDetail {
    const record = requirementRecords.find((item) => item.id === id)
    if (!record) {
      throw new Error('Requirement not found')
    }

    let modified = false
    if (typeof payload.title === 'string' && payload.title.trim() !== '' && payload.title.trim() !== record.title) {
      record.title = payload.title.trim()
      modified = true
    }

    if (typeof payload.projectId === 'string' && payload.projectId !== record.projectId) {
      record.projectId = payload.projectId
      record.serviceIds = ensureServiceIds(payload.projectId, payload.serviceIds ?? [])
      modified = true
    } else if (payload.serviceIds) {
      const serviceIds = ensureServiceIds(record.projectId, payload.serviceIds)
      if (JSON.stringify(serviceIds) !== JSON.stringify(record.serviceIds)) {
        record.serviceIds = serviceIds
        modified = true
      }
    }

    if (modified) {
      record.updatedAt = iso(new Date())
    }

    return buildDetail(record)
  },

  dispatch(id: string, payload: RequirementDispatchPayload): RequirementDispatchResult {
    const record = requirementRecords.find((item) => item.id === id)
    if (!record) {
      throw new Error('Requirement not found')
    }

    const projectId = payload.projectId ?? record.projectId
    const serviceIds = payload.serviceIds ? ensureServiceIds(projectId, payload.serviceIds) : record.serviceIds
    const nowIso = iso(new Date())

    const newlyCreatedTaskIds: string[] = []

    payload.aiEmployeeIds.forEach((employeeId) => {
      if (!aiEmployeeMap.has(employeeId)) {
        return
      }

      const taskId = randomUUID()
      const newTask: RequirementTaskLinkInternal = {
        id: taskId,
        aiTaskAssignmentId: `mock-${taskId}`,
        aiEmployeeId: employeeId,
        taskTitle: payload.taskTitle,
        projectId,
        serviceId: serviceIds[0],
        branchName: payload.branch,
        expectedOutputs: payload.expectedOutputs?.filter((item) => item.trim() !== ''),
        priority: payload.priority,
        status: 'PENDING',
        resultSummary: '等待 AI 员工开始执行任务',
        createdAt: nowIso,
        updatedAt: nowIso
      }

      record.taskLinks.push(newTask)
      newlyCreatedTaskIds.push(taskId)
    })

    if (newlyCreatedTaskIds.length === 0) {
      throw new Error('未找到可用的 AI 员工，派发失败')
    }

    record.lastAiDispatchAt = nowIso
    record.updatedAt = nowIso

    return {
      requirement: buildDetail(record),
      newlyCreatedTaskIds
    }
  },

  delete(id: string): boolean {
    const index = requirementRecords.findIndex((item) => item.id === id)
    if (index === -1) return false
    requirementRecords.splice(index, 1)
    return true
  },

  getFilters(): RequirementFilterOptions {
    return collectFilters()
  },

  getAiEmployees(): Array<{ id: string; name: string; type: AIEmployeeType }> {
    return clone(aiEmployees)
  }
}
