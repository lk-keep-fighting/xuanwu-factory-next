/**
 * 命令执行器实现
 * 
 * 职责：桥接 K8sService 的底层 execInPod 能力
 */

import { k8sService } from '@/lib/k8s'
import type { CommandExecutor, ExecResult, PodInfo } from './types'

/**
 * K8s Pod 命令执行器
 * 
 * 封装对 k8sService.execInPod 的调用
 * 未来可替换为其他实现（如 kubectl cp）
 */
export class K8sPodExecutor implements CommandExecutor {
  constructor(private readonly podInfo: PodInfo) {}

  async exec(command: string[], stdin?: Buffer): Promise<ExecResult> {
    const result = await k8sService.execInPod(
      this.podInfo.namespace,
      this.podInfo.podName,
      this.podInfo.containerName,
      command,
      stdin ? { stdin } : undefined
    )

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    }
  }
}
