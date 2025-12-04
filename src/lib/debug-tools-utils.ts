import type {
  MultiDebugConfig,
  DebugToolConfig,
  LegacyDebugConfig,
} from '@/types/project'

/**
 * Validates a Docker image address format
 * 
 * Accepts formats:
 * - image:tag
 * - registry.com/image:tag
 * - registry.com:port/namespace/image:tag
 * - image@sha256:digest
 * 
 * @param image - Docker image address to validate
 * @returns true if valid, false otherwise
 */
export function validateDockerImage(image: string): boolean {
  if (!image || typeof image !== 'string') {
    return false
  }

  // Docker image naming rules:
  // - Optional registry (domain with optional port)
  // - Optional namespace/path components
  // - Required image name
  // - Optional tag or digest
  
  // Regex breakdown:
  // ^(?:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::[0-9]+)?)\/)? - optional registry with port
  // ([a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*) - required image name with optional namespace
  // (?::([a-zA-Z0-9_][a-zA-Z0-9._-]{0,127})|@(sha256:[a-f0-9]{64}))?$ - optional tag or digest
  
  const imageRegex = /^(?:([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::[0-9]+)?)\/)?([a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*)(?::([a-zA-Z0-9_][a-zA-Z0-9._-]{0,127})|@(sha256:[a-f0-9]{64}))?$/

  return imageRegex.test(image)
}

/**
 * Validates a mount path format
 * 
 * Valid paths:
 * - Must start with /
 * - Can contain alphanumeric characters, -, _, /, .
 * - Cannot be just /
 * 
 * @param path - Mount path to validate
 * @returns true if valid, false otherwise
 */
export function validateMountPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false
  }

  // Must start with / but not be just /
  if (path === '/') {
    return false
  }

  // Must start with / and contain only valid characters
  const pathRegex = /^\/[a-zA-Z0-9._/-]+$/

  return pathRegex.test(path)
}

/**
 * Validates that all mount paths in a configuration are unique
 * 
 * @param tools - Array of debug tool configurations
 * @returns true if all paths are unique, false if duplicates exist
 */
