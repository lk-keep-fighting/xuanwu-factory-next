/**
 * 文件管理服务
 * 
 * 业务层入口，负责：
 * 1. 解析 Service ID 到 Pod 信息
 * 2. 创建文件系统实例
 * 3. 提供统一的错误处理
 */

import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'
import { K8sPodExecutor } from '@/lib/filesystem/executor'
import { PodFileSystem } from '@/lib/filesystem/pod-filesystem'
import { FileSystemError, FileSystemErrorCode, type FileListResult, type PodInfo } from '@/lib/filesystem/types'

/**
 * 为指定服务创建文件系统实例
 */
export async function createFileSystemForService(serviceId: string): Promise<PodFileSystem> {
  // 1. 查询服务信息
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      name: true,
      project: {
        select: { identifier: true }
      }
    }
  })

  if (!service) {
    throw new FileSystemError('服务不存在', FileSystemErrorCode.NOT_FOUND, 404)
  }

  const serviceName = service.name?.trim()
  if (!serviceName) {
    throw new FileSystemError('服务名称缺失', FileSystemErrorCode.INVALID_NAME, 400)
  }

  const namespace = service.project?.identifier?.trim()
  if (!namespace) {
    throw new FileSystemError('项目缺少编号', FileSystemErrorCode.INVALID_NAME, 400)
  }

  // 2. 获取 Pod 信息
  const podInfo = await getPodInfo(serviceName, namespace)

  // 3. 构建文件系统
  const executor = new K8sPodExecutor(podInfo)
  return new PodFileSystem(executor)
}

/**
 * 获取服务的主 Pod 信息
 */
async function getPodInfo(serviceName: string, namespace: string): Promise<PodInfo> {
  await k8sService.ensureNamespaceAccess(namespace)

  const pods = await k8sService.coreApi.listNamespacedPod({
    namespace,
    labelSelector: `app=${serviceName}`
  })

  if (!pods.items.length) {
    throw new FileSystemError(
      '未找到运行中的 Pod，请先部署或启动服务',
      FileSystemErrorCode.POD_NOT_READY,
      409
    )
  }

  const selectedPod = selectPreferredPod(pods.items)
  if (!selectedPod) {
    throw new FileSystemError('未找到可用的 Pod 实例', FileSystemErrorCode.POD_NOT_READY, 409)
  }

  const podName = selectedPod.metadata?.name?.trim()
  if (!podName) {
    throw new FileSystemError('无法确定目标 Pod 名称', FileSystemErrorCode.POD_NOT_READY, 500)
  }

  const containerName = resolveContainerName(selectedPod, serviceName)

  return {
    namespace,
    podName,
    containerName
  }
}

/**
 * 选择最佳 Pod
 * 
 * 优先级：
 * 1. Ready 状态
 * 2. Running 阶段
 * 3. 重启次数最少
 * 4. 启动时间最新
 */
function selectPreferredPod(pods: any[]): any | null {
  if (!pods.length) {
    return null
  }

  const scored = pods
    .map((pod) => {
      const phase = (pod.status?.phase ?? '').toLowerCase()
      const statuses = pod.status?.containerStatuses ?? []
      const ready = statuses.length ? statuses.every((s: any) => s.ready) : phase === 'running'
      const restartCount = statuses.reduce((sum: number, s: any) => sum + (s.restartCount ?? 0), 0)
      const startTime = pod.status?.startTime ? new Date(pod.status.startTime).getTime() : 0

      return { pod, ready, phase, restartCount, startTime }
    })
    .sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1
      if (a.phase !== b.phase) {
        if (a.phase === 'running') return -1
        if (b.phase === 'running') return 1
      }
      if (a.restartCount !== b.restartCount) return a.restartCount - b.restartCount
      return b.startTime - a.startTime
    })

  return scored[0]?.pod ?? null
}

/**
 * 解析容器名称
 */
function resolveContainerName(pod: any, fallback: string): string {
  const containers = pod.spec?.containers ?? []
  if (!containers.length) {
    return fallback
  }

  const matched = containers.find((c: any) => c.name === fallback)
  return matched?.name ?? containers[0].name ?? fallback
}

/**
 * 便捷方法：列出文件
 */
export async function listFiles(serviceId: string, path: string): Promise<FileListResult> {
  const fs = await createFileSystemForService(serviceId)
  return fs.list(path)
}

/**
 * 便捷方法：读取文件
 */
export async function readFile(serviceId: string, path: string): Promise<Buffer> {
  const fs = await createFileSystemForService(serviceId)
  return fs.read(path)
}

/**
 * 便捷方法：写入文件
 */
export async function writeFile(
  serviceId: string,
  dirPath: string,
  fileName: string,
  content: Buffer
): Promise<{ path: string }> {
  const fs = await createFileSystemForService(serviceId)
  return fs.write(dirPath, fileName, content)
}

/**
 * 便捷方法：使用 kubectl cp 写入文件（推荐）
 */
export async function writeFileViaKubectl(
  serviceId: string,
  dirPath: string,
  fileName: string,
  content: Buffer
): Promise<{ path: string }> {
  const { uploadFileViaKubectl } = await import('@/lib/filesystem/kubectl-filesystem')
  
  // 1. 查询服务信息
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      name: true,
      project: {
        select: { identifier: true }
      }
    }
  })

  if (!service) {
    throw new FileSystemError('服务不存在', FileSystemErrorCode.NOT_FOUND, 404)
  }

  const serviceName = service.name?.trim()
  if (!serviceName) {
    throw new FileSystemError('服务名称缺失', FileSystemErrorCode.INVALID_NAME, 400)
  }

  const namespace = service.project?.identifier?.trim()
  if (!namespace) {
    throw new FileSystemError('项目缺少编号', FileSystemErrorCode.INVALID_NAME, 400)
  }

  // 2. 获取 Pod 信息
  const podInfo = await getPodInfo(serviceName, namespace)

  // 3. 使用 kubectl cp 上传
  return uploadFileViaKubectl(
    {
      namespace: podInfo.namespace,
      podName: podInfo.podName,
      containerName: podInfo.containerName
    },
    dirPath,
    fileName,
    content
  )
}
