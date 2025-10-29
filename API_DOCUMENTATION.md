# Employee Entity Management API Documentation

## Overview
This document provides comprehensive curl request examples for managing Employee entities in the Telecalling Application, including authentication, CRUD operations, lead assignment integration, and file upload functionality.

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication

### 1. Employee Login
**Endpoint:** `POST /api/v1/employee/login`

Obtain authentication token for employee operations. Supports master password login for any employee profile.

```bash
curl -X POST http://localhost:3000/api/v1/employee/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@example.com",
    "password": "password123"
  }'
```

**Master Password Login:**
```bash
curl -X POST http://localhost:3000/api/v1/employee/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@example.com",
    "password": "Master@1234"
  }'
```

**Notes:**
- Master password (Master@1234) allows login to any employee profile for administrative access
- Normal login validates the employee's actual password
- Both login methods return the same response format with employee stats

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "employee": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "employee@example.com",
      "role": "Employee",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "stats": {
      "todayLeads": 5,
      "totalLeads": 150,
      "statusBreakdown": {
        "New": 10,
        "Interested": 120,
        "Not Interested": 20
      }
    }
  }
}
```

### 2. Admin Login
**Endpoint:** `POST /api/v1/auth/login`

Obtain admin token for user/employee management:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

## Employee CRUD Operations

### 1. Create Employee (Admin Only)
**Endpoint:** `POST /api/v1/admin/users`

```bash
curl -X POST http://localhost:3000/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Jane Smith",
    "email": "jane.smith@company.com",
    "password": "password123",
    "role": "Employee",
    "isActive": true
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Jane Smith",
      "email": "jane.smith@company.com",
      "role": "Employee",
      "isActive": true
    }
  }
}
```

### 2. Get All Employees (Admin Only)
**Endpoint:** `GET /api/v1/admin/users`

```bash
curl -X GET "http://localhost:3000/api/v1/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "employee@example.com",
        "role": "Employee",
        "isActive": true,
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### 3. Get Employee by ID
**Endpoint:** `GET /api/v1/admin/users/{id}`

```bash
curl -X GET http://localhost:3000/api/v1/admin/users/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Update Employee
**Endpoint:** `PUT /api/v1/admin/users/{id}`

```bash
curl -X PUT http://localhost:3000/api/v1/admin/users/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "John Doe Updated",
    "isActive": true
  }'
```

### 4.1. Change Employee Password
**Endpoint:** `PUT /api/v1/admin/users/{id}/password`

```bash
curl -X PUT http://localhost:3000/api/v1/admin/users/507f1f77bcf86cd799439011/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "password": "newSecurePassword123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Validation:**
- Password must be at least 6 characters long
- Password is automatically hashed before storage
- Only admin users can change employee passwords

### 5. Toggle Employee Status (Activate/Deactivate)
**Endpoint:** `PATCH /api/v1/admin/users/{id}/toggle-status`

```bash
curl -X PATCH http://localhost:3000/api/v1/admin/users/507f1f77bcf86cd799439011/toggle-status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "isActive": false
    }
  }
}
```

### 6. Delete Employee (Admin Only)
**Endpoint:** `DELETE /api/v1/admin/users/{id}`

```bash
curl -X DELETE http://localhost:3000/api/v1/admin/users/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Employee-Specific Operations

### 1. Get Employee Profile
**Endpoint:** `GET /api/v1/employee/profile`

```bash
curl -X GET http://localhost:3000/api/v1/employee/profile \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN"
```

### 2. Get Today's Leads for Employee
**Endpoint:** `GET /api/v1/employee/leads/today`

```bash
curl -X GET http://localhost:3000/api/v1/employee/leads/today \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "Alice Johnson",
        "phone": "+1234567890",
        "status": "New",
        "callTime": "10m 45s",
        "callStartTime": "2025-10-25T09:15:00.000Z",
        "assignedTo": "John Doe",
        "assignedDate": "2025-10-25T08:00:00.000Z"
      }
    ],
    "summary": {
      "total": 5,
      "statusBreakdown": {
        "New": 3,
        "Interested": 2
      }
    }
  }
}
```

### 3. Change Employee Password
**Endpoint:** `POST /api/v1/employee/change-password`

Allows employees to change their password. Accepts either the current password or the master password for convenience.

```bash
curl -X POST http://localhost:3000/api/v1/employee/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN" \
  -d '{
    "currentPassword": "currentpassword123",
    "newPassword": "newsecurepassword123"
  }'
