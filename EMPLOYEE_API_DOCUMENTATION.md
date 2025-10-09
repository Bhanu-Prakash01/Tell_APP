# Employee API Documentation

## Overview
This document provides comprehensive documentation for all employee-related APIs. These APIs implement lead separation logic where employees can only view leads they haven't approached yet, preventing confusion and overlap.

## Authentication
All endpoints require:
- **Authentication**: Bearer token in Authorization header
- **Role**: Employee role (enforced by middleware)

## Base URL
```
/api/employee
```

---

## 1. Employee Profile

### Get Employee Profile
**Endpoint:** `GET /profile`

**Description:** Get the logged-in employee's profile information.

**Response:**
```json
{
  "_id": "employee_id",
  "name": "John Doe",
  "email": "john.doe@company.com",
  "role": "employee",
  "manager": {
    "_id": "manager_id",
    "name": "Jane Smith",
    "email": "jane.smith@company.com"
  },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

## 2. Lead Management

### Get Unapproached Leads
**Endpoint:** `GET /leads`

**Description:** Get leads assigned to the employee that haven't been approached yet. A lead is considered approached if the employee has made a successful call (not missed) to that lead.

**Query Parameters:**
- `status` (optional): Filter by lead status (New, Interested, Hot, Follow-up, Won, Lost)
- `sector` (optional): Filter by sector
- `region` (optional): Filter by region
- `includeApproached` (optional): Include approached leads (default: false)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "leads": [
    {
      "_id": "lead_id",
      "name": "Lead Name",
      "phone": "9876543210",
      "email": "lead@example.com",
      "status": "New",
      "sector": "Technology",
      "region": "Maharashtra",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "createdBy": {
        "name": "Manager Name",
        "email": "manager@company.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3,
    "approachedCount": 25
  },
  "approachedLeads": [
    // Only included if includeApproached=true
  ]
}
```

### Get Specific Lead Details
**Endpoint:** `GET /leads/{leadId}`

**Description:** Get detailed information about a specific lead including approach status.

**Path Parameters:**
- `leadId` (required): The lead's unique identifier

**Response:**
```json
{
  "_id": "lead_id",
  "name": "Lead Name",
  "phone": "9876543210",
  "email": "lead@example.com",
  "status": "New",
  "notes": "Initial notes",
  "sector": "Technology",
  "region": "Maharashtra",
  "followUpDate": "2024-01-20T10:30:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "createdBy": {
    "name": "Manager Name",
    "email": "manager@company.com"
  },
  "assignedTo": {
    "name": "Employee Name",
    "email": "employee@company.com"
  },
  "isApproached": false,
  "approachHistory": []
}
```

### Search Leads
**Endpoint:** `GET /leads/search`

**Description:** Search unapproached leads by various criteria.

**Query Parameters:**
- `q` (optional): Search query (searches name, phone, email)
- `status` (optional): Filter by lead status
- `sector` (optional): Filter by sector
- `region` (optional): Filter by region
- `hasFollowUp` (optional): Filter leads with/without follow-up dates
- `includeApproached` (optional): Include approached leads (default: false)
- `limit` (optional): Maximum results (default: 50, max: 100)

**Response:**
```json
{
  "leads": [
    {
      "_id": "lead_id",
      "name": "Lead Name",
      "phone": "9876543210",
      "email": "lead@example.com",
      "status": "New",
      "sector": "Technology",
      "region": "Maharashtra"
    }
  ],
  "total": 25,
  "approachedCount": 10,
  "approachedLeads": [
    // Only included if includeApproached=true
  ]
}
```

### Update Lead
**Endpoint:** `PUT /update-lead`

**Description:** Update lead notes, status, and follow-up date.

**Request Body:**
```json
{
  "leadId": "lead_id",
  "note": "Additional notes to append",
  "status": "Interested",
  "followUpDate": "2024-01-20T10:30:00.000Z"
}
```

**Response:**
```json
{
  "message": "Lead updated",
  "lead": {
    "_id": "lead_id",
    "name": "Lead Name",
    "status": "Interested",
    "notes": "Initial notes\n\nAdditional notes to append",
    "followUpDate": "2024-01-20T10:30:00.000Z"
  }
}
```

