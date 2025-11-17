import { randomUUID } from 'crypto'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { aiMockStore } from '@/service/aiMockStore'
import {
  type RequirementAiTaskLink,
  type RequirementCreatePayload,
  type RequirementDetail,
  type RequirementDispatchPayload,
  type RequirementDispatchResult,
  type RequirementListItem,
  type RequirementListQuery,
  type RequirementListResponse,
  type RequirementUpdatePayload
} from '@/types/requirement'
import { type AIEmployeeListItem } from '@/types/ai'

const mapRequirementListItem = (
  record: Prisma.RequirementGetPayload<{
    include: {
      project: true
      services: {
        include: { service: true }
      }
      _count: {
        select: { taskLinks: true }
      }
    }
  }>
): RequirementListItem => ({
  id: record.id,
  title: record.title,
  project: {
    id: record.project.id,
    name: record.project.name,
    identifier: record.project.identifier ?? undefined
  },
  services: record.services.map((link) => ({
    id: link.service.id,
    projectId: link.service.project_id,
    name: link.service.name,
    description: undefined
  })),
  createdAt: record.created_at.toISOString(),
  updatedAt: record.updated_at.toISOString(),
  aiTaskCount: record._count.taskLinks,
  lastAiDispatchAt: record.last_ai_dispatch_at ? record.last_ai_dispatch_at.toISOString() : undefined
})

const mapRequirementDetail = (
  record: Prisma.RequirementGetPayload<{
    include: {
      project: true
      services: {
        include: { service: true }
      }
      taskLinks: {
        include: { service: true }
        orderBy: { created_at: 'desc' }
      }
    }
  }>
): RequirementDetail => ({
  id: record.id,
  title: record.title,
  project: {
    id: record.project.id,
    name: record.project.name,
    identifier: record.project.identifier ?? undefined
  },
  services: record.services.map((link) => ({
    id: link.service.id,
    projectId: link.service.project_id,
    name: link.service.name,
    description: undefined
  })),
  createdAt: record.created_at.toISOString(),
  updatedAt: record.updated_at.toISOString(),
  aiTaskCount: record.taskLinks.length,
  lastAiDispatchAt: record.last_ai_dispatch_at ? record.last_ai_dispatch_at.toISOString() : undefined,
  taskLinks: record.taskLinks.map((task) => mapTaskLink(task, record.project.name))
})

const mapTaskLink = (
  task: Prisma.RequirementTaskLinkGetPayload<{ include: { service: true } }>,
  projectName: string
): RequirementAiTaskLink => ({
  id: task.id,
  aiTaskAssignmentId: task.ai_task_assignment_id,
  aiEmployee: {
    id: task.ai_employee_id,
    name: task.ai_employee_name,
    type: task.ai_employee_type as RequirementAiTaskLink['aiEmployee']['type']
  },
  taskTitle: task.task_title,
  projectId: task.project_id,
  projectName,
  serviceId: task.service_id ?? undefined,
  serviceName: task.service?.name ?? undefined,
  branchName: task.branch_name ?? undefined,
  expectedOutputs: Array.isArray(task.expected_outputs) ? (task.expected_outputs as string[]) : undefined,
  priority: task.priority as RequirementAiTaskLink['priority'],
  status: task.status as RequirementAiTaskLink['status'],
  resultSummary: task.result_summary ?? undefined,
  createdAt: task.created_at.toISOString(),
  updatedAt: task.updated_at.toISOString()
})

const buildListWhere = (query: RequirementListQuery): Prisma.RequirementWhereInput => {
  const where: Prisma.RequirementWhereInput = {}

  if (query.search) {
    const keyword = query.search.trim()
    if (keyword !== '') {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { project: { name: { contains: keyword, mode: 'insensitive' } } },
        { project: { identifier: { contains: keyword, mode: 'insensitive' } } }
      ]
    }
  }

  if (query.projectId) {
    where.project_id = query.projectId
  }

  if (query.serviceId) {
    where.services = { some: { service_id: query.serviceId } }
  }

  return where
}

const buildListOrder = (sortBy: RequirementListQuery['sortBy'], sortOrder: RequirementListQuery['sortOrder']) => {
  const order = sortOrder === 'asc' ? 'asc' : 'desc'
  if (sortBy === 'title') {
    return { title: order } as const
  }
  return { updated_at: order } as const
}