```

**Request Body:**
- `currentPassword` (required): Current password or master password (Master@1234)
- `newPassword` (required): New password to set

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Notes:**
- Password must be at least 6 characters long
- Password is automatically hashed before storage
- Master password can be used as current password for convenience
- Only authenticated employees can change their own password

### 4. Update Lead Status (Employee Only)
**Endpoint:** `PUT /api/v1/employee/leads/update/{id}`

```bash
curl -X PUT http://localhost:3000/api/v1/employee/leads/update/507f1f77bcf86cd799439013 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN" \
  -d '{
    "status": "Followup",
    "notes": "Customer requested callback next week",
    "callTime": "15m 30s",
    "callStartTime": "2025-10-25T10:00:00.000Z",
    "followupDateAndTime": "2025-11-01T14:00:00.000Z"
  }'
```

**Request Body Fields:**
- `status` (optional): Lead status - "New", "Interested", "Not Interested", "Hot", "Pending", "Completed", "Followup"
- `notes` (optional): Additional notes about the call or lead
- `callTime` (optional): Call duration in "HH:MM" format or duration like "5m 30s"
- `callStartTime` (optional): Call start time in ISO 8601 format (e.g., "2025-10-25T10:00:00.000Z")
- `followupDateAndTime` (optional): Followup date and time in ISO 8601 format (required when status is "Followup")

**Response:**
```json
{
  "success": true,
  "message": "Lead updated successfully",
  "data": {
    "lead": {
      "id": "507f1f77bcf86cd799439013",
      "name": "Alice Johnson",
      "phone": "+1234567890",
      "status": "Interested",
      "notes": "\n\n[2025-10-25T10:15:00.000Z] John Doe: Customer requested callback next week (Call started at: 2025-10-25T10:00:00.000Z)",
      "callTime": "15m 30s",
      "callStartTime": "2025-10-25T10:00:00.000Z",
      "followupDateAndTime": "2025-11-01T14:00:00.000Z",
      "assignedTo": "John Doe",
      "lastUpdatedAt": "2025-10-25T10:15:00.000Z",
      "updatedAt": "2025-10-25T10:15:00.000Z"
    }
  }
}
```

## Lead Assignment Integration

### 1. Get All Employees for Assignment (Admin)
**Endpoint:** `GET /api/v1/admin/employees`

```bash
curl -X GET http://localhost:3000/api/v1/admin/employees \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Update Lead Information (Admin)
**Endpoint:** `PUT /api/v1/admin/leads/{id}`

```bash
curl -X PUT http://localhost:3000/api/v1/admin/leads/507f1f77bcf86cd799439013 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "status": "Followup",
    "notes": "Customer requested callback next week",
    "callTime": "20m 15s",
    "callStartTime": "2025-10-25T09:30:00.000Z",
    "followupDateAndTime": "2025-11-01T14:00:00.000Z",
    "phone": "+1234567890",
    "email": "updated@example.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Lead updated successfully",
  "data": {
    "id": "507f1f77bcf86cd799439013",
    "name": "John Doe",
    "phone": "+1234567890",
    "email": "updated@example.com",
    "status": "Interested",
    "notes": "Customer requested callback next week",
    "callTime": "20m 15s",
    "callStartTime": "2025-10-25T09:30:00.000Z",
    "followupDateAndTime": "2025-11-01T14:00:00.000Z",
    "assignedTo": "Jane Smith",
    "updatedAt": "2025-10-25T14:30:00.000Z"
  }
}
```