---

## 3. Call Management

### Add Call Log
**Endpoint:** `POST /call-log`

**Description:** Add a new call log entry for a lead.

**Request Body:**
```json
{
  "leadId": "lead_id",
  "callStatus": "completed",
  "notes": "Customer was interested in the product",
  "callDuration": 300,
  "outcome": "Interested",
  "followUpRequired": true,
  "followUpDate": "2024-01-20T10:30:00.000Z"
}
```

**Response:**
```json
{
  "message": "Call log saved",
  "log": {
    "_id": "call_log_id",
    "lead": {
      "name": "Lead Name",
      "phone": "9876543210",
      "email": "lead@example.com",
      "status": "New"
    },
    "callStatus": "completed",
    "callDuration": 300,
    "outcome": "Interested",
    "notes": "Customer was interested in the product",
    "followUpRequired": true,
    "followUpDate": "2024-01-20T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get My Call Logs
**Endpoint:** `GET /my-call-logs`

**Description:** Get call logs for the logged-in employee.

**Query Parameters:**
- `leadId` (optional): Filter by specific lead
- `callStatus` (optional): Filter by call status
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter until date
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "logs": [
    {
      "_id": "call_log_id",
      "lead": {
        "name": "Lead Name",
        "phone": "9876543210",
        "email": "lead@example.com"
      },
      "callStatus": "completed",
      "callDuration": 300,
      "outcome": "Interested",
      "notes": "Customer was interested",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

### Get Today's Calls
**Endpoint:** `GET /todays-calls`

**Description:** Get all calls made by the employee on the current date with summary statistics. This endpoint provides a comprehensive view of the employee's daily calling activity.

**Response:**
```json
{
  "calls": [
    {
      "_id": "call_log_id",
      "lead": {
        "name": "Lead Name",
        "phone": "9876543210",
        "email": "lead@example.com",
        "status": "New",
        "sector": "Technology",
        "region": "Maharashtra"
      },
      "callStatus": "completed",
      "callDuration": 300,
      "outcome": "Interested",
      "notes": "Customer was interested in the product",
      "followUpRequired": true,
      "followUpDate": "2024-01-20T10:30:00.000Z",
      "recordingUrl": "https://cloudinary.com/recording_url",
      "callStartTime": "2024-01-15T10:30:00.000Z",
      "callEndTime": "2024-01-15T10:35:00.000Z",
      "createdAt": "2024-01-15T10:35:00.000Z"
    }
  ],
  "summary": {
    "totalCalls": 8,
    "completedCalls": 6,
    "totalDuration": 2400,
    "averageDuration": 300,
    "callsByStatus": {
      "completed": 6,
      "missed": 1,
      "busy": 1
    },
    "callsByOutcome": {
      "Interested": 4,
      "Not Interested": 2,
      "Follow-up Required": 2
    },
    "date": "2024-01-15"
  }
}
```

**Summary Statistics Include:**
- `totalCalls`: Total number of calls made today
- `completedCalls`: Number of successfully completed calls
- `totalDuration`: Sum of all call durations in seconds
- `averageDuration`: Average call duration in seconds
- `callsByStatus`: Calls grouped by their status (completed, missed, busy, etc.)
- `callsByOutcome`: Calls grouped by their outcome (Interested, Not Interested, etc.)
- `date`: Current date in YYYY-MM-DD format

### Get Today's Completed Calls
**Endpoint:** `GET /todays-completed-calls`

**Description:** Get only completed calls made by the employee on the current date with performance metrics. This endpoint focuses specifically on successful call completions and provides success rate analytics.

**Response:**
```json
{
  "calls": [
    {
      "_id": "call_log_id",
      "lead": {
        "name": "Lead Name",
        "phone": "9876543210",
        "email": "lead@example.com",
        "status": "New",
        "sector": "Technology",
        "region": "Maharashtra"
      },
      "callStatus": "completed",
      "callDuration": 300,
      "outcome": "Interested",
      "notes": "Customer was interested in the product",
      "followUpRequired": true,
      "followUpDate": "2024-01-20T10:30:00.000Z",
      "recordingUrl": "https://cloudinary.com/recording_url",
      "callStartTime": "2024-01-15T10:30:00.000Z",
      "callEndTime": "2024-01-15T10:35:00.000Z",
      "createdAt": "2024-01-15T10:35:00.000Z"
    }
  ],
  "summary": {
    "totalCompletedCalls": 6,
    "totalDuration": 2400,
    "averageDuration": 300,
    "callsByOutcome": {
      "Interested": 4,
      "Hot Lead": 1,
      "Converted": 1
    },
    "successfulCalls": 5,
    "successRate": 83,
    "date": "2024-01-15"
  }
}
```

**Summary Statistics Include:**
- `totalCompletedCalls`: Total number of completed calls today
- `totalDuration`: Sum of all completed call durations in seconds
- `averageDuration`: Average call duration in seconds for completed calls
- `callsByOutcome`: Completed calls grouped by outcome (Interested, Hot Lead, Converted, etc.)
- `successfulCalls`: Number of calls with positive outcomes (Interested, Hot Lead, Converted)
- `successRate`: Success rate percentage for completed calls
- `date`: Current date in YYYY-MM-DD format

### Upload Call Recording
**Endpoint:** `POST /upload-call-log`

**Description:** Upload an audio recording and link it to a lead.

**Content-Type:** `multipart/form-data`

**Request Body:**
- `recording` (required): Audio file (MP3, WAV, etc.)
- `leadId` (required): Lead ID to link the recording to

**Response:**
```json
{
  "message": "Call log uploaded successfully",
  "url": "https://cloudinary.com/recording_url"
}
```

### Get Lead Call Logs
**Endpoint:** `GET /lead/{leadId}/call-logs`

**Description:** Get all call logs for a specific lead (timeline view).

**Path Parameters:**
- `leadId` (required): The lead's unique identifier

**Response:**
```json
[
  {
    "_id": "call_log_id",
    "callStatus": "completed",
    "callDuration": 300,
    "outcome": "Interested",
    "notes": "Customer was interested in the product",
    "followUpRequired": true,
    "followUpDate": "2024-01-20T10:30:00.000Z",
    "recordingUrl": "https://cloudinary.com/recording_url",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

---

## 4. Dashboard & Performance

### Get Dashboard Summary
**Endpoint:** `GET /dashboard`

**Description:** Get comprehensive dashboard data including lead statistics and activity tracking.

**Response:**
```json
{
  "stats": {
    "totalLeads": 100,
    "unapproachedLeads": 75,
    "approachedLeads": 25,
    "newLeads": 30,
    "hotLeads": 15,
    "followUpLeads": 20,
    "overdueFollowUps": 5,
    "todaysTarget": 15
  },
  "recentActivity": [
    {
      "type": "lead_assigned",
      "description": "New lead: John Smith",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "leadName": "John Smith"
    },
    {
      "type": "call_logged",
      "description": "Call to Jane Doe: completed",
      "timestamp": "2024-01-15T09:15:00.000Z",
      "leadName": "Jane Doe"
    }
  ],
  "upcomingTasks": [
    {
      "leadId": "lead_id",
      "leadName": "Lead Name",
      "taskType": "Follow-up Call",
      "dueDate": "2024-01-20T10:30:00.000Z",
      "isApproached": false
    }
  ],
  "todaysProgress": {
    "callsMade": 8,
    "successfulCalls": 6,
    "avgCallDuration": 245
  }
}
```

### Get Performance Metrics
**Endpoint:** `GET /performance`

**Description:** Get employee performance metrics for a specific period.

**Query Parameters:**
- `period` (optional): Performance period (week, month, quarter, year) - default: month

**Response:**
```json
{
  "totalLeads": 50,
  "leadsByStatus": {
    "New": 10,
    "Interested": 15,
    "Hot": 10,
    "Won": 10,
    "Lost": 5
  },
  "totalCalls": 120,
  "callSuccessRate": 75,
  "averageCallDuration": 180,
  "conversionRate": 20,
  "monthlyGrowth": 8.5,
  "period": "month",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-15T10:30:00.000Z"
}
```

---

## 5. Mobile & Advanced Features

### Call Log with Recording
**Endpoint:** `POST /call-log-with-recording`

**Description:** Create a call log with audio recording support (web and mobile).

**Content-Type:** `multipart/form-data` (for web) or `application/json` (for mobile)

**Request Body (Web):**
- `recording` (required): Audio file
- `leadId` (required): Lead ID
- `callStatus` (required): Call status
- `notes` (optional): Call notes
- `callDuration` (optional): Call duration in seconds
- `outcome` (optional): Call outcome
- `followUpRequired` (optional): Whether follow-up is needed
- `followUpDate` (optional): Follow-up date

**Request Body (Mobile):**
```json
{
  "leadId": "lead_id",
  "callStatus": "completed",
  "audioData": "base64_encoded_audio_data",
  "audioFormat": "audio/mpeg",
  "callDuration": 300,
  "outcome": "Interested"
}
```

### Mobile Call Log
**Endpoint:** `POST /call-log-mobile`

**Description:** Mobile-optimized endpoint for call logging with base64 audio data.

**Request Body:**
```json
{
  "leadId": "lead_id",
  "callStatus": "completed",
  "audioData": "base64_encoded_audio_data",
  "audioFormat": "audio/mpeg",
  "callDuration": 300,
  "outcome": "Interested",
  "notes": "Mobile call log"
}
```

### Comprehensive Lead Management
**Endpoint:** `POST /lead-management`

**Description:** Perform multiple lead management operations in a single request.

**Request Body:**
```json
{
  "leadId": "lead_id",
  "action": "all",
  "status": "Interested",
  "notes": "Updated via management endpoint",
  "followUpDate": "2024-01-20T10:30:00.000Z",
  "callStatus": "completed",
  "callDuration": 300,
  "outcome": "Interested"
}
```

**Response:**
```json
{
  "message": "Lead management operations completed successfully",
  "leadId": "lead_id",
  "action": "all",
  "results": {
    "leadUpdate": {
      "message": "Lead updated successfully",
      "lead": { /* updated lead object */ }
    },
    "callLog": {
      "message": "Call log created successfully",
      "log": { /* call log object */ }
    }
  }
}
```

### Check File Duplicate
**Endpoint:** `POST /check-file-duplicate`

**Description:** Check if an audio file is duplicate before uploading.

**Content-Type:** `multipart/form-data`

**Request Body:**
- `recording` (required): Audio file to check

**Response:**
```json
{
  "isDuplicate": false,
  "fileHash": "sha256_hash",
  "message": "File is unique and can be uploaded"
}
```

---

## Lead Separation Logic

### How It Works
1. **Approach Detection**: A lead is considered "approached" when an employee makes a successful call (callStatus ≠ 'missed')
2. **Filtering**: By default, employees only see unapproached leads
3. **Override Option**: Use `includeApproached=true` to view approached leads when needed
4. **Real-time Updates**: Approach status updates automatically when call logs are created

### Key Benefits
- **Prevents Confusion**: Employees don't see leads they've already called
- **Improves Efficiency**: Focus on fresh leads first
- **Reduces Overlap**: Multiple employees won't approach the same lead
- **Maintains History**: Full approach history available when needed

---

## Error Responses

### Common Error Formats
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

### HTTP Status Codes
- `400`: Bad Request - Invalid parameters or validation errors
- `401`: Unauthorized - Missing or invalid authentication
- `403`: Forbidden - Access denied or lead not assigned to employee
- `404`: Not Found - Lead or resource doesn't exist
- `500`: Internal Server Error - Server-side error

---

## Best Practices

1. **Lead Separation**: Always use the default behavior (unapproached leads only)
2. **Pagination**: Use pagination for large result sets
3. **Error Handling**: Implement proper error handling for all endpoints
4. **File Uploads**: Check for duplicates before uploading audio files
5. **Mobile Support**: Use appropriate endpoints for mobile applications

---

*This documentation was generated for the Employee API with lead separation functionality.*