const ensureProjectExists = async (tx: Prisma.TransactionClient, projectId: string) => {
  const project = await tx.project.findUnique({ where: { id: projectId } })
  if (!project) {
    throw new Error('指定的项目不存在')
  }
  return project
}

const resolveServiceIds = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  serviceIds: string[]
): Promise<string[]> => {
  if (!projectId) return []
  const availableServices = await tx.service.findMany({
    where: { project_id: projectId },
    select: { id: true },
    orderBy: { created_at: 'asc' }
  })

  if (availableServices.length === 0) {
    return []
  }

  if (!serviceIds || serviceIds.length === 0) {
    return [availableServices[0].id]
  }

  const allowed = new Set(availableServices.map((svc) => svc.id))
  const unique = Array.from(new Set(serviceIds))
  const filtered = unique.filter((id) => allowed.has(id))

  if (filtered.length === 0) {
    return [availableServices[0].id]
  }

  return filtered
}

const syncServiceLinks = async (
  tx: Prisma.TransactionClient,
  requirementId: string,
  serviceIds: string[]
) => {
  const existingLinks = await tx.requirementServiceLink.findMany({
    where: { requirement_id: requirementId },
    select: { id: true, service_id: true }
  })

  const toRemove = existingLinks.filter((link) => !serviceIds.includes(link.service_id))
  const existingServiceIds = new Set(existingLinks.map((link) => link.service_id))
  const toAdd = serviceIds.filter((serviceId) => !existingServiceIds.has(serviceId))

  if (toRemove.length > 0) {
    await tx.requirementServiceLink.deleteMany({
      where: { id: { in: toRemove.map((link) => link.id) } }
    })
  }

  if (toAdd.length > 0) {
    await tx.requirementServiceLink.createMany({
      data: toAdd.map((serviceId) => ({
        id: randomUUID(),
        requirement_id: requirementId,
        service_id: serviceId
      }))
    })
  }
}

const fetchRequirementDetail = async (id: string): Promise<RequirementDetail | null> => {
  const record = await prisma.requirement.findUnique({
    where: { id },
    include: {
      project: true,
      services: { include: { service: true } },
      taskLinks: {
        include: { service: true },
        orderBy: { created_at: 'desc' }
      }
    }
  })

  if (!record) return null
  return mapRequirementDetail(record)
}

const getAiEmployee = (id: string): AIEmployeeListItem | null => {
  const list = aiMockStore.listEmployees()
  const candidate = list.items.find((item) => item.id === id)
  if (candidate) return candidate
  const detail = aiMockStore.getEmployee(id)
  if (!detail) return null
  return {
    ...detail,
    roleTemplate: detail.roleTemplate
      ? {
          id: detail.roleTemplate.id,
          name: detail.roleTemplate.name,
          applicableType: detail.roleTemplate.applicableType
        }
      : undefined
  }
}