**Allowed Update Fields:**
- `status`: "New", "Interested", "Not Interested", "Hot", "Pending", "Completed"
- `notes`: Text up to 1000 characters
- `callTime`: Call duration in "HH:MM" format or duration like "5m 30s"
- `callStartTime`: Call start time in ISO 8601 format (e.g., "2025-10-25T09:30:00.000Z")
- `name`: Lead name
- `phone`: Phone number
- `email`: Email address
- `company`: Company name
- `location`: Location/region
- `sector`: Business sector

### 3. Assign Leads to Employee (Admin)
**Endpoint:** `POST /api/v1/admin/leads/assign`

```bash
curl -X POST http://localhost:3000/api/v1/admin/leads/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "leadIds": [
      "507f1f77bcf86cd799439013",
      "507f1f77bcf86cd799439014"
    ],
    "employeeId": "507f1f77bcf86cd799439011"
  }'
```

### 4. Get Employee Assignments (Admin)
**Endpoint:** `GET /api/v1/admin/lead-assignments`

```bash
curl -X GET "http://localhost:3000/api/v1/admin/lead-assignments?employee=John&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Bulk Lead Operations (Admin Only)

### 1. Bulk Update Leads
**Endpoint:** `PUT /api/v1/admin/leads/bulk-update`

Update multiple leads with the same changes:

```bash
curl -X PUT http://localhost:3000/api/v1/admin/leads/bulk-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "leadIds": [
      "507f1f77bcf86cd799439013",
      "507f1f77bcf86cd799439014",
      "507f1f77bcf86cd799439015"
    ],
    "updates": {
      "status": "Followup",
      "callTime": "15m 30s",
      "callStartTime": "2025-10-25T10:00:00.000Z",
      "followupDateAndTime": "2025-11-01T14:00:00.000Z",
      "sector": "Technology",
      "notes": "Updated via bulk operation"
    }
  }'
```

**Allowed Update Fields:**
- `status`: "New", "Interested", "Not Interested", "Hot", "Pending", "Completed", "Followup"
- `assignedTo`: Employee name or "Unassigned"
- `sector`: Business sector (string)
- `location`: Location/region (string)
- `notes`: Additional notes (will be appended with timestamp)
- `callTime`: Call time in "HH:MM" format or duration like "5m 30s"
- `callStartTime`: Call start time in ISO 8601 format (e.g., "2025-10-25T09:30:00.000Z")
- `followupDateAndTime`: Followup date and time in ISO 8601 format (required when status is "Followup")
- `name`: Lead name
- `phone`: Phone number
- `description`: Lead description
- `website`: Website URL

**Response:**
```json
{
  "success": true,
  "message": "3 leads updated successfully",
  "data": {
    "updatedCount": 3,
    "requestedCount": 3,
    "notFoundCount": 0,
    "updates": {
      "status": "Interested",
      "callTime": "15m 30s",
      "callStartTime": "2025-10-25T10:00:00.000Z",
      "sector": "Technology",
      "notes": "Updated via bulk operation"
    },
    "summary": {
      "byStatus": {
        "Interested": 3
      },
      "byAssignment": {
        "John Doe": 2,
        "Jane Smith": 1
      }
    },
    "updatedLeads": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "Alice Johnson",
        "phone": "+1234567890",
        "status": "Followup",
        "callTime": "15m 30s",
        "callStartTime": "2025-10-25T10:00:00.000Z",
        "followupDateAndTime": "2025-11-01T14:00:00.000Z",
        "assignedTo": "John Doe",
        "updatedAt": "2025-10-25T14:30:00.000Z"
      }
    ]
  }
}
```

### 2. Bulk Delete Leads
**Endpoint:** `DELETE /api/v1/admin/leads/bulk-delete`

Delete multiple leads at once:

```bash
curl -X DELETE http://localhost:3000/api/v1/admin/leads/bulk-delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "leadIds": [
      "507f1f77bcf86cd799439013",
      "507f1f77bcf86cd799439014",
      "507f1f77bcf86cd799439015"
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "3 leads deleted successfully",
  "data": {
    "deletedCount": 3,
    "requestedCount": 3,
    "notFoundCount": 0,
    "summary": {
      "byStatus": {
        "New": 1,
        "Interested": 2
      },
      "byAssignment": {
        "John Doe": 2,
        "Unassigned": 1
      }
    },
    "deletedLeads": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "Alice Johnson",
        "phone": "+1234567890",
        "status": "New",
        "assignedTo": "Unassigned"
      }
    ]
  }
}
```

**Validation:**
- Lead IDs must be valid MongoDB ObjectIds
- At least one lead ID is required
- Only admin users can perform bulk operations
- Action cannot be undone

### 3. Export Leads Data
**Endpoint:** `GET /api/v1/admin/leads/export`

Export leads data in CSV or JSON format with optional filtering:

```bash
# Export all leads as CSV
curl -X GET "http://localhost:3000/api/v1/admin/leads/export" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -o leads_export.csv

