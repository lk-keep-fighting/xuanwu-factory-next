export type AIEmployeeType = 'ENGINEER' | 'QA'

export type AIEmployeeStatus = 'ACTIVE' | 'DISABLED'

export type AIRoleTemplateApplicability = 'ENGINEER' | 'QA' | 'ALL'

export type AITaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED'

export type AITaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AIModelParams {
  temperature: number
  maxTokens: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  [key: string]: number | string | undefined
}

export interface AIRoleTemplate {
  id: string
  name: string
  applicableType: AIRoleTemplateApplicability
  systemPrompt: string
  behaviorGuidelines: string[]
  toolPermissions: string[]
  defaultModelProvider: string
  defaultModelName: string
  defaultModelParams: AIModelParams
  createdBy: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface AIRoleTemplateListItem extends AIRoleTemplate {
  usageCount: number
}

export interface AIEmployee {
  id: string
  name: string
  type: AIEmployeeType
  roleTemplateId: string
  modelProvider: string
  modelName: string
  modelParams: AIModelParams
  capabilityTags: string[]
  description?: string
  status: AIEmployeeStatus
  totalTaskCount: number
  lastTaskAt?: string
  createdAt: string
  updatedAt: string
}

export interface AIEmployeeListItem extends AIEmployee {
  roleTemplate: Pick<AIRoleTemplate, 'id' | 'name' | 'applicableType'>
}

export interface AIEmployeeDetail extends AIEmployee {
  roleTemplate?: AIRoleTemplate
}

export interface AITaskAssignment {
  id: string
  aiEmployeeId: string
  projectId: string
  applicationId: string
  branchName: string
  taskTitle: string
  taskDescription: string
  expectedOutputs: string[]
  priority: AITaskPriority
  status: AITaskStatus
  mock: boolean
  mockPayload?: Record<string, unknown>
  resultSummary?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface AITaskAssignmentListItem extends AITaskAssignment {
  aiEmployeeName?: string
}
