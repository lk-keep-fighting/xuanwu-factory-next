# Tab Visibility Logic Implementation

## Overview

This document describes the implementation of task 14: "Implement tab visibility logic" for the service detail tab reorganization feature.

## Implementation Summary

### Files Created/Modified

1. **Created: `src/lib/service-tab-config.ts`**
   - Central configuration for all service detail page tabs
   - Defines tab visibility rules based on service type
   - Provides utility functions for tab filtering and validation

2. **Modified: `src/app/projects/[id]/services/[serviceId]/page.tsx`**
   - Updated to use dynamic tab rendering based on `getVisibleTabs()`
   - Replaced hardcoded TabsList with configuration-driven approach
   - Added import for `getVisibleTabs` from service-tab-config

3. **Created: `src/lib/__validation__/service-tab-config.validation.ts`**
   - Validation script to verify tab visibility logic
   - Tests all service types show exactly 6 common tabs
   - Validates tab configuration structure

## Key Features

### Tab Configuration System

The `TAB_CONFIGS` array defines all available tabs with:
- `value`: Unique tab identifier (from TAB_VALUES)
- `label`: Display label for the tab
- `icon`: Lucide React icon component
- `visible`: Function that determines if tab should be shown for a service

### Common Tabs for All Service Types

All service types (Application, Database, Image) show the same 6 tabs:

1. **Overview** - Service status, resource metrics, recent events, deployment status
2. **Configuration** - General settings, environment variables, volumes, network, resources
3. **Deployments** - Deployment history, build history, image management
4. **Logs** - Real-time log viewing with refresh controls
5. **Files** - File browser and manager
6. **YAML** - Kubernetes YAML configuration viewer

### Utility Functions

- `getVisibleTabs(service)` - Returns array of tab configs that should be visible
- `isTabVisible(tabValue, service)` - Checks if a specific tab should be visible
- `getVisibleTabValues(service)` - Returns array of tab values that should be visible
- `validateCommonTabsForAllTypes()` - Validates all service types show 6 tabs
- `getTabConfig(tabValue)` - Gets configuration for a specific tab
- `getTabLabel(tabValue)` - Gets display label for a tab
- `getTabIcon(tabValue)` - Gets icon component for a tab

## Requirements Validation

### Requirement 6.4: Common tabs for all service types
✅ **VALIDATED**: All service types (Application, Database, Image) show exactly 6 common tabs:
- Overview
- Configuration
- Deployments
- Logs
- Files
- YAML

### Requirement 6.1: Application service specific features
✅ **IMPLEMENTED**: Application services show Git configuration, build controls, and image version management within the Configuration and Deployments tabs (not as separate tabs)

### Requirement 6.2: Database service specific features
✅ **IMPLEMENTED**: Database services show database-specific configuration within the Configuration tab (not as separate tabs)

### Requirement 6.3: Image service specific features
✅ **IMPLEMENTED**: Image services show image selection and tag configuration within the Configuration tab (not as separate tabs)

### Requirement 6.5: Service renaming
✅ **IMPLEMENTED**: Services that have not been deployed can be renamed (handled in the main page component)

## Validation Results

All validations passed successfully:

```
============================================================
VALIDATION RESULTS
============================================================
Tab Configuration: ✅ PASS
Common Tabs: ✅ PASS
Tab Visibility: ✅ PASS
Built-in Validation: ✅ PASS

============================================================
OVERALL: ✅ ALL VALIDATIONS PASSED
============================================================
```

### Validation Details

1. **Tab Configuration Structure**: Verified all 6 tabs have required properties (value, label, icon, visible function)
2. **Common Tabs**: Confirmed all service types show exactly 6 tabs
3. **Tab Visibility**: Validated visibility function works correctly for all service types
4. **Built-in Validation**: Confirmed the built-in validation function works correctly

## Design Decisions

### Why All Tabs Are Always Visible

The design specifies that all service types should show the same 6 common tabs. This decision:
- Reduces cognitive load by providing consistent navigation
- Simplifies the codebase by eliminating complex conditional logic
- Allows service-type specific features to be shown within tabs (e.g., Git config in Configuration tab for Application services)
- Follows the principle of "show, don't hide" - all functionality is accessible

### Service-Type Specific Content

Rather than showing/hiding entire tabs, service-type specific content is shown within the tabs:
- **Configuration Tab**: Shows different sections based on service type (Git config for Application, database config for Database, etc.)
- **Deployments Tab**: Shows build history and image management only for Application services
- **Other Tabs**: Show the same content for all service types

This approach provides:
- Consistent navigation experience
- Clear separation of concerns
- Easier maintenance and testing

## Future Enhancements

The tab configuration system is designed to be extensible:

1. **Conditional Tab Visibility**: The `visible` function can be enhanced to hide tabs based on service properties
2. **Dynamic Tab Loading**: The `loadOnActivate` property (defined in TabConfig type) can be used for lazy loading
3. **Custom Tab Order**: Tab order can be made configurable per user or service type
4. **Additional Tabs**: New tabs can be easily added to TAB_CONFIGS array

## Testing

### Manual Testing Checklist

- [x] Application service shows all 6 tabs
- [x] Database service shows all 6 tabs
- [x] Image service shows all 6 tabs
- [x] Tab navigation works correctly
- [x] Tab icons render correctly
- [x] Tab labels are displayed correctly
- [x] No TypeScript errors
- [x] Validation script passes

### Automated Validation

Run the validation script:
```bash
npx tsx src/lib/__validation__/service-tab-config.validation.ts
```

## Conclusion

The tab visibility logic has been successfully implemented according to the requirements. All service types now show the same 6 common tabs, providing a consistent and intuitive user experience. The implementation is validated, tested, and ready for use.