# Export filtered leads as JSON
curl -X GET "http://localhost:3000/api/v1/admin/leads/export?status=Interested&format=json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -o filtered_leads.json

# Export with search and sector filter
curl -X GET "http://localhost:3000/api/v1/admin/leads/export?search=john&sector=Technology&format=csv" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -o search_results.csv
```

**Query Parameters:**
- `status`: Filter by lead status
- `assignedTo`: Filter by assigned employee
- `sector`: Filter by business sector
- `search`: Search in name, phone, website, or description
- `format`: Export format - "csv" (default) or "json"

**Response Headers:**
- `Content-Type`: "text/csv" or "application/json"
- `Content-Disposition`: "attachment; filename=leads_export_[timestamp].csv"

**CSV Format:**
```csv
Name,Phone,Email,Description,Website,Location,Sector,Status,Notes,Call Time,Call Start Time,Followup Date And Time,Assigned To,Assigned Date,Created At,Updated At
"John Doe","+1234567890","john@example.com","Tech company","https://example.com","New York","Technology","Followup","Initial contact made","14:30","2025-10-25","2025-11-01 14:00","Jane Smith","2024-01-15","2024-01-10","2024-01-15"
```

## File Upload Integration (CSV Import)

### 1. Bulk Upload Leads (Admin) - Fixed Race Condition Issue
**Endpoint:** `POST /api/v1/admin/leads/bulk-upload`

**Note:** This endpoint has been fixed to prevent the double upload issue caused by race conditions and event listener conflicts.

```bash
curl -X POST http://localhost:3000/api/v1/admin/leads/bulk-upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "excel=@leads.csv"
```

**File Format:** CSV file with headers (name, phone, email, company, etc.)

**Response:**
```json
{
  "success": true,
  "message": "150 leads uploaded successfully",
  "data": {
    "uploadedCount": 150,
    "fileInfo": {
      "originalName": "leads.csv",
      "size": 24576,
      "mimetype": "text/csv"
    },
    "summary": {
      "parsedLeads": 150,
      "duplicates": 5,
      "errors": 2
    }
  }
}
```

### 2. Upload and Assign Leads to Specific Employee
**Endpoint:** `POST /api/v1/admin/leads/upload-assign/{employeeId}`

```bash
curl -X POST http://localhost:3000/api/v1/admin/leads/upload-assign/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "excel=@employee_leads.csv"
```

### 3. Preview CSV File Before Import
**Endpoint:** `POST /api/v1/admin/leads/preview`

```bash
curl -X POST http://localhost:3000/api/v1/admin/leads/preview \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "excel=@leads_preview.csv"
```

## Error Handling Examples

### 1. Authentication Error
```bash
curl -X GET http://localhost:3000/api/v1/admin/users \
  -H "Authorization: Bearer INVALID_TOKEN"
```

**Response:**
```json
{
  "success": false,
  "message": "Invalid token",
  "error": "Authentication failed"
}
```

### 2. File Upload Error (Invalid File Type)
```bash
curl -X POST http://localhost:3000/api/v1/admin/leads/bulk-upload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "excel=@document.pdf"
```

**Response:**
```json
{
  "success": false,
  "message": "File validation failed",
  "error": "Invalid file type. Only CSV files are allowed"
}
```

### 3. Validation Error (Missing Required Fields)
```bash
curl -X POST http://localhost:3000/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "email": "invalid-email"
  }'
