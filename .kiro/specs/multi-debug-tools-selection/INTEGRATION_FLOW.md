# Multi-Debug-Tools Kubernetes Integration Flow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                  (DebugToolsSection Component)                  │
│                                                                 │
│  ☑ BusyBox    ☑ Netshoot    ☑ Ubuntu    ☐ Custom              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Save to Database
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Service.debug_config                       │
│                                                                 │
│  {                                                              │
│    "enabled": true,                                             │
│    "tools": [                                                   │
│      { "toolset": "busybox", "mountPath": "/debug-tools/..." },│
│      { "toolset": "netshoot", "mountPath": "/debug-tools/..." }│
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Deploy Service (k8s.ts)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   normalizeDebugConfig()                        │
│                                                                 │
│  • Detects config format (legacy vs multi)                     │
│  • Converts legacy → multi if needed                           │
│  • Returns MultiDebugConfig or null                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ generateDebugInitContainers()│  │  generateDebugVolumes()      │
│                              │  │                              │
│ Returns: K8sInitContainer[]  │  │ Returns: K8sVolume[]         │
│                              │  │                              │
│ [                            │  │ [                            │
│   {                          │  │   {                          │
│     name: "debug-tools-      │  │     name: "debug-tools-      │
│            busybox",         │  │            busybox",         │
│     image: "busybox:latest", │  │     emptyDir: {}             │
│     volumeMounts: [...]      │  │   },                         │
│   },                         │  │   {                          │
│   {                          │  │     name: "debug-tools-      │
│     name: "debug-tools-      │  │            netshoot",        │
│            netshoot",        │  │     emptyDir: {}             │
│     image: "nicolaka/...",   │  │   }                          │
│     volumeMounts: [...]      │  │ ]                            │
│   }                          │  │                              │
│ ]                            │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘
                    ↓                   ↓
                    └─────────┬─────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              Kubernetes Deployment/StatefulSet                  │
│                                                                 │
│  spec:                                                          │
│    template:                                                    │
│      spec:                                                      │
│        initContainers:                                          │
│          - name: debug-tools-busybox                            │
│            image: busybox:latest                                │
│            volumeMounts:                                        │
│              - name: debug-tools-busybox                        │
│                mountPath: /debug-tools/busybox                  │
│          - name: debug-tools-netshoot                           │
│            image: nicolaka/netshoot:latest                      │
│            volumeMounts:                                        │
│              - name: debug-tools-netshoot                       │
│                mountPath: /debug-tools/netshoot                 │
│        containers:                                              │
│          - name: main-app                                       │
│            volumeMounts:                                        │
│              - name: debug-tools-busybox                        │
│                mountPath: /debug-tools/busybox                  │
│              - name: debug-tools-netshoot                       │
│                mountPath: /debug-tools/netshoot                 │
│        volumes:                                                 │
│          - name: debug-tools-busybox                            │
│            emptyDir: {}                                         │
│          - name: debug-tools-netshoot                           │
│            emptyDir: {}                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Apply to Kubernetes
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Pod Execution Flow                           │
│                                                                 │
│  1. Init Container: debug-tools-busybox                         │
│     ├─ Create volume: debug-tools-busybox (emptyDir)           │
│     ├─ Copy BusyBox tools to /debug-tools/busybox              │
│     └─ Complete ✓                                               │
│                                                                 │
│  2. Init Container: debug-tools-netshoot                        │
│     ├─ Create volume: debug-tools-netshoot (emptyDir)          │
│     ├─ Copy Netshoot tools to /debug-tools/netshoot            │
│     └─ Complete ✓                                               │
│                                                                 │
│  3. Main Container: main-app                                    │
│     ├─ Mount: debug-tools-busybox → /debug-tools/busybox       │
│     ├─ Mount: debug-tools-netshoot → /debug-tools/netshoot     │
│     └─ Start application ✓                                      │
│                                                                 │
│  User can now access:                                           │
│    • /debug-tools/busybox/ls                                    │
│    • /debug-tools/netshoot/curl                                 │
│    • etc.                                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Example

### Input: Multi-Tool Configuration

```json
{
  "enabled": true,
  "tools": [
    {
      "toolset": "busybox",
      "mountPath": "/debug-tools/busybox"
    },
    {
      "toolset": "netshoot",
      "mountPath": "/debug-tools/netshoot"
    }
  ]
}
```

### Output: Kubernetes Resources

#### Init Containers
```yaml
initContainers:
  - name: debug-tools-busybox
    image: busybox:latest
    imagePullPolicy: IfNotPresent
    command: ['sh', '-c']
    args:
      - |
        echo "Installing BusyBox debug tools..."
        cp /bin/busybox /debug-tools/busybox/
        /debug-tools/busybox/busybox --install -s /debug-tools/busybox/
        echo "BusyBox tools installed successfully"
    volumeMounts:
      - name: debug-tools-busybox
        mountPath: /debug-tools/busybox

  - name: debug-tools-netshoot
    image: nicolaka/netshoot:latest
    imagePullPolicy: IfNotPresent
    command: ['sh', '-c']
    args:
      - |
        echo "Installing Netshoot debug tools..."
        mkdir -p /debug-tools/netshoot/bin
        for tool in curl wget nc nslookup dig tcpdump netstat ss; do
          if command -v $tool >/dev/null 2>&1; then
            cp $(command -v $tool) /debug-tools/netshoot/bin/ 2>/dev/null || true
          fi
        done
        echo "Netshoot tools installed successfully"
    volumeMounts:
      - name: debug-tools-netshoot
        mountPath: /debug-tools/netshoot
```

#### Volumes
```yaml
volumes:
  - name: debug-tools-busybox
    emptyDir: {}
  - name: debug-tools-netshoot
    emptyDir: {}
```

#### Main Container Volume Mounts
```yaml
containers:
  - name: main-app
    volumeMounts:
      - name: debug-tools-busybox
        mountPath: /debug-tools/busybox
      - name: debug-tools-netshoot
        mountPath: /debug-tools/netshoot
```

## Backward Compatibility Flow

### Legacy Configuration Input

```json
{
  "enabled": true,
  "toolset": "busybox",
  "mountPath": "/debug-tools"
}
```

### Automatic Conversion

```
normalizeDebugConfig()
        ↓
isLegacyConfig() → true
        ↓
convertLegacyToMultiConfig()
        ↓
{
  "enabled": true,
  "tools": [
    {
      "toolset": "busybox",
      "mountPath": "/debug-tools"
    }
  ]
}
```

### Result: Same Kubernetes Resources

The converted config generates the same Kubernetes resources as before, ensuring zero breaking changes for existing deployments.

## Key Integration Points

### 1. Type Safety
```typescript
// All types are properly defined and imported
import type { MultiDebugConfig } from '@/types/project'
import type { K8sInitContainer, K8sVolume } from '@/lib/debug-tools-utils'
```

### 2. Error Handling
```typescript
// Gracefully handles null/undefined configs
const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
// Returns null if config is invalid or disabled

const debugInitContainers = generateDebugInitContainers(normalizedDebugConfig)
// Returns empty array if config is null or disabled
```

### 3. Consistency
```typescript
// Same logic for both Deployment and StatefulSet
// Both use the same utility functions
// Both support multiple debug tools
```

## Performance Characteristics

### Pod Startup Time

```
Without Debug Tools:
  Pod Creation → Container Start → Ready
  ~5-10 seconds

With 1 Debug Tool:
  Pod Creation → Init Container 1 → Container Start → Ready
  ~10-20 seconds (+5-10s)

With 3 Debug Tools:
  Pod Creation → Init Container 1 → Init Container 2 → Init Container 3 → Container Start → Ready
  ~20-40 seconds (+15-30s)
```

### Resource Usage

Each debug tool adds:
- **CPU**: Minimal during init, zero after
- **Memory**: ~10-50MB per tool (emptyDir volume)
- **Disk**: ~5-100MB per tool (depending on toolset)

## Security Considerations

### Volume Isolation
- Each tool has its own emptyDir volume
- Tools cannot interfere with each other
- Volumes are ephemeral (deleted when pod terminates)

### Image Security
- Default images are from trusted sources
- Custom images should be scanned before use
- imagePullPolicy: IfNotPresent (uses local cache when available)

### Path Validation
- All mount paths are validated before deployment
- Prevents path traversal attacks
- Ensures paths don't conflict with system directories

## Conclusion

The integration provides a seamless flow from user selection to Kubernetes deployment, with full backward compatibility and robust error handling. The architecture is clean, maintainable, and follows Kubernetes best practices.
