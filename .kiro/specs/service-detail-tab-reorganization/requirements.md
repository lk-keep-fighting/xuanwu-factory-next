# Requirements Document

## Introduction

This document specifies the requirements for reorganizing and improving the service detail page tabs in the Kubernetes management platform. The current implementation has 9 tabs with overlapping concerns and inconsistent information architecture. The goal is to create a more intuitive, user-friendly tab structure that groups related functionality logically and reduces cognitive load for users managing services.

## Glossary

- **Service Detail Page**: The page displaying comprehensive information about a single Kubernetes service (Application, Database, or Image type)
- **Tab**: A navigation element that switches between different views of service information
- **Service Status**: Real-time operational state of a Kubernetes service (running, stopped, pending, error, building)
- **Resource Metrics**: CPU and memory usage data collected from Kubernetes and Prometheus
- **Deployment History**: Historical record of service deployments with status and timestamps
- **Network Configuration**: Service networking settings including ports, protocols, and domain mappings
- **Pod Events**: Kubernetes events related to the service's pods and deployments
- **Application Service**: A service type that builds from Git repositories
- **Database Service**: A service type for managed databases (MySQL, Redis)
- **Image Service**: A service type that deploys from container images

## Requirements

### Requirement 1

**User Story:** As a DevOps engineer, I want to see all operational information in one place, so that I can quickly assess service health without switching tabs.

#### Acceptance Criteria

1. WHEN a user views the service detail page THEN the system SHALL display a unified "Overview" tab containing service status, resource metrics, recent events, and deployment status
2. WHEN the service is running THEN the system SHALL display real-time resource usage charts with selectable time ranges (1h, 6h, 24h, 7d)
3. WHEN resource metrics are unavailable THEN the system SHALL display a clear message explaining why metrics cannot be retrieved
4. WHEN pod events exist THEN the system SHALL display the most recent 10 events with type, reason, message, and timestamp
5. WHEN the user refreshes the overview THEN the system SHALL update all operational data including K8s status, metrics, and events

### Requirement 2

**User Story:** As a developer, I want configuration settings grouped by purpose, so that I can efficiently manage service settings without confusion.

#### Acceptance Criteria

1. WHEN a user views configuration options THEN the system SHALL organize settings into logical groups: General, Environment, Volumes, Network, and Resources
2. WHEN editing configuration THEN the system SHALL provide a consistent edit/save/cancel pattern across all configuration sections
3. WHEN configuration changes affect deployment THEN the system SHALL warn the user that redeployment is required
4. WHEN the user saves network configuration changes THEN the system SHALL mark the service as requiring redeployment
5. WHERE the service type is Application THEN the system SHALL display Git configuration, build settings, and image version management in the General configuration section

### Requirement 3

**User Story:** As a system administrator, I want deployment and build information consolidated, so that I can track the complete lifecycle of service versions.

#### Acceptance Criteria

1. WHEN a user views the Deployments tab THEN the system SHALL display deployment history, build history (for Application services), and image version management
2. WHERE the service type is Application THEN the system SHALL display build controls, branch selection, and tag configuration
3. WHEN viewing deployment history THEN the system SHALL show deployment status, image version, timestamp, duration, and associated branch information
4. WHEN viewing build history THEN the system SHALL display build number, status, image tag, branch, and creation timestamp
5. WHEN a deployment is in progress THEN the system SHALL display real-time progress indicators with replica counts

### Requirement 4

**User Story:** As a developer, I want to access logs and files in dedicated tabs, so that I can troubleshoot issues efficiently.

#### Acceptance Criteria

1. WHEN a user views the Logs tab THEN the system SHALL display the most recent 200 lines of service logs
2. WHEN logs are loaded THEN the system SHALL automatically scroll to the bottom to show the most recent entries
3. WHEN the user refreshes logs THEN the system SHALL fetch the latest log entries and maintain scroll position at bottom
4. WHEN the user views the Files tab THEN the system SHALL display the file manager interface for browsing and managing service files
5. WHEN log retrieval fails THEN the system SHALL display a clear error message with the failure reason

### Requirement 5