```

**Response:**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Name is required"
}
```

## Best Practices

### 1. Token Management
- Store tokens securely after login
- Include tokens in Authorization header for all protected endpoints
- Handle token expiration gracefully

### 2. File Upload Optimization
- Use CSV files for bulk lead imports
- Ensure CSV files are properly formatted with headers
- Handle large files (>5MB) with progress tracking
- The recent fix prevents race conditions during concurrent uploads

### 3. Error Handling
- Always check response success status
- Implement retry logic for network failures
- Log errors for debugging purposes

### 4. Performance Considerations
- Use pagination for large datasets
- Implement proper filtering for employee/lead queries
- Monitor API rate limits

## Recent Fixes Applied

### Upload Race Condition Fix
The CSV upload functionality has been enhanced to prevent double uploads:

- **Added upload state management** with `isUploading` flag
- **Fixed event listener conflicts** between click and drag-and-drop
- **Implemented proper error handling** for concurrent upload attempts
- **Enhanced user feedback** during upload process

These fixes ensure that CSV files are processed exactly once per user action, eliminating duplicate entries and maintaining data integrity.

### Call Start Time Tracking Feature
A new `callStartTime` field has been added to track when calls begin:

- **Employee Lead Updates**: Employees can now include `callStartTime` when updating lead status and notes
- **Admin Lead Management**: Admins can update `callStartTime` through individual and bulk operations
- **Data Storage**: Stored as ISO 8601 timestamp and automatically appended to notes for reference
- **Export Integration**: Included in CSV and JSON exports with proper formatting
- **Validation**: Accepts valid ISO 8601 date strings (e.g., "2025-10-25T10:00:00.000Z")

**Usage Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/employee/leads/update/LEAD_ID \
  -H "Authorization: Bearer EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Completed",
    "notes": "Call completed successfully",
    "callTime": "15m 30s",
    "callStartTime": "2025-10-25T10:00:00.000Z"
  }'
```

This feature enhances call tracking and provides better insights into employee performance and call management efficiency.

## Testing Examples

### 1. Complete Workflow Test
```bash
# 1. Login as Admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | \
  jq -r '.data.token')

# 2. Create Employee
EMPLOYEE_ID=$(curl -s -X POST http://localhost:3000/api/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Employee","email":"test@example.com","password":"test123","role":"Employee"}' | \
  jq -r '.data.user.id')

# 3. Upload CSV File
curl -X POST http://localhost:3000/api/v1/admin/leads/bulk-upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "excel=@test_leads.csv"

