# Call Tracking System Documentation

## Overview
This document describes the comprehensive lead allocation and call tracking system that has been implemented with automatic call status management and role-based access control.

## System Architecture

### Core Components
1. **Lead Allocation Logic** - Automatic "Pending" status assignment
2. **Call Tracking APIs** - Daily statistics and team history
3. **Frappe UI Dashboard** - Admin/Manager interface for monitoring
4. **Employee APIs** - Lead fetching and call status updates

---

## 1. Lead Allocation Logic

### Automatic Call Status Assignment
When a lead is allocated to an employee, the system automatically sets the `callStatus` to "Pending".

**Implementation Details:**
- **Model**: `Lead.js` - Added `callStatus` field with enum values
- **Middleware**: Pre-save hook ensures "Pending" status on allocation
- **Allocation Points**:
  - Admin routes (`/api/admin/leads`, `/api/admin/leads/auto-assign`)
  - Manager controller (`updateLeadStatus` function)
  - Auto-assignment processes

**Call Status Values:**
- `Pending` - Lead allocated but not yet called
- `In Progress` - Employee currently working on lead
- `Completed` - Call attempt made (successful or not)
- `Not Required` - Lead doesn't need calling

### Database Schema Updates
```javascript
// Added to Lead model
callStatus: {
  type: String,
  enum: ['Pending', 'In Progress', 'Completed', 'Not Required'],
  default: 'Pending'
}

// Performance indexes added
leadSchema.index({ assignedTo: 1, callStatus: 1 });
leadSchema.index({ callStatus: 1, createdAt: -1 });
```

---

## 2. Call Tracking APIs

### Manager APIs
Three new endpoints added to manager controller:

#### Daily Call Statistics
**Endpoint:** `GET /api/manager/call-tracking/daily`

**Purpose:** Get daily call statistics for all employees under a manager

**Query Parameters:**
- `date` (optional): Specific date (YYYY-MM-DD format)
- `employeeId` (optional): Filter by specific employee

**Response:**
```json
{
  "date": "2024-01-15",
  "dailyStats": [
    {
      "employee": {
        "_id": "emp_id",
        "name": "John Doe",
        "email": "john@company.com"
      },
      "totalCalls": 15,
      "completedCalls": 12,
      "missedCalls": 3,
      "totalDuration": 2400,
      "averageDuration": 160,
      "successRate": 80,
      "callsByStatus": {
        "completed": 12,
        "missed": 3
      },
      "recentCalls": [...]
    }
  ],
  "teamSummary": {
    "totalCalls": 45,
    "totalCompleted": 36,
    "totalMissed": 9,
    "totalDuration": 7200,
    "averageSuccessRate": 80,
    "topPerformer": {
      "employee": { "name": "John Doe" },
      "totalCalls": 15
    }
  },
  "totalEmployees": 3
}
```

#### Team Call History
**Endpoint:** `GET /api/manager/call-tracking/history`

**Purpose:** Get comprehensive call history with filtering options

**Query Parameters:**
- `startDate` / `endDate`: Date range filter
- `employeeId`: Filter by specific employee
- `callStatus`: Filter by call status
- `outcome`: Filter by call outcome
- `page` / `limit`: Pagination

#### Call Tracking Summary
**Endpoint:** `GET /api/manager/call-tracking/summary`

**Purpose:** Get call tracking summary for dashboard display

**Query Parameters:**
- `days` (default: 7): Number of days to analyze

---

## 3. Frappe UI Dashboard

### Call Tracking Interface
Added a new "Call Tracking" section to the existing admin dashboard with:

#### Dashboard Features
- **Date Selection**: Choose specific date for analysis
- **Employee Filtering**: Filter by individual employee
- **Real-time Statistics**: Live call data display
- **Visual Cards**: Modern card-based layout
- **Responsive Design**: Works on all screen sizes

#### UI Components
- **Team Summary Card**: Overall team performance metrics
- **Individual Employee Cards**: Per-employee statistics
- **Call History Table**: Detailed call log display
- **Status Badges**: Visual call status indicators
- **Interactive Filters**: Date, employee, status filters

#### Visual Design Elements
- **Status Badges**: Color-coded call status indicators
- **Progress Metrics**: Success rates and duration tracking
- **Hover Effects**: Modern card hover animations
- **Responsive Grid**: Adaptive layout for different screens

---

## 4. Employee APIs

### Enhanced Lead Management
**Endpoint:** `GET /api/employee/leads`
- Now includes `callStatus` in response
- Shows only unapproached leads by default
- Supports `includeApproached` parameter

**Endpoint:** `PUT /api/employee/update-call-status`
- New endpoint for updating call status
- Validates call status values
- Ensures employee owns the lead

