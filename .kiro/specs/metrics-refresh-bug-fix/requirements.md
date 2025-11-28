# Requirements Document

## Introduction

This document specifies the requirements for fixing a bug in the service detail page where clicking the refresh button in the resource usage trend chart does not fetch new data. The issue occurs in the Overview tab of the service detail page.

## Glossary

- **Service Detail Page**: The page displaying detailed information about a specific service, located at `/projects/[id]/services/[serviceId]`
- **Overview Tab**: The first tab in the service detail page showing operational information including resource usage trends
- **Resource Usage Trend Chart**: A chart component displaying CPU and memory usage over time with time range selection buttons
- **Refresh Button**: The button in the top-right corner of the resource usage trend chart that should reload metrics data
- **Time Range Buttons**: Buttons (1小时, 6小时, 24小时, 7天) that allow users to change the time range for metrics display
- **Metrics Hook**: The `useMetricsHistory` custom hook that fetches metrics data from Prometheus

## Requirements

### Requirement 1

**User Story:** As a user monitoring service resources, I want to click the refresh button to reload the latest metrics data, so that I can see the most current resource usage information.

#### Acceptance Criteria

1. WHEN a user clicks the refresh button in the resource usage trend chart THEN the system SHALL fetch new metrics data from Prometheus
2. WHEN new metrics data is fetched THEN the system SHALL update the chart display with the latest data points
3. WHEN the refresh button is clicked THEN the system SHALL show a loading indicator during the data fetch operation
4. WHEN metrics data fetch completes successfully THEN the system SHALL display the updated chart without changing the selected time range
5. WHEN metrics data fetch fails THEN the system SHALL display an appropriate error message to the user

### Requirement 2

**User Story:** As a user monitoring service resources, I want to change the time range and see updated data, so that I can analyze resource usage over different time periods.

#### Acceptance Criteria

1. WHEN a user clicks a time range button (1小时, 6小时, 24小时, 7天) THEN the system SHALL update the selected time range state
2. WHEN the time range state changes THEN the system SHALL automatically fetch new metrics data for the selected time range
3. WHEN a time range button is clicked THEN the system SHALL highlight the selected button to indicate the active time range
4. WHEN new metrics data is loaded for a different time range THEN the system SHALL update the chart to display data for the new time range
5. WHEN switching between time ranges THEN the system SHALL maintain the refresh functionality for each time range

### Requirement 3

**User Story:** As a developer maintaining the codebase, I want clear separation between time range changes and manual refreshes, so that the code is maintainable and the behavior is predictable.

#### Acceptance Criteria

1. WHEN the `onChangeTimeRange` callback is invoked THEN the system SHALL update the time range state and trigger a data fetch
2. WHEN the `onRefreshMetrics` callback is invoked THEN the system SHALL trigger a data fetch without changing the time range
3. WHEN the metrics hook receives a refresh request THEN the system SHALL fetch data using the current time range parameter
4. WHEN implementing the callbacks THEN the system SHALL ensure that both time range changes and manual refreshes result in new data being fetched
5. WHEN the component re-renders THEN the system SHALL not cause unnecessary data fetches due to callback reference changes