export const requirementService = {
  async list(query: RequirementListQuery = {}): Promise<RequirementListResponse> {
    const where = buildListWhere(query)
    const orderBy = buildListOrder(query.sortBy, query.sortOrder)

    const [records, total] = await Promise.all([
      prisma.requirement.findMany({
        where,
        orderBy,
        include: {
          project: true,
          services: { include: { service: true } },
          _count: { select: { taskLinks: true } }
        }
      }),
      prisma.requirement.count({ where })
    ])

    return {
      items: records.map(mapRequirementListItem),
      total
    }
  },

  async get(id: string): Promise<RequirementDetail | null> {
    return fetchRequirementDetail(id)
  },

  async create(payload: RequirementCreatePayload): Promise<RequirementDetail> {
    return prisma.$transaction(async (tx) => {
      await ensureProjectExists(tx, payload.projectId)
      const serviceIds = await resolveServiceIds(tx, payload.projectId, payload.serviceIds ?? [])

      const requirement = await tx.requirement.create({
        data: {
          title: payload.title.trim(),
          project_id: payload.projectId
        }
      })

      if (serviceIds.length > 0) {
        await tx.requirementServiceLink.createMany({
          data: serviceIds.map((serviceId) => ({
            id: randomUUID(),
            requirement_id: requirement.id,
            service_id: serviceId
          }))
        })
      }

      const detail = await fetchRequirementDetail(requirement.id)
      if (!detail) {
        throw new Error('创建需求失败')
      }
      return detail
    })
  },

  async update(id: string, payload: RequirementUpdatePayload): Promise<RequirementDetail | null> {
    return prisma.$transaction(async (tx) => {
      const requirement = await tx.requirement.findUnique({ where: { id } })
      if (!requirement) return null

      const data: Prisma.RequirementUpdateInput = {}

      if (typeof payload.title === 'string' && payload.title.trim() !== '') {
        data.title = payload.title.trim()
      }

      let projectId = requirement.project_id
      if (typeof payload.projectId === 'string' && payload.projectId !== requirement.project_id) {
        await ensureProjectExists(tx, payload.projectId)
        data.project = { connect: { id: payload.projectId } }
        projectId = payload.projectId
      }

      if (Object.keys(data).length > 0) {
        await tx.requirement.update({ where: { id }, data })
      }

      if (payload.serviceIds) {
        const resolved = await resolveServiceIds(tx, projectId, payload.serviceIds)
        await syncServiceLinks(tx, id, resolved)
      } else if (payload.projectId && !payload.serviceIds) {
        // Project changed but services not provided -> ensure at least one service from new project
        const resolved = await resolveServiceIds(tx, projectId, [])
        await syncServiceLinks(tx, id, resolved)
      }

      return fetchRequirementDetail(id)
    })
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.requirement.delete({ where: { id } })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false
      }
      throw error
    }
  },

  async dispatch(id: string, payload: RequirementDispatchPayload): Promise<RequirementDispatchResult> {
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        services: { select: { service_id: true } },
        project: { select: { id: true } }
      }
    })

    if (!requirement) {
      throw new Error('未找到对应的需求')
    }

    if (payload.projectId && payload.projectId !== requirement.project_id) {
      const projectExists = await prisma.project.findUnique({ where: { id: payload.projectId } })
      if (!projectExists) {
        throw new Error('指定的项目不存在')
      }
    }

    const projectId = payload.projectId ?? requirement.project_id

    const availableServices = await prisma.service.findMany({
      where: { project_id: projectId },
      select: { id: true },
      orderBy: { created_at: 'asc' }
    })

    const candidateServiceIds = payload.serviceIds && payload.serviceIds.length > 0
      ? Array.from(new Set(payload.serviceIds))
      : requirement.services.map((link) => link.service_id)

    let firstServiceId: string | null = null
    if (candidateServiceIds.length > 0 && availableServices.length > 0) {
      const valid = candidateServiceIds.find((serviceId) => availableServices.some((svc) => svc.id === serviceId))
      firstServiceId = valid ?? availableServices[0].id
    } else if (availableServices.length > 0) {
      firstServiceId = availableServices[0].id
    }

    const now = new Date()

    const employees = payload.aiEmployeeIds.map((employeeId) => {
      const employee = getAiEmployee(employeeId)
      if (!employee) {
        throw new Error(`未找到指定的 AI 员工：${employeeId}`)
      }
      return employee
    })

    const createdTaskIds: string[] = []

    await prisma.$transaction(async (tx) => {
      for (const employee of employees) {
        const taskId = randomUUID()
        await tx.requirementTaskLink.create({
          data: {
            id: taskId,
            requirement_id: id,
            ai_employee_id: employee.id,
            ai_employee_name: employee.name,
            ai_employee_type: employee.type,
            ai_task_assignment_id: `mock-${randomUUID()}`,
            task_title: payload.taskTitle,
            project_id: projectId,
            service_id: firstServiceId,
            branch_name: payload.branch ?? null,
            expected_outputs:
              payload.expectedOutputs && payload.expectedOutputs.length > 0
                ? payload.expectedOutputs.filter((item) => item.trim() !== '')
                : null,
            priority: payload.priority,
            status: 'PENDING',
            result_summary: '等待 AI 员工开始执行任务'
          }
        })
        createdTaskIds.push(taskId)
      }

      await tx.requirement.update({
        where: { id },
        data: {
          last_ai_dispatch_at: now
        }
      })
    })

    const detail = await fetchRequirementDetail(id)
    if (!detail) {
      throw new Error('派发后无法加载需求信息')
    }

    return {
      requirement: detail,
      newlyCreatedTaskIds: createdTaskIds
    }
  },

  listAiEmployees(): AIEmployeeListItem[] {
    return aiMockStore.listEmployees().items
  }
}