**User Story:** As a DevOps engineer, I want to view and edit YAML configuration, so that I can make advanced Kubernetes configuration changes.

#### Acceptance Criteria

1. WHEN a user views the YAML tab THEN the system SHALL display the current Kubernetes YAML configuration
2. WHEN the YAML is loading THEN the system SHALL display a loading indicator
3. WHEN YAML retrieval fails THEN the system SHALL display an error message with the failure reason
4. WHEN the user refreshes YAML THEN the system SHALL fetch the latest configuration from Kubernetes
5. WHEN YAML content is displayed THEN the system SHALL use monospace font with syntax highlighting

### Requirement 6

**User Story:** As a user, I want the tab structure to adapt to service type, so that I only see relevant options for my service.

#### Acceptance Criteria

1. WHERE the service type is Application THEN the system SHALL display Git configuration, build controls, and image version management
2. WHERE the service type is Database THEN the system SHALL display database-specific configuration including connection strings and external access controls
3. WHERE the service type is Image THEN the system SHALL display image selection and tag configuration
4. WHEN viewing any service type THEN the system SHALL display common tabs: Overview, Configuration, Deployments, Logs, Files, YAML
5. WHEN the service has not been deployed THEN the system SHALL allow service renaming

### Requirement 7

**User Story:** As a developer, I want resource configuration consolidated, so that I can manage CPU, memory, and replica settings in one place.

#### Acceptance Criteria

1. WHEN a user views resource configuration THEN the system SHALL display CPU limits, memory limits, CPU requests, memory requests, and replica count in a single section
2. WHEN editing resource limits THEN the system SHALL provide unit selection (millicores/cores for CPU, Mi/Gi for memory)
3. WHEN resource values are invalid THEN the system SHALL prevent saving and display validation errors
4. WHEN resource configuration is saved THEN the system SHALL update the service and mark it for redeployment if necessary
5. WHEN viewing resource configuration THEN the system SHALL display current values with appropriate units

### Requirement 8

**User Story:** As a system administrator, I want network configuration in a dedicated section, so that I can manage ports, protocols, and domain mappings efficiently.

#### Acceptance Criteria

1. WHEN a user views network configuration THEN the system SHALL display service type (ClusterIP, NodePort, LoadBalancer), port mappings, and domain configuration
2. WHEN adding a port mapping THEN the system SHALL allow specification of container port, service port, protocol, and optional NodePort
3. WHEN enabling domain access for a port THEN the system SHALL generate a domain name using the project identifier and domain root
4. WHEN the user enables Headless Service THEN the system SHALL configure the service for StatefulSet usage
5. WHERE the service type is Database AND external access is enabled THEN the system SHALL display the external connection string with host and port

## Proposed Tab Structure

### New Organization

1. **Overview** (formerly "Status")
   - Service status and health
   - Real-time resource metrics with charts
   - Recent pod events
   - Current deployment information
   - Quick action buttons

2. **Configuration** (consolidates "General", "Environment", "Volumes", "Network")
   - General Settings (name, type, Git config for Applications, image config for Image services)
   - Environment Variables
   - Volume Mounts
   - Network Configuration (ports, domains, service type)
   - Resource Limits (CPU, memory, replicas)

3. **Deployments** (consolidates deployment and build history)
   - Current deployment status
   - Deployment history
   - Build history (for Application services)
   - Image version management (for Application services)
   - Deploy and build actions

4. **Logs**
   - Real-time log viewing
   - Log refresh controls
   - Error handling

5. **Files**
   - File browser and manager
   - Upload/download capabilities
   - File operations

6. **YAML**
   - Kubernetes YAML configuration
   - View and potentially edit
   - Refresh controls

## Benefits of Reorganization

1. **Reduced Cognitive Load**: From 9 tabs to 6 tabs, with clearer purpose for each
2. **Improved Discoverability**: Related settings grouped together
3. **Better Information Architecture**: Operational data separate from configuration
4. **Consistent Patterns**: Edit/save/cancel pattern unified across configuration sections
5. **Type-Specific Adaptation**: Tabs and sections adapt to service type (Application, Database, Image)
