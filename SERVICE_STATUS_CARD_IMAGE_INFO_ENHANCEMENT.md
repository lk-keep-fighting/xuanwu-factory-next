# Pod Monitor Dialog Container Image Enhancement - Complete

## Enhancement Description
Enhanced the Pod Monitor Dialog (监控弹框) to display actual running container image information within each container's status section, allowing users to see which container images are currently running in real-time while maintaining the original dialog layout.

## Implementation Details

### Modified Component
**File**: `src/components/services/OverviewTab.tsx`

### Changes Made

#### 1. Enhanced PodMonitorDialog Props
**Before**:
```tsx
const PodMonitorDialog = memo(function PodMonitorDialog({
  open,
  onClose,
  serviceId,
  serviceName
}: {
  // ... existing props
}) {
```

**After**:
```tsx
const PodMonitorDialog = memo(function PodMonitorDialog({
  open,
  onClose,
  serviceId,
  serviceName,
  currentDeployment  // ✅ Added
}: {
  // ... existing props
  currentDeployment: OverviewTabProps['currentDeployment']  // ✅ Added
}) {
```

#### 2. Added Image Parsing Logic
```tsx
// Parse current deployment image for display
const parseImageDisplay = useCallback((imageDisplay: string) => {
  const parsed = parseImageReference(imageDisplay)
  return {
    imageName: parsed.image || imageDisplay,
    tag: parsed.tag || 'latest'
  }
}, [])

const handleCopyImage = useCallback(async (imageText: string) => {
  try {
    await navigator.clipboard.writeText(imageText)
    toast.success('镜像地址已复制到剪贴板')
  } catch (error) {
    toast.error('复制失败')
  }
}, [])
```

#### 3. Added Container Image Info in Pod Details
```tsx
{/* Container Image Information */}
{(container.image || container.imageID) && (
  <div className="mt-2 pt-2 border-t border-gray-200">
    <div className="text-xs text-gray-600 mb-1">容器镜像:</div>
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        {(() => {
          const runningImage = container.image || container.imageID || '未知镜像'
          const { imageName, tag } = parseImageDisplay(runningImage)
          return (
            <div>
              <div className="text-xs font-mono text-gray-700 break-all leading-relaxed">
                {imageName}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-gray-500 font-medium">TAG</span>
                <div className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700 border border-gray-200">
                  {tag}
                </div>
              </div>
            </div>
          )
        })()}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleCopyImage(container.image || container.imageID || '')}
        className="h-5 w-5 p-0 text-gray-500 hover:text-gray-700 flex-shrink-0"
        title="复制镜像地址"
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  </div>
)}
```

#### 4. Updated StatusCard Usage
```tsx
<StatusCard
  k8sStatus={k8sStatus}
  k8sStatusLoading={k8sStatusLoading}
  k8sStatusError={k8sStatusError}
  onRefresh={onRefreshStatus}
  serviceId={service.id || ''}
  serviceName={service.name || ''}
  currentDeployment={currentDeployment}  // ✅ Added
/>
```

## User Experience Benefits

### 1. Real-time Running Image Identification
- **Before**: Users could only see deployment records, not actual running images
- **After**: Shows actual images currently running in pods, including starting/running containers

### 2. Live Image Comparison
- Users can see actual running images vs deployment records
- Helps identify version mismatches or deployment issues
- Shows images for containers in different states (running, starting, failed)

### 3. Convenient Actions
- **Copy functionality**: Click to copy full image address
- **Parsed display**: Separate image name and tag for clarity
- **Compact layout**: Doesn't overwhelm the status card

## Technical Features

### Image Parsing
- Uses existing `parseImageReference` utility
- Separates image name and tag for better readability
- Handles various image reference formats

### Visual Design
- **Compact layout**: Fits well within existing card structure
- **Clear separation**: Border-top divider from other status info
- **Consistent styling**: Matches existing design patterns
- **Responsive**: Works on different screen sizes

### Functionality
- **Copy to clipboard**: Full image address copying
- **Toast notifications**: Success/error feedback
- **Conditional display**: Only shows when deployment exists
- **Accessibility**: Proper button titles and ARIA support

## Monitor Dialog Layout

### Updated Pod Monitor Dialog Structure
1. **Monitor Controls** (existing)
2. **Pod Status Information** (existing)
3. **Container Details** (existing + enhanced)
   - Container status (existing)
   - **Container Image Information** (✅ new)
     - Image name (parsed from live pod data)
     - Tag (highlighted)
     - Copy button
   - Container state information (existing)

## Validation
- ✅ No TypeScript/linting errors
- ✅ Maintains existing functionality
- ✅ Responsive design preserved
- ✅ Accessibility features included
- ✅ Consistent with existing UI patterns

## Status: COMPLETE
The Pod Monitor Dialog now displays actual running container image information within each container's status section while maintaining the original dialog layout. Users can see:

1. **Integrated view**: Image information seamlessly integrated into existing container details
2. **Real-time data**: Actual images from Kubernetes pods, not just deployment records  
3. **Multiple containers**: Support for multi-container pods with individual image info
4. **Copy functionality**: Easy copying of actual running image addresses
5. **Original layout preserved**: No additional cards or sections, just enhanced container details

This provides accurate, real-time visibility into which container images are actually running, starting, or failing in each container while keeping the familiar monitoring interface.