# Lazy Loading Implementation for Service Detail Tabs

## Overview

This document describes the lazy loading implementation for the service detail page tabs, which optimizes data fetching by only loading tab-specific data when a tab is first activated.

## Implementation Details

### First-Activation Detection

We use a `useRef` to track which tabs have been activated:

```typescript
const activatedTabsRef = useRef<Set<TabValue>>(new Set())
```

This ref persists across renders and allows us to check if a tab has been previously activated without triggering re-renders.

### Lazy Loading Logic

The main lazy loading logic is implemented in a `useEffect` that watches the `activeTab` state:

```typescript
useEffect(() => {
  const isFirstActivation = !activatedTabsRef.current.has(activeTab)
  
  if (isFirstActivation) {
    activatedTabsRef.current.add(activeTab)
    
    // Load data based on which tab is being activated for the first time
    switch (activeTab) {
      case 'overview':
        // Enable metrics collection for overview tab
        if (k8sStatusInfo?.status?.toLowerCase() === 'running') {
          setMetricsEnabled(true)
        }
        break
        
      case 'deployments':
        void loadDeployments()
        if (service?.type === ServiceType.APPLICATION) {
          void loadServiceImages({ page: 1 })
        }
        break
        
      case 'logs':
        void loadLogs()
        break
        
      case 'yaml':
        void loadYAML()
        break
    }
  }
}, [activeTab])
```

### Tab-Specific Loading Behavior

#### Overview Tab
- **Data loaded on mount**: K8s status, pod events
- **Data loaded on first activation**: Metrics collection is enabled (if service is running)
- **Rationale**: Overview is the default tab, so we load basic status info on mount but defer expensive metrics collection until the tab is actually viewed

#### Configuration Tab
- **Data loaded**: None (uses existing service data)
- **Rationale**: All configuration data is already available in the service object loaded on mount

#### Deployments Tab
- **Data loaded on first activation**: Deployment history, service images (for Application services)
- **Rationale**: Deployment data can be large and is not needed unless the user views this tab

#### Logs Tab
- **Data loaded on first activation**: Service logs (200 lines)
- **Rationale**: Logs are expensive to fetch and only needed when viewing the logs tab

#### Files Tab
- **Data loaded**: None (ServiceFileManager handles its own loading)
- **Rationale**: The file manager component manages its own data fetching lifecycle

#### YAML Tab
- **Data loaded on first activation**: Kubernetes YAML configuration
- **Rationale**: YAML is only needed when viewing this specific tab

### Preventing Redundant API Calls

1. **First-activation tracking**: Once a tab is activated, it's marked in `activatedTabsRef` and won't trigger loading again
2. **Service change reset**: When the service ID changes, we clear the activated tabs set to allow fresh loading for the new service
3. **Metrics optimization**: Metrics collection is only enabled when:
   - The overview tab has been activated
   - The service status is "running"
   - This prevents unnecessary Prometheus queries when not viewing metrics

### Loading States

All tabs use existing loading states:
- `k8sStatusLoading` - K8s status loading
- `podEventsLoading` - Pod events loading
- `metricsLoading` - Metrics data loading (from useMetricsHistory hook)
- `deploymentsLoading` - Deployments loading
- `imagesLoading` - Service images loading
- `logsLoading` - Logs loading
- `yamlLoading` - YAML loading

These loading states are used by the UI to show loading indicators and prevent user interaction during data fetching.

## Benefits

1. **Reduced Initial Load Time**: Only essential data (service details, K8s status, pod events) is loaded on mount
2. **Lower Server Load**: Expensive queries (logs, YAML, metrics) are only executed when needed
3. **Better User Experience**: Tabs load quickly when first activated, and subsequent visits are instant
4. **Resource Efficiency**: Metrics collection only runs when the overview tab is active and the service is running

## Testing Considerations

To verify lazy loading is working correctly:

1. **First activation**: Open a service detail page and switch to each tab - verify that data loads only on first visit
2. **Subsequent activations**: Switch back to previously visited tabs - verify no additional API calls are made
3. **Service change**: Navigate to a different service - verify that tabs reset and load fresh data
4. **Metrics optimization**: Verify that metrics queries only run when overview tab is active and service is running

## Requirements Satisfied

- ✅ **Requirement 1.5**: "WHEN the user refreshes the overview THEN the system SHALL update all operational data including K8s status, metrics, and events"
  - Lazy loading ensures data is loaded efficiently while still supporting explicit refresh actions