### Updated Response Format
```json
{
  "leads": [
    {
      "_id": "lead_id",
      "name": "Lead Name",
      "phone": "9876543210",
      "status": "New",
      "callStatus": "Pending",
      "sector": "Technology",
      "region": "Maharashtra"
    }
  ],
  "pagination": {
    "approachedCount": 5
  }
}
```

---

## 5. Role-Based Access Control

### Permission Matrix

| Feature | Admin | Manager | Employee |
|---------|-------|---------|----------|
| View All Call Statistics | ✅ | ❌ | ❌ |
| View Team Call Statistics | ✅ | ✅ | ❌ |
| View Own Call Statistics | ✅ | ✅ | ✅ |
| Update Lead Call Status | ❌ | ❌ | ✅ |
| Allocate Leads | ✅ | ✅ | ❌ |
| View Call History | ✅ | ✅ | ✅ (Own only) |

### Security Implementation
- **Authentication**: JWT token required for all endpoints
- **Authorization**: Role-based middleware enforcement
- **Data Isolation**: Users can only access their authorized data
- **Input Validation**: Comprehensive request validation

---

## 6. Performance Optimizations

### Database Indexes
```javascript
// Lead model indexes
leadSchema.index({ assignedTo: 1, callStatus: 1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ callStatus: 1, createdAt: -1 });

// CallLog model indexes
CallLogSchema.index({ employee: 1, callStatus: 1, createdAt: -1 });
CallLogSchema.index({ createdAt: 1, employee: 1 });
```

### Query Optimizations
- **Efficient Aggregations**: Single queries for statistics
- **Pagination Support**: Large dataset handling
- **Selective Population**: Only populate required fields
- **Date Range Queries**: Optimized date filtering

---

## 7. API Documentation

### Manager Endpoints

#### Daily Call Statistics
```
GET /api/manager/call-tracking/daily?date=2024-01-15&employeeId=emp123
```

#### Team Call History
```
GET /api/manager/call-tracking/history?startDate=2024-01-01&endDate=2024-01-31&callStatus=completed&page=1&limit=50
```

#### Call Tracking Summary
```
GET /api/manager/call-tracking/summary?days=7
```

### Employee Endpoints

#### Update Call Status
```
PUT /api/employee/update-call-status
Content-Type: application/json

{
  "leadId": "lead_id",
  "callStatus": "In Progress"
}
```

---

## 8. Implementation Features

### ✅ Completed Features

1. **Lead Allocation Logic**
   - Automatic "Pending" status on lead assignment
   - Works across all allocation methods (admin, manager, auto-assign)
   - Maintains data consistency

2. **Call Tracking System**
   - Daily statistics for managers
   - Team-wide call history
   - Individual employee performance metrics
   - Real-time data updates

3. **Frappe UI Dashboard**
   - Modern, responsive design
   - Interactive filtering and date selection
   - Visual status indicators
   - Team and individual performance cards

4. **Employee API Enhancement**
   - Call status visibility in lead responses
   - Dedicated call status update endpoint
   - Proper authorization checks

5. **Performance Optimization**
   - Strategic database indexes
   - Efficient query patterns
   - Pagination support for large datasets

### 🔧 Technical Highlights

- **Zero Downtime**: All changes are backward compatible
- **Scalable Architecture**: Supports growing teams and data
- **Security First**: Comprehensive input validation and authorization
- **Modern UI**: Frappe design principles with dark theme
- **API-First**: RESTful endpoints with proper documentation

---

## 9. Usage Examples

### Manager Daily Monitoring
```javascript
// Get today's call statistics
const response = await fetch('/api/manager/call-tracking/daily?date=2024-01-15', {
  headers: { 'Authorization': 'Bearer ' + token }
});

const data = await response.json();
console.log(`Team made ${data.teamSummary.totalCalls} calls today`);
console.log(`Success rate: ${data.teamSummary.averageSuccessRate}%`);
```

### Employee Call Status Update
```javascript
// Update lead call status
const updateResponse = await fetch('/api/employee/update-call-status', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leadId: 'lead_id',
    callStatus: 'In Progress'
  })
});
```

---

## 10. Future Enhancements

### Potential Improvements
1. **Real-time Updates**: WebSocket integration for live statistics
2. **Advanced Analytics**: Trend analysis and forecasting
3. **Mobile App**: Dedicated mobile interface for call tracking
4. **Automated Reports**: Scheduled email reports for managers
5. **Call Quality Metrics**: Audio quality analysis integration

### Maintenance Considerations
- **Index Monitoring**: Regular review of query performance
- **Data Cleanup**: Archive old call logs periodically
- **UI Updates**: Keep Frappe UI components current
- **API Versioning**: Plan for future API enhancements

---

*This call tracking system provides a complete solution for lead allocation and call monitoring with modern UI/UX and robust backend APIs.*