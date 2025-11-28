# Implementation Plan

- [x] 1. Refactor existing code to prepare for tab reorganization
  - Extract reusable components from current tab implementations
  - Create shared types and interfaces for tab components
  - Set up new tab value constants and routing
  - _Requirements: 6.4_

- [x] 2. Implement Overview Tab component
  - Create OverviewTab component with props interface
  - Integrate StatusCard showing service status and replicas
  - Integrate ResourceMetricsCard for current CPU/memory usage
  - Integrate ResourceUsageChart for historical Prometheus metrics
  - Integrate PodEventsCard with event limiting to 10 items
  - Add CurrentDeploymentCard showing active deployment info
  - Wire up refresh handlers for status, metrics, and events
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ]* 2.1 Write property test for time range selection
  - **Property 1: Time range selection updates metrics**
  - **Validates: Requirements 1.2**

- [ ]* 2.2 Write property test for event display limiting
  - **Property 2: Event display limits to 10 items**
  - **Validates: Requirements 1.4**

- [ ]* 2.3 Write unit tests for Overview Tab
  - Test StatusCard renders with correct data
  - Test ResourceMetricsCard displays when metrics available
  - Test error states for unavailable metrics
  - Test PodEventsCard displays events correctly
  - Test refresh buttons trigger correct handlers
  - _Requirements: 1.1, 1.3, 1.5_

- [x] 3. Implement Configuration Tab with General section
  - Create ConfigurationTab component with section structure
  - Implement GeneralSection for service-type specific settings
  - Add edit/save/cancel pattern with consistent UI
  - Implement Git configuration display for Application services
  - Implement database configuration display for Database services
  - Implement image configuration display for Image services
  - _Requirements: 2.1, 2.2, 2.5, 6.1, 6.2, 6.3_

- [ ]* 3.1 Write property test for configuration edit consistency
  - **Property 3: Configuration edit pattern consistency**
  - **Validates: Requirements 2.2**

- [ ]* 3.2 Write unit tests for Configuration Tab structure
  - Test all sections render in Configuration tab
  - Test edit mode enables Save/Cancel buttons
  - Test service-type specific sections display correctly
  - _Requirements: 2.1, 2.5_

- [x] 4. Implement Environment Variables section
  - Create EnvironmentSection component
  - Implement add/remove/update environment variable handlers
  - Add validation for environment variable keys
  - Integrate with existing envVars state
  - _Requirements: 2.1_

- [ ]* 4.1 Write unit tests for Environment section
  - Test adding environment variables
  - Test removing environment variables
  - Test updating environment variable values
  - Test validation for invalid keys
  - _Requirements: 2.1_

- [x] 5. Implement Volumes section
  - Create VolumesSection component
  - Implement add/remove/update volume mount handlers
  - Add volume template application functionality
  - Integrate with existing volumes state
  - _Requirements: 2.1_

- [ ]* 5.1 Write unit tests for Volumes section
  - Test adding volume mounts
  - Test removing volume mounts
  - Test updating volume mount paths
  - Test applying volume templates
  - _Requirements: 2.1_

- [x] 6. Implement Network Configuration section
  - Create NetworkSection component
  - Implement service type selector (ClusterIP, NodePort, LoadBalancer)
  - Implement port mapping add/remove/update handlers
  - Add domain configuration with prefix input
  - Implement Headless Service toggle
  - Add pending redeployment warning display
  - _Requirements: 2.1, 2.3, 2.4, 8.1, 8.2, 8.3, 8.4_

- [ ]* 6.1 Write property test for network changes trigger warning
  - **Property 4: Network changes trigger redeployment warning**
  - **Validates: Requirements 2.3**

- [ ]* 6.2 Write property test for domain name generation
  - **Property 9: Domain name generation follows pattern**
  - **Validates: Requirements 8.3**

- [ ]* 6.3 Write unit tests for Network section
  - Test service type selection
  - Test adding/removing port mappings
  - Test domain configuration
  - Test Headless Service toggle
  - Test pending redeployment warning display
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 7. Implement Resources section
  - Create ResourcesSection component
  - Implement CPU limit input with unit selector (m/core)
  - Implement memory limit input with unit selector (Mi/Gi)
  - Implement CPU request input with unit selector
  - Implement memory request input with unit selector
  - Add replica count input
  - Add validation for resource values
  - _Requirements: 2.1, 7.1, 7.2, 7.3, 7.5_

- [ ]* 7.1 Write property test for resource validation
  - **Property 7: Resource validation prevents invalid values**
  - **Validates: Requirements 7.3**

- [ ]* 7.2 Write property test for resource unit display
  - **Property 8: Resource values display with units**
  - **Validates: Requirements 7.5**

