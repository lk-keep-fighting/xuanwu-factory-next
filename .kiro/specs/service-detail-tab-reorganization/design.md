# Design Document

## Overview

This design document outlines the reorganization of the service detail page tabs from 9 tabs to 6 more logically grouped tabs. The redesign aims to improve user experience by consolidating related functionality, reducing cognitive load, and creating a more intuitive information architecture.

The current implementation spreads configuration across multiple tabs (General, Environment, Volumes, Network), making it difficult for users to understand the complete configuration picture. The new design consolidates these into a single Configuration tab with clear sections, while creating a comprehensive Overview tab that provides all operational information at a glance.

## Architecture

### Component Structure

The service detail page will maintain its current React component structure but reorganize the tab content:

```
ServiceDetailPage (src/app/projects/[id]/services/[serviceId]/page.tsx)
├── Header (navigation, service name, status, action buttons)
├── Tabs Container
│   ├── Overview Tab
│   │   ├── StatusCard (service status, replicas, errors)
│   │   ├── ResourceMetricsCard (current CPU/memory usage)
│   │   ├── ResourceUsageChart (historical metrics from Prometheus)
│   │   ├── PodEventsCard (recent Kubernetes events)
│   │   └── CurrentDeploymentCard (active deployment info)
│   ├── Configuration Tab
│   │   ├── GeneralSection (service-type specific settings)
│   │   ├── EnvironmentSection (environment variables)
│   │   ├── VolumesSection (volume mounts)
│   │   ├── NetworkSection (ports, domains, service type)
│   │   └── ResourcesSection (CPU, memory, replicas)
│   ├── Deployments Tab
│   │   ├── CurrentDeploymentStatus
│   │   ├── DeploymentHistory
│   │   ├── BuildHistory (Application services only)
│   │   └── ImageVersionManagement (Application services only)
│   ├── Logs Tab
│   │   └── LogViewer (with refresh and auto-scroll)
│   ├── Files Tab
│   │   └── ServiceFileManager
│   └── YAML Tab
│       └── YAMLViewer (with refresh)
```

### State Management

The component will continue using React hooks for state management:

- `activeTab`: Current active tab (default: 'overview')
- `isEditing`: Edit mode for configuration sections
- `editedService`: Temporary state for configuration changes
- Configuration-specific state (envVars, volumes, networkPorts, etc.)
- Loading states for each data source (k8sStatus, metrics, events, logs, yaml)

### Data Flow

1. **Initial Load**: Fetch service details, K8s status, and pod events
2. **Tab Activation**: Load tab-specific data on first view (lazy loading)
3. **Refresh Actions**: Explicit refresh buttons for each data source
4. **Configuration Edits**: Local state updates with save/cancel actions
5. **Deployment Triggers**: Mark service for redeployment when network config changes

## Components and Interfaces

### New/Modified Components

#### OverviewTab Component

Consolidates operational information from the current Status tab and adds deployment status.

**Props:**
```typescript
interface OverviewTabProps {
  service: Service
  k8sStatus: K8sServiceStatus | null
  k8sStatusLoading: boolean
  k8sStatusError: string | null
  metricsHistory: MetricsDataPoint[]
  metricsLoading: boolean
  metricsError: string | null
  metricsTimeRange: string
  podEvents: PodEvent[]
  podEventsLoading: boolean
  podEventsError: string | null
  currentDeployment: Deployment | null
  ongoingDeployment: Deployment | null
  onRefreshStatus: () => Promise<void>
  onRefreshMetrics: (timeRange?: string) => void
  onRefreshEvents: () => Promise<void>
  onChangeTimeRange: (range: string) => void
}
```

#### ConfigurationTab Component

New component that consolidates General, Environment, Volumes, Network, and Resources.

**Props:**
```typescript
interface ConfigurationTabProps {
  service: Service
  project: Project | null
  isEditing: boolean
  editedService: Partial<Service>
  envVars: Array<{ key: string; value: string }>
  volumes: Array<VolumeMount>
  networkServiceType: ServiceNetworkType
  networkPorts: NetworkPortFormState[]
  headlessServiceEnabled: boolean
  cpuValue: string
  cpuUnit: 'm' | 'core'
  memoryValue: string
  memoryUnit: 'Mi' | 'Gi'
  cpuRequestValue: string
  cpuRequestUnit: 'm' | 'core'
  memoryRequestValue: string
  memoryRequestUnit: 'Mi' | 'Gi'
  hasPendingNetworkDeploy: boolean
  onStartEdit: () => void
  onSave: () => Promise<void>
  onCancel: () => void
  onUpdateService: (updates: Partial<Service>) => void
  onUpdateEnvVars: (vars: Array<{ key: string; value: string }>) => void
  onUpdateVolumes: (volumes: Array<VolumeMount>) => void
  onUpdateNetwork: (config: NetworkConfig) => void
  onUpdateResources: (limits: ResourceLimits, requests: ResourceRequests) => void
}
```

#### DeploymentsTab Component