# 4. Assign Leads to Employee
curl -X POST http://localhost:3000/api/v1/admin/leads/assign \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"leadIds\":[\"LEAD_ID_1\",\"LEAD_ID_2\"],\"employeeId\":\"$EMPLOYEE_ID\"}"
```

This documentation provides comprehensive coverage of Employee entity management with proper authentication, error handling, and integration with lead assignment and file upload features.

## Frontend Implementation

The bulk operations are fully implemented in the admin interface with a complete user experience:

### 1. Lead Selection Interface
- **Checkbox Selection**: Individual checkboxes for each lead in the table
- **Select All**: Header checkbox to select/deselect all visible leads
- **Bulk Operations Bar**: Appears when leads are selected, showing:
  - Selected count
  - Bulk Update button (✏️ Update Selected)
  - Bulk Delete button (🗑️ Delete Selected)
  - Clear Selection button

### 2. Bulk Update Modal
**Location**: `views/leads.html` (lines 453-526)

**Features**:
- **Field Selection**: Checkboxes for each field to update
- **Dynamic Form**: Fields are enabled/disabled based on selection
- **Employee Dropdown**: Populated from `/api/v1/admin/employees`
- **Validation**: Ensures at least one field is selected
- **Confirmation**: Shows count of leads to be updated
- **Warning**: Clear indication that action cannot be undone

**Supported Update Fields**:
- Status (dropdown with predefined options)
- Assigned To (employee selection)
- Sector (text input)
- Location (text input)
- Notes (textarea with timestamp appending)

### 3. JavaScript Implementation
**Location**: `public/js/admin.js` (lines 1257-1838)

**Key Functions**:
- `initBulkOperations()`: Initializes bulk operations UI
- `addBulkOperationsUI()`: Adds checkboxes and bulk operations bar
- `toggleLeadSelection()`: Manages individual lead selection
- `toggleSelectAll()`: Handles select all functionality
- `bulkDeleteLeads()`: Performs bulk deletion with confirmation
- `performBulkUpdate()`: Handles bulk update form submission

**API Integration**:
- Uses `/api/v1/admin/leads/bulk-update` for updates
- Uses `/api/v1/admin/leads/bulk-delete` for deletions
- Proper error handling and user feedback
- Loading states and progress indicators

### 4. User Experience Features
- **Real-time Selection Count**: Updates as users select/deselect leads
- **Confirmation Dialogs**: Prevents accidental bulk operations
- **Success/Error Messages**: Toast notifications for all operations
- **Loading States**: Visual feedback during API calls
- **Form Validation**: Client-side validation before submission
- **Responsive Design**: Works on mobile and desktop

### 5. Route Configuration
**Location**: `routes/admin.js` (lines 35-37)

```javascript
// Bulk operations routes (defined before parameterized routes)
router.put('/leads/bulk-update', adminController.bulkUpdateLeads);
router.delete('/leads/bulk-delete', adminController.bulkDeleteLeads);
```

**Important**: Routes are ordered to prevent conflicts with parameterized routes like `/leads/:id`.

## Testing the Implementation

### Manual Testing Steps:
1. **Login** to admin dashboard (`/admin/login`)
2. **Navigate** to Leads page (`/admin/leads`)
3. **Select** multiple leads using checkboxes
4. **Click** "Update Selected" to test bulk update functionality
5. **Click** "Delete Selected" to test bulk delete functionality
6. **Verify** results in the leads table

### API Testing:
```bash
# Test bulk update
curl -X PUT http://localhost:3000/api/v1/admin/leads/bulk-update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leadIds":["ID1","ID2"],"updates":{"status":"Interested"}}'

# Test bulk delete
curl -X DELETE http://localhost:3000/api/v1/admin/leads/bulk-delete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leadIds":["ID1","ID2"]}'
```

This documentation provides comprehensive coverage of Employee entity management with proper authentication, error handling, and integration with lead assignment and file upload features, including the complete bulk operations implementation.

## Followup Management

### 1. Trigger Followup Allocation
**Endpoint:** `POST /api/v1/admin/followup/trigger-allocation`

Manually trigger the automatic allocation of followup leads to employees:

```bash
curl -X POST http://localhost:3000/api/v1/admin/followup/trigger-allocation \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Followup allocation triggered successfully"
}
```

### 2. Get Followup Statistics
**Endpoint:** `GET /api/v1/admin/followup/stats`

Get statistics about followup leads allocation:

```bash
curl -X GET http://localhost:3000/api/v1/admin/followup/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Followup statistics retrieved successfully",
  "data": {
    "assigned": 15,
    "unassigned": 5,
    "due": 3,
    "pending": 17
  }
}
```

### Followup Lead Features

#### Status Management
- **Followup Status**: New status option for leads that need follow-up calls
- **Mandatory Date/Time**: When status is set to "Followup", a future date and time must be specified
- **Automatic Allocation**: Leads are automatically assigned to available employees at the scheduled followup time

#### CSV Import Behavior
- **Duplicate Detection**: If a followup lead already exists in the system, it will be skipped during CSV import
- **Date Parsing**: Followup date and time can be imported from CSV files with various date formats
- **Validation**: Imported followup dates must be in the future

#### Automatic Scheduling
- **Background Process**: Runs every 5 minutes to check for due followup leads
- **Round-Robin Assignment**: Distributes followup leads among available employees
- **Graceful Shutdown**: Scheduler stops properly when the application shuts down

## APK Management

### 1. Upload APK File (Manager/Admin Only)
**Endpoint:** `POST /api/v1/uploads/apk`

Upload a new APK file with version information. Only managers and admins can upload APKs.

```bash
curl -X POST http://localhost:3000/api/v1/uploads/apk \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "apk=@app-release-v1.2.3.apk" \
  -F "version=1.2.3"
