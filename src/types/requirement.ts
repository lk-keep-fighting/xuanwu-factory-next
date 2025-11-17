import { type AIEmployeeType, type AITaskPriority, type AITaskStatus } from '@/types/ai'

export type RequirementStatus = 'DRAFT' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'

export type RequirementPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RequirementProjectRef {
  id: string
  name: string
  identifier?: string
}

export interface RequirementServiceRef {
  id: string
  projectId: string
  name: string
  description?: string
}

export interface RequirementPersonRef {
  id: string
  name: string
  title?: string
  email?: string
  avatarColor?: string
}

export interface RequirementBase {
  id: string
  code: string
  title: string
  summary: string
  priority: RequirementPriority
  status: RequirementStatus
  project: RequirementProjectRef
  services: RequirementServiceRef[]
  owner: RequirementPersonRef
  watchers: RequirementPersonRef[]
  tags: string[]
  dueAt?: string
  createdAt: string
  updatedAt: string
  lastAiDispatchAt?: string
  aiTaskCount: number
  progressPercentage: number
  isOverdue: boolean
  remainingDays?: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export type RequirementListItem = RequirementBase

export interface RequirementStatusHistoryEntry {
  id: string
  fromStatus: RequirementStatus | null
  toStatus: RequirementStatus
  changedBy: RequirementPersonRef
  note?: string
  createdAt: string
}

export interface RequirementAiTaskLink {
  id: string
  aiTaskAssignmentId: string
  aiEmployee: {
    id: string
    name: string
    type: AIEmployeeType
  }
  taskTitle: string
  projectId: string
  projectName: string
  serviceId?: string
  serviceName?: string
  branchName?: string
  expectedOutputs?: string[]
  priority: AITaskPriority
  status: AITaskStatus
  resultSummary?: string
  createdAt: string
  updatedAt: string
}

export interface RequirementDetail extends RequirementBase {
  description: string
  statusHistory: RequirementStatusHistoryEntry[]
  taskLinks: RequirementAiTaskLink[]
  lastUpdatedBy?: RequirementPersonRef
}

export interface RequirementListStats {
  total: number
  draft: number
  todo: number
  inProgress: number
  done: number
  canceled: number
  overdue: number
}

export interface RequirementFilterOptions {
  projects: RequirementProjectRef[]
  services: RequirementServiceRef[]
  owners: RequirementPersonRef[]
  watchers: RequirementPersonRef[]
  priorities: RequirementPriority[]
  statuses: RequirementStatus[]
  tags: string[]
}

export interface RequirementListResponse {
  items: RequirementListItem[]
  total: number
  stats: RequirementListStats
  filters: RequirementFilterOptions
}

export type RequirementListSortKey = 'updatedAt' | 'dueAt' | 'priority'

export type RequirementListQuery = {
  search?: string
  statuses?: RequirementStatus[]
  priorities?: RequirementPriority[]
  projectId?: string
  serviceId?: string
  ownerId?: string
  onlyOverdue?: boolean
  aiDispatch?: 'ANY' | 'DISPATCHED' | 'UNDISPATCHED'
  sortBy?: RequirementListSortKey
  sortOrder?: 'asc' | 'desc'
}

export interface RequirementCreatePayload {
  title: string
  description: string
  projectId: string
  serviceIds: string[]
  priority: RequirementPriority
  status: RequirementStatus
  ownerId: string
  watcherIds: string[]
  dueAt?: string
  tags?: string[]
}

export interface RequirementUpdatePayload {
  title?: string
  description?: string
  projectId?: string
  serviceIds?: string[]
  priority?: RequirementPriority
  status?: RequirementStatus
  ownerId?: string
  watcherIds?: string[]
  dueAt?: string | null
  tags?: string[]
  updatedBy?: string
}

export interface RequirementStatusChangePayload {
  toStatus: RequirementStatus
  note?: string
  changedBy: string
}

export interface RequirementDispatchPayload {
  aiEmployeeIds: string[]
  taskTitle: string
  taskDescription: string
  branch?: string
  expectedOutputs?: string[]
  priority: AITaskPriority
  projectId?: string
  serviceIds?: string[]
  requestedBy: string
}

export interface RequirementDispatchResult {
  requirement: RequirementDetail
  newlyCreatedTaskIds: string[]
}
