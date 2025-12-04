import type { DebugToolDefinition, DebugToolPreset } from '@/types/project'

/**
 * Tool definitions for all available debug tools
 */
export const TOOL_DEFINITIONS: DebugToolDefinition[] = [
  {
    toolset: 'busybox',
    label: 'BusyBox',
    description: '轻量级工具集，包含基础 Unix 命令',
    image: 'busybox:latest',
    size: '~5MB',
    tools: 'ls, ps, netstat, wget, nc, vi, top 等',
    defaultMountPath: '/debug-tools/busybox'
  },
  {
    toolset: 'netshoot',
    label: 'Netshoot',
    description: '网络调试专用，包含完整网络工具',
    image: 'nicolaka/netshoot:latest',
    size: '~300MB',
    tools: 'tcpdump, nmap, curl, dig, iperf3, mtr, traceroute 等',
    defaultMountPath: '/debug-tools/netshoot'
  },
  {
    toolset: 'ubuntu',
    label: 'Ubuntu',
    description: '完整 Linux 环境，可使用 apt-get 安装任何工具',
    image: 'ubuntu:22.04',
    size: '~80MB',
    tools: 'bash, curl, wget, ps, apt-get 等',
    defaultMountPath: '/debug-tools/ubuntu'
  },
  {
    toolset: 'custom',
    label: '自定义镜像',
    description: '使用自定义的调试工具镜像',
    image: null,
    size: '取决于镜像',
    tools: '取决于您的镜像',
    defaultMountPath: '/debug-tools/custom'
  }
]

/**
 * Quick preset configurations for common tool combinations
 */
export const QUICK_PRESETS: DebugToolPreset[] = [
  {
    id: 'basic',
    label: '基础调试',
    description: '仅 BusyBox，轻量级',
    toolsets: ['busybox']
  },
  {
    id: 'network',
    label: '网络诊断',
    description: 'BusyBox + Netshoot',
    toolsets: ['busybox', 'netshoot']
  },
  {
    id: 'full',
    label: '完整工具',
    description: 'BusyBox + Netshoot + Ubuntu',
    toolsets: ['busybox', 'netshoot', 'ubuntu']
  }
]