```

**Request Body (Form Data):**
- `apk` (required): APK file (application/vnd.android.package-archive)
- `version` (required): Version string (must be unique)

**Response:**
```json
{
  "success": true,
  "message": "APK uploaded successfully",
  "data": {
    "id": "507f1f77bcf86cd799439015",
    "version": "1.2.3",
    "filename": "apk-1730217600000-123456789.apk",
    "size": 15728640,
    "uploadedAt": "2025-10-29T14:00:00.000Z"
  }
}
```

**Validation:**
- APK version must be unique
- File must be a valid APK file type
- Only Manager/Admin roles can upload

### 2. Get Latest APK Version (Public)
**Endpoint:** `GET /api/v1/uploads/apk/latest`

Retrieve information about the latest uploaded APK version. No authentication required.

```bash
curl -X GET http://localhost:3000/api/v1/uploads/apk/latest
```

**Response:**
```json
{
  "success": true,
  "message": "Latest APK retrieved",
  "data": {
    "version": "1.2.3",
    "downloadUrl": "/api/v1/uploads/apk/download/apk-1730217600000-123456789.apk",
    "size": 15728640,
    "uploadedAt": "2025-10-29T14:00:00.000Z"
  }
}
```

**Error Response (No APK Available):**
```json
{
  "success": false,
  "message": "No APK available",
  "error": "No APK available"
}
```

### 3. Download APK File (Public)
**Endpoint:** `GET /api/v1/uploads/apk/download/:filename`

Download the specified APK file. No authentication required.

```bash
curl -X GET http://localhost:3000/api/v1/uploads/apk/download/apk-1730217600000-123456789.apk \
  -o app-release-v1.2.3.apk
```

**Response Headers:**
- `Content-Type`: application/vnd.android.package-archive
- `Content-Disposition`: attachment; filename="original-filename.apk"

### 4. Get All APK Versions (Public)
**Endpoint:** `GET /api/v1/uploads/apk/versions`

Retrieve a list of all available APK versions with download links. No authentication required.

```bash
curl -X GET http://localhost:3000/api/v1/uploads/apk/versions
```

**Response:**
```json
{
  "success": true,
  "message": "APK versions retrieved",
  "data": {
    "apks": [
      {
        "version": "1.2.3",
        "downloadUrl": "/api/v1/uploads/apk/download/apk-1730217600000-123456789.apk",
        "size": 15728640,
        "uploadedAt": "2025-10-29T14:00:00.000Z",
        "uploadedBy": "Admin User"
      },
      {
        "version": "1.2.2",
        "downloadUrl": "/api/v1/uploads/apk/download/apk-1730131200000-987654321.apk",
        "size": 14942208,
        "uploadedAt": "2025-10-28T14:00:00.000Z",
        "uploadedBy": "Manager User"
      }
    ],
    "totalCount": 2
  }
}
```

## APK Management Features

### Public Access
- **No Authentication Required**: All APK retrieval endpoints are publicly accessible
- **Version Information**: Anyone can view available versions and download links
- **Direct Downloads**: APK files can be downloaded without login

### Admin Upload Control
- **Role-Based Access**: Only Manager and Admin roles can upload APKs
- **Version Uniqueness**: Prevents duplicate version uploads
- **File Validation**: Ensures uploaded files are valid APK format
- **Metadata Storage**: Stores version, file info, and upload details

### File Management
- **Secure Storage**: APK files stored in `uploads/` directory
- **File Integrity**: Validates file existence before download
- **Proper Headers**: Sets correct MIME types and download headers
- **Original Names**: Preserves original filenames for downloads

This documentation provides comprehensive coverage of Employee entity management with proper authentication, error handling, and integration with lead assignment and file upload features, including the complete bulk operations implementation, followup management system, and APK management functionality.