export function validateUniquePaths(tools: DebugToolConfig[]): boolean {
  if (!Array.isArray(tools)) {
    return false
  }

  const paths = tools.map(tool => tool.mountPath)
  const uniquePaths = new Set(paths)

  return paths.length === uniquePaths.size
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates a complete debug configuration
 * 
 * Checks:
 * - All mount paths are valid
 * - All mount paths are unique
 * - Custom tools have valid image addresses
 * - Custom tools have image addresses specified
 * 
 * @param config - Debug configuration to validate
 * @returns Validation result with errors if any
 */
export function validateDebugConfig(config: MultiDebugConfig | null | undefined): ValidationResult {
  const errors: string[] = []

  if (!config) {
    return { valid: true, errors: [] }
  }

  if (!config.enabled) {
    return { valid: true, errors: [] }
  }

  if (!Array.isArray(config.tools) || config.tools.length === 0) {
    errors.push('至少需要选择一个调试工具')
    return { valid: false, errors }
  }

  // Validate each tool
  for (const tool of config.tools) {
    // Validate mount path
    if (!validateMountPath(tool.mountPath)) {
      errors.push(`路径 "${tool.mountPath}" 无效：路径必须以 / 开头且只能包含字母、数字、-、_、/、.`)
    }

    // Validate custom image
    if (tool.toolset === 'custom') {
      if (!tool.customImage) {
        errors.push('自定义镜像必须指定镜像地址')
      } else if (!validateDockerImage(tool.customImage)) {
        errors.push(`镜像地址 "${tool.customImage}" 格式无效`)
      }
    }
  }

  // Validate unique paths
  if (!validateUniquePaths(config.tools)) {
    errors.push('挂载路径不能重复')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Checks if a configuration is in legacy (single-tool) format
 * 
 * @param config - Configuration to check
 * @returns true if legacy format, false otherwise
 */
export function isLegacyConfig(config: unknown): config is LegacyDebugConfig {
  if (!config || typeof config !== 'object') {
    return false
  }

  const obj = config as Record<string, unknown>

  // Legacy config has: enabled, toolset, mountPath
  // Legacy config does NOT have: tools array
  return (
    typeof obj.enabled === 'boolean' &&
    typeof obj.toolset === 'string' &&
    typeof obj.mountPath === 'string' &&
    !Array.isArray(obj.tools)
  )
}

/**
 * Checks if a configuration is in multi-tool format
 * 
 * @param config - Configuration to check
 * @returns true if multi-tool format, false otherwise
 */
export function isMultiConfig(config: unknown): config is MultiDebugConfig {
  if (!config || typeof config !== 'object') {
    return false
  }

  const obj = config as Record<string, unknown>

  return (
    typeof obj.enabled === 'boolean' &&
    Array.isArray(obj.tools)
  )
}

/**
 * Converts a legacy debug configuration to multi-tool format
 * 
 * @param legacy - Legacy configuration to convert
 * @returns Multi-tool configuration
 */
export function convertLegacyToMultiConfig(legacy: LegacyDebugConfig): MultiDebugConfig {
  return {
    enabled: legacy.enabled,
    tools: legacy.enabled ? [{
      toolset: legacy.toolset,
      mountPath: legacy.mountPath,
      customImage: legacy.customImage
    }] : []
  }
}

/**
 * Normalizes a debug configuration to multi-tool format
 * 
 * Handles:
 * - null/undefined -> null
 * - Legacy format -> converted to multi-tool format
 * - Multi-tool format -> returned as-is
 * - Unknown format -> null with warning
 * 
 * @param config - Configuration to normalize
 * @returns Normalized multi-tool configuration or null
 */
export function normalizeDebugConfig(
  config: unknown
): MultiDebugConfig | null {
  if (!config) {
    return null
  }

  // Check if legacy format
  if (isLegacyConfig(config)) {
    return convertLegacyToMultiConfig(config)
  }

  // Check if multi-tool format
  if (isMultiConfig(config)) {
    return config
  }

  // Unknown format
  console.warn('Unknown debug_config format:', config)
  return null
}

// ============================================================================
// Kubernetes Configuration Generation
// ============================================================================

/**
 * Kubernetes Init Container interface
 */
export interface K8sInitContainer {
  name: string
  image: string
  imagePullPolicy?: string
  command: string[]
  args?: string[]
  volumeMounts: Array<{
    name: string
    mountPath: string
  }>
}

/**
 * Kubernetes Volume interface
 */
export interface K8sVolume {
  name: string
  emptyDir: Record<string, never>
}

/**
 * Default Docker images for each toolset
 */
const TOOLSET_IMAGES: Record<string, string> = {
  busybox: 'busybox:latest',
  netshoot: 'nicolaka/netshoot:latest',
  ubuntu: 'ubuntu:22.04'
}

/**
 * Generates install script for a specific toolset
 * 
 * @param toolset - The toolset type
 * @param mountPath - The mount path for the tools
 * @returns Shell script to install the tools
 */
function generateInstallScript(toolset: string, mountPath: string): string {
  switch (toolset) {
    case 'busybox':
      return `
echo "Installing BusyBox debug tools..."
cp /bin/busybox ${mountPath}/
${mountPath}/busybox --install -s ${mountPath}/
echo "BusyBox tools installed successfully at ${mountPath}"
ls -la ${mountPath}/ | head -20
      `.trim()

    case 'netshoot':
      return `
echo "Installing Netshoot debug tools..."
mkdir -p ${mountPath}/bin
# 复制常用网络工具
for tool in curl wget nc nslookup dig tcpdump netstat ss iperf3 mtr traceroute nmap; do
  if command -v $tool >/dev/null 2>&1; then
    cp $(command -v $tool) ${mountPath}/bin/ 2>/dev/null || true
  fi
done
echo "Netshoot tools installed successfully at ${mountPath}/bin"
ls -la ${mountPath}/bin/
      `.trim()

    case 'ubuntu':
      return `
echo "Installing Ubuntu debug tools..."
mkdir -p ${mountPath}/bin
# 复制常用系统工具
for tool in bash sh ls cat grep sed awk ps top curl wget; do
  if command -v $tool >/dev/null 2>&1; then
    cp $(command -v $tool) ${mountPath}/bin/ 2>/dev/null || true
  fi
done
echo "Ubuntu tools installed successfully at ${mountPath}/bin"
ls -la ${mountPath}/bin/
      `.trim()

    case 'custom':
      return `
echo "Installing custom debug tools..."
# 用户需要在自定义镜像中实现复制逻辑
if [ -f /copy-tools.sh ]; then
  /copy-tools.sh ${mountPath}
else
  echo "Warning: /copy-tools.sh not found in custom image"
  echo "Please ensure your custom image includes a /copy-tools.sh script"
fi
echo "Custom tools installation completed at ${mountPath}"
ls -la ${mountPath}/
      `.trim()

    default:
      return `echo "Unknown toolset: ${toolset}"`
  }
}

/**
 * Generates Kubernetes Init Container configurations for debug tools
 * 
 * Creates one Init Container per tool in the configuration.
 * Init Containers are ordered alphabetically by toolset name for stability.
 * 
 * @param config - Multi-tool debug configuration
 * @returns Array of Init Container configurations
 */
export function generateDebugInitContainers(
  config: MultiDebugConfig | null | undefined
): K8sInitContainer[] {
  if (!config || !config.enabled || !config.tools || config.tools.length === 0) {
    return []
  }

  // Sort tools by toolset name for stable ordering
  const sortedTools = [...config.tools].sort((a, b) => 
    a.toolset.localeCompare(b.toolset)
  )

  return sortedTools.map((tool) => {
    // Determine the image to use
    const image = tool.toolset === 'custom' && tool.customImage
      ? tool.customImage
      : TOOLSET_IMAGES[tool.toolset] || TOOLSET_IMAGES.busybox

    // Generate the install script
    const installScript = generateInstallScript(tool.toolset, tool.mountPath)

    // Create the Init Container
    return {
      name: `debug-tools-${tool.toolset}`,
      image,
      imagePullPolicy: 'IfNotPresent',
      command: ['sh', '-c'],
      args: [installScript],
      volumeMounts: [
        {
          name: `debug-tools-${tool.toolset}`,
          mountPath: tool.mountPath
        }
      ]
    }
  })
}

/**
 * Generates Kubernetes Volume configurations for debug tools
 * 
 * Creates one emptyDir volume per tool in the configuration.
 * Volumes are ordered alphabetically by toolset name for stability.
 * 
 * @param config - Multi-tool debug configuration
 * @returns Array of Volume configurations
 */
export function generateDebugVolumes(
  config: MultiDebugConfig | null | undefined
): K8sVolume[] {
  if (!config || !config.enabled || !config.tools || config.tools.length === 0) {
    return []
  }

  // Sort tools by toolset name for stable ordering
  const sortedTools = [...config.tools].sort((a, b) => 
    a.toolset.localeCompare(b.toolset)
  )

  return sortedTools.map((tool) => ({
    name: `debug-tools-${tool.toolset}`,
    emptyDir: {}
  }))
}

/**
 * Generates usage instructions for enabled debug tools
 * 
 * Provides information about:
 * - Where each tool is installed
 * - How to add tools to PATH
 * - Example commands
 * 
 * @param config - Multi-tool debug configuration
 * @returns Formatted usage instructions text
 */
export function generateUsageInstructions(
  config: MultiDebugConfig | null | undefined
): string {
  if (!config || !config.enabled || !config.tools || config.tools.length === 0) {
    return ''
  }

  const lines: string[] = []
  
  lines.push('## 调试工具使用说明\n')
  lines.push('已启用的调试工具：\n')

  // List each tool and its location
  config.tools.forEach((tool) => {
    const toolName = tool.toolset === 'custom' 
      ? `自定义工具 (${tool.customImage})`
      : tool.toolset.toUpperCase()
    lines.push(`- **${toolName}**: ${tool.mountPath}`)
  })

  lines.push('\n### 使用方法\n')
  lines.push('进入容器后，可以通过以下方式使用调试工具：\n')

  // Single tool - simpler instructions
  if (config.tools.length === 1) {
    const tool = config.tools[0]
    lines.push('**方法 1**: 直接使用完整路径')
    lines.push('```bash')
    lines.push(`${tool.mountPath}/ls -la`)
    lines.push('```\n')
    
    lines.push('**方法 2**: 添加到 PATH 环境变量')
    lines.push('```bash')
    lines.push(`export PATH=${tool.mountPath}:$PATH`)
    lines.push('ls -la  # 现在可以直接使用命令')
    lines.push('```')
  } else {
    // Multiple tools - show how to add all to PATH
    lines.push('**方法 1**: 直接使用完整路径')
    lines.push('```bash')
    lines.push(`${config.tools[0].mountPath}/ls -la`)
    lines.push('```\n')
    
    lines.push('**方法 2**: 添加所有工具到 PATH 环境变量')
    lines.push('```bash')
    const pathParts = config.tools.map(t => t.mountPath).join(':')
    lines.push(`export PATH=${pathParts}:$PATH`)
    lines.push('```\n')
    
    lines.push('**方法 3**: 单独添加某个工具到 PATH')
    lines.push('```bash')
    lines.push(`# 例如只添加 ${config.tools[0].toolset}`)
    lines.push(`export PATH=${config.tools[0].mountPath}:$PATH`)
    lines.push('```')
  }

  return lines.join('\n')
}