Enhanced version of current Deployments tab with build history and image management.

**Props:**
```typescript
interface DeploymentsTabProps {
  service: Service
  deployments: Deployment[]
  deploymentsLoading: boolean
  deploymentsError: string | null
  serviceImages: ServiceImageRecord[]
  imagesLoading: boolean
  imagesError: string | null
  imagePagination: PaginationInfo
  currentDeployment: DeploymentImageInfo | null
  ongoingDeployment: DeploymentImageInfo | null
  onRefreshDeployments: () => Promise<void>
  onRefreshImages: () => Promise<void>
  onDeploy: (imageId?: string) => Promise<void>
  onBuild: (branch: string, tag: string) => Promise<void>
  onActivateImage: (imageId: string) => Promise<void>
  onPageChange: (page: number) => void
}
```

### Existing Components (Reused)

- **LogsTab**: Minimal changes, keep existing implementation
- **FilesTab**: No changes, uses ServiceFileManager component
- **YAMLTab**: Minimal changes, keep existing implementation
- **ResourceUsageChart**: Reused in Overview tab
- **ServiceFileManager**: Reused in Files tab
- **ImageReferencePicker**: Reused in Configuration tab

## Data Models

### Tab State

```typescript
type TabValue = 'overview' | 'configuration' | 'deployments' | 'logs' | 'files' | 'yaml'

interface TabConfig {
  value: TabValue
  label: string
  icon: React.ComponentType
  visible: (service: Service) => boolean
  loadOnActivate?: () => Promise<void>
}
```

### Configuration Section State

```typescript
interface ConfigurationSection {
  id: string
  title: string
  visible: (service: Service) => boolean
  component: React.ComponentType<any>
}

const configurationSections: ConfigurationSection[] = [
  { id: 'general', title: 'General Settings', visible: () => true, component: GeneralSection },
  { id: 'environment', title: 'Environment Variables', visible: () => true, component: EnvironmentSection },
  { id: 'volumes', title: 'Volume Mounts', visible: () => true, component: VolumesSection },
  { id: 'network', title: 'Network Configuration', visible: () => true, component: NetworkSection },
  { id: 'resources', title: 'Resource Limits', visible: () => true, component: ResourcesSection }
]
```

### Deployment Status Display