- [ ]* 7.3 Write unit tests for Resources section
  - Test CPU/memory limit inputs
  - Test CPU/memory request inputs
  - Test unit selector functionality
  - Test validation for invalid values
  - Test replica count input
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 8. Implement unified save handler for Configuration tab
  - Create handleSave function that collects all section changes
  - Implement validation across all sections
  - Add network config change detection
  - Implement pending redeployment flag setting
  - Add success/error toast notifications
  - _Requirements: 2.2, 2.3, 2.4, 7.4_

- [ ]* 8.1 Write unit tests for save handler
  - Test save collects changes from all sections
  - Test validation prevents save with invalid data
  - Test network changes set redeployment flag
  - Test success/error notifications
  - _Requirements: 2.2, 2.3, 2.4_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement enhanced Deployments Tab
  - Create DeploymentsTab component with sections
  - Add CurrentDeploymentStatus section
  - Implement DeploymentHistory section with pagination
  - Add BuildHistory section for Application services
  - Implement ImageVersionManagement section for Application services
  - Wire up deploy, build, and activate image handlers
  - _Requirements: 3.1, 3.2, 3.5_

- [ ]* 10.1 Write property test for deployment record fields
  - **Property 5: Deployment records contain required fields**
  - **Validates: Requirements 3.3**

- [ ]* 10.2 Write property test for build record fields
  - **Property 6: Build records contain required fields**
  - **Validates: Requirements 3.4**

- [ ]* 10.3 Write unit tests for Deployments Tab
  - Test deployment history displays correctly
  - Test build history displays for Application services
  - Test image version management displays
  - Test in-progress deployment shows progress
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 11. Update Logs Tab for new structure
  - Ensure Logs tab maintains existing functionality
  - Verify auto-scroll to bottom on load
  - Verify refresh maintains scroll position
  - Add error handling display
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ]* 11.1 Write unit tests for Logs Tab
  - Test logs display 200 lines
  - Test auto-scroll to bottom
  - Test refresh functionality
  - Test error message display
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 12. Update Files Tab for new structure
  - Ensure Files tab maintains existing functionality
  - Verify ServiceFileManager component integration
  - _Requirements: 4.4_

- [ ]* 12.1 Write unit tests for Files Tab
  - Test file manager renders correctly
  - _Requirements: 4.4_

- [x] 13. Update YAML Tab for new structure
  - Ensure YAML tab maintains existing functionality
  - Verify loading indicator displays
  - Verify error handling
  - Verify refresh functionality
  - Verify monospace font and syntax highlighting
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 13.1 Write unit tests for YAML Tab
  - Test YAML content displays
  - Test loading indicator
  - Test error message display
  - Test refresh functionality
  - Test monospace font styling
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 14. Implement tab visibility logic
  - Create tab configuration with visibility rules
  - Implement service-type based tab filtering
  - Ensure all service types show 6 common tabs
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 14.1 Write property test for common tabs visibility
  - **Property 10: Common tabs visible for all service types**
  - **Validates: Requirements 6.4**

- [ ]* 14.2 Write unit tests for tab visibility
  - Test Application services show all tabs
  - Test Database services show all tabs
  - Test Image services show all tabs
  - Test service-specific sections display correctly
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 15. Implement lazy loading for tabs
  - Add loadOnActivate handlers for each tab
  - Implement first-activation detection
  - Add loading states for lazy-loaded data
  - Optimize to prevent redundant API calls
  - _Requirements: 1.5_

- [ ]* 15.1 Write unit tests for lazy loading
  - Test data loads on first tab activation
  - Test data doesn't reload on subsequent activations
  - Test loading states display correctly
  - _Requirements: 1.5_

- [x] 16. Update tab routing and default tab
  - Change default activeTab from 'status' to 'overview'
  - Add URL parameter support for tab selection
  - Implement redirect logic for old tab names
  - Update any deep links in the application
  - _Requirements: 1.1_

- [ ]* 16.1 Write unit tests for tab routing
  - Test default tab is 'overview'
  - Test URL parameter sets active tab
  - Test old tab names redirect correctly
  - _Requirements: 1.1_

- [x] 17. Add accessibility features
  - Implement keyboard navigation for tabs (Tab, Arrow keys)
  - Add ARIA labels for tabs and sections
  - Implement focus management for tab switching
  - Add ARIA live regions for error messages
  - Ensure color contrast for status indicators
  - _Requirements: All_

- [ ]* 17.1 Write unit tests for accessibility
  - Test keyboard navigation works
  - Test ARIA labels are present
  - Test focus management
  - Test screen reader announcements
  - _Requirements: All_

- [x] 18. Optimize performance
  - Add React.memo for expensive components
  - Implement debouncing for search/filter inputs
  - Add code splitting for tab components
  - Optimize re-renders with useMemo and useCallback
  - _Requirements: All_

- [ ]* 18.1 Write performance tests
  - Test component memoization prevents unnecessary renders
  - Test debouncing reduces API calls
  - _Requirements: All_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Update documentation
  - Update component documentation
  - Add migration guide for developers
  - Update user documentation with new tab structure
  - Add screenshots of new UI
  - _Requirements: All_
