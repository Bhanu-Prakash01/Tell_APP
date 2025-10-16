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

Obtain authentication token for employee operations:

```bash
curl -X POST http://localhost:3000/api/v1/employee/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@example.com",
    "password": "password123"
  }'
```

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
        "assignedTo": "John Doe",
        "assignedDate": "2024-01-15T08:00:00.000Z"
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

### 3. Update Lead Status (Employee Only)
**Endpoint:** `PUT /api/v1/employee/leads/update/{id}`

```bash
curl -X PUT http://localhost:3000/api/v1/employee/leads/update/507f1f77bcf86cd799439013 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN" \
  -d '{
    "status": "Interested",
    "notes": "Customer showed interest in our premium plan"
  }'
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
    "status": "Interested",
    "notes": "Customer showed strong interest in premium package",
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
    "notes": "Customer showed strong interest in premium package",
    "assignedTo": "Jane Smith",
    "updatedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

**Allowed Update Fields:**
- `status`: "New", "Interested", "Not Interested", "Hot"
- `notes`: Text up to 1000 characters
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

### 3. Get Employee Assignments (Admin)
**Endpoint:** `GET /api/v1/admin/lead-assignments`

```bash
curl -X GET "http://localhost:3000/api/v1/admin/lead-assignments?employee=John&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
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