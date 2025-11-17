import { type AIEmployeeType, type AITaskPriority, type AITaskStatus } from '@/types/ai'

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

export interface RequirementBase {
  id: string
  title: string
  project: RequirementProjectRef
  services: RequirementServiceRef[]
  createdAt: string
  updatedAt: string
  aiTaskCount: number
  lastAiDispatchAt?: string
}

export type RequirementListItem = RequirementBase

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
  taskLinks: RequirementAiTaskLink[]
}

export interface RequirementFilterOptions {
  projects: RequirementProjectRef[]
  services: RequirementServiceRef[]
}

export interface RequirementListResponse {
  items: RequirementListItem[]
  total: number
  filters: RequirementFilterOptions
}

export type RequirementListQuery = {
  search?: string
  projectId?: string
  serviceId?: string
  sortBy?: 'updatedAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface RequirementCreatePayload {
  title: string
  projectId: string
  serviceIds: string[]
}

export interface RequirementUpdatePayload {
  title?: string
  projectId?: string
  serviceIds?: string[]
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