```typescript
interface DeploymentStatusDisplay {
  current: {
    image: string
    branch?: string
    status: 'running' | 'stopped' | 'error'
    replicas?: { ready: number; total: number }
  } | null
  ongoing: {
    image: string
    branch?: string
    status: 'pending' | 'building'
    progress?: { updated: number; total: number }
  } | null
  lastFailed: {
    image: string
    error: string
    timestamp: string
  } | null
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Time range selection updates metrics

*For any* valid time range value ('1h', '6h', '24h', '7d'), when a user selects that time range, the metrics chart should display data for that time period.

**Validates: Requirements 1.2**

### Property 2: Event display limits to 10 items

*For any* list of pod events with length greater than 10, the Overview tab should display exactly the first 10 events with all required fields (type, reason, message, timestamp).

**Validates: Requirements 1.4**

### Property 3: Configuration edit pattern consistency

*For any* configuration section (General, Environment, Volumes, Network, Resources), when in edit mode, the section should provide Save and Cancel buttons with consistent behavior.

**Validates: Requirements 2.2**

### Property 4: Network changes trigger redeployment warning

*For any* modification to network configuration (service type, ports, domains), saving the changes should set the pending redeployment flag and display a warning message.

**Validates: Requirements 2.3**

### Property 5: Deployment records contain required fields

*For any* deployment record displayed in the history, the display should include status, image version, timestamp, duration, and branch information (if available).

**Validates: Requirements 3.3**

### Property 6: Build records contain required fields

*For any* build record displayed in the history, the display should include build number, status, image tag, branch, and creation timestamp.

**Validates: Requirements 3.4**

### Property 7: Resource validation prevents invalid values

*For any* invalid resource value (negative numbers, non-numeric input, empty required fields), the save action should be prevented and a validation error should be displayed.

**Validates: Requirements 7.3**

### Property 8: Resource values display with units

*For any* resource configuration value (CPU, memory), the displayed value should include the appropriate unit (m/core for CPU, Mi/Gi for memory).

**Validates: Requirements 7.5**

### Property 9: Domain name generation follows pattern

*For any* project identifier and port configuration with domain enabled, the generated domain should follow the pattern `{sanitized-prefix}.{project-identifier}.{domain-root}`.

**Validates: Requirements 8.3**

### Property 10: Common tabs visible for all service types

*For any* service type (Application, Database, Image), the tab list should include Overview, Configuration, Deployments, Logs, Files, and YAML tabs.

**Validates: Requirements 6.4**

## Error Handling

### Data Loading Errors

1. **K8s Status Errors**: Display error message in StatusCard with retry button
2. **Metrics Errors**: Show error state in ResourceMetricsCard with explanation
3. **Events Errors**: Display error message in PodEventsCard
4. **Logs Errors**: Show error message in LogsTab with retry button
5. **YAML Errors**: Display error message in YAMLTab with retry button

### Validation Errors

1. **Resource Limits**: Validate positive numbers, show inline errors
2. **Port Numbers**: Validate range (1-65535), show inline errors
3. **Domain Prefixes**: Validate format (lowercase, alphanumeric, hyphens), show inline errors
4. **Environment Variables**: Validate key format, show inline errors

### Network Errors

1. **API Failures**: Display toast notifications with error details
2. **Timeout Errors**: Show retry option with exponential backoff
3. **Permission Errors**: Display clear message about insufficient permissions

## Testing Strategy

### Unit Testing

We will use **Vitest** and **React Testing Library** for unit testing React components.

**Test Coverage:**

1. **Tab Rendering Tests**
   - Verify correct tabs are rendered for each service type
   - Verify tab switching updates activeTab state
   - Verify lazy loading triggers data fetch on first tab activation

2. **Configuration Section Tests**
   - Verify all sections render in Configuration tab
   - Verify edit/save/cancel pattern works for each section
   - Verify validation errors display correctly

3. **Data Display Tests**
   - Verify deployment status displays correctly
   - Verify resource metrics format correctly
   - Verify event list limits to 10 items

4. **Conditional Rendering Tests**
   - Verify Application-specific sections show for Application services
   - Verify Database-specific sections show for Database services
   - Verify Image-specific sections show for Image services

### Property-Based Testing

We will use **fast-check** for property-based testing in TypeScript/JavaScript.

**Property Test Configuration:**
- Minimum 100 iterations per property test
- Each property test must reference its design document property number
- Tag format: `**Feature: service-detail-tab-reorganization, Property {number}: {property_text}**`

**Property Tests:**

1. **Property 1 Test**: Time range selection
   - Generate random time ranges from valid set
   - Verify metrics refresh called with correct parameter

2. **Property 2 Test**: Event display limiting
   - Generate random event lists of varying lengths
   - Verify display shows max 10 events with all fields

3. **Property 3 Test**: Configuration edit consistency
   - Generate random configuration sections
   - Verify each has Save/Cancel buttons

4. **Property 7 Test**: Resource validation
   - Generate invalid resource values (negative, non-numeric, empty)
   - Verify save is prevented and errors shown

5. **Property 8 Test**: Resource unit display
   - Generate random resource values with units
   - Verify display includes unit suffix

6. **Property 9 Test**: Domain name generation
   - Generate random project identifiers and prefixes
   - Verify domain follows pattern

7. **Property 10 Test**: Common tabs for all types
   - Generate services of each type
   - Verify all have the 6 common tabs

### Integration Testing

1. **Tab Navigation Flow**
   - Test navigating between all tabs
   - Verify data persists across tab switches
   - Verify lazy loading works correctly

2. **Configuration Save Flow**
   - Test editing and saving each configuration section
   - Verify API calls made with correct data
   - Verify success/error handling

3. **Deployment Flow**
   - Test deployment from Deployments tab
   - Verify status updates in Overview tab
   - Verify deployment history updates

## Migration Strategy

### Phase 1: Create New Tab Structure (No Breaking Changes)

1. Keep existing 9 tabs functional
2. Add new Overview tab with consolidated content
3. Add new Configuration tab with all sections
4. Update Deployments tab with build history

### Phase 2: Update Default Tab

1. Change default activeTab from 'status' to 'overview'
2. Add redirect logic: if URL has old tab name, redirect to new equivalent
3. Update any deep links in the application

### Phase 3: Remove Old Tabs

1. Remove 'status', 'general', 'environment', 'volumes', 'network' tabs
2. Update tab value type to only include new tab names
3. Clean up unused state and handlers

### Phase 4: Polish and Optimize

1. Add animations for tab transitions
2. Optimize data fetching (reduce redundant API calls)
3. Add keyboard shortcuts for tab navigation
4. Improve mobile responsiveness

## Performance Considerations

1. **Lazy Loading**: Only fetch tab-specific data when tab is first activated
2. **Memoization**: Use React.memo for expensive components (charts, tables)
3. **Debouncing**: Debounce search/filter inputs in configuration sections
4. **Virtual Scrolling**: Consider for long lists (events, deployments, logs)
5. **Code Splitting**: Split tab components into separate chunks

## Accessibility

1. **Keyboard Navigation**: Support Tab, Arrow keys for tab navigation
2. **Screen Readers**: Proper ARIA labels for tabs and sections
3. **Focus Management**: Maintain focus when switching tabs
4. **Color Contrast**: Ensure sufficient contrast for status indicators
5. **Error Announcements**: Use ARIA live regions for error messages

## Future Enhancements

1. **Customizable Tab Order**: Allow users to reorder tabs
2. **Collapsible Sections**: Allow collapsing configuration sections
3. **Quick Actions**: Add floating action button for common tasks
4. **Real-time Updates**: WebSocket support for live status updates
5. **Export Configuration**: Export service config as YAML/JSON
