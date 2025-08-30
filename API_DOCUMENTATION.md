# 📚 TeleCRM API Documentation

## 🚀 Overview

TeleCRM is a comprehensive SIM-Based Calling CRM System with modern UI, theme switching, and powerful analytics. This document provides detailed information about all available API endpoints, authentication, and usage examples.

## 🔐 Authentication

All protected routes require JWT authentication. Include the token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

## 📋 API Endpoints

### 🔑 Authentication Routes (`/api/auth`)

#### POST `/api/auth/register`
Create a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "role": "employee"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee"
  }
}
```

#### POST `/api/auth/login`
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "employee"
  },
  "role": "employee"
}
```

### 👑 Admin Routes (`/api/admin`)

*Requires admin role*

#### GET `/api/admin/managers`
Get all managers in the system.

**Response:**
```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Manager Name",
    "email": "manager@example.com",
    "role": "manager",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

#### POST `/api/admin/managers`
Create a new manager.

**Request Body:**
```json
{
  "name": "New Manager",
  "email": "newmanager@example.com",
  "password": "securepassword123"
}
```

#### GET `/api/admin/employees`
Get all employees with manager information.

**Response:**
```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Employee Name",
    "email": "employee@example.com",
    "role": "employee",
    "manager": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "name": "Manager Name",
      "email": "manager@example.com"
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

#### POST `/api/admin/employees`
Create a new employee.

**Request Body:**
```json
{
  "name": "New Employee",
  "email": "newemployee@example.com",
  "password": "securepassword123",
  "managerId": "60f7b3b3b3b3b3b3b3b3b3b4"
}
```

#### GET `/api/admin/leads`
Get all leads in the system.

**Response:**
```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Lead Name",
    "phone": "+1234567890",
    "email": "lead@example.com",
    "status": "New",
    "sector": "Technology",
    "region": "North",
    "assignedTo": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "name": "Employee Name",
      "email": "employee@example.com"
    },
    "createdBy": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
      "name": "Manager Name",
      "email": "manager@example.com"
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

#### GET `/api/admin/leads/analytics`
Get comprehensive lead analytics.

**Response:**
```json
{
  "statusDistribution": {
    "New": 25,
    "Interested": 30,
    "Hot": 15,
    "Follow-up": 20,
    "Won": 10,
    "Lost": 5
  },
  "sectorDistribution": {
    "Technology": 40,
    "Healthcare": 25,
    "Finance": 20,
    "Education": 15
  },
  "regionDistribution": {
    "North": 35,
    "South": 25,
    "East": 20,
    "West": 20
  },
  "hotLeadsBySector": {
    "Technology": 8,
    "Healthcare": 3,
    "Finance": 2,
    "Education": 2
  },
  "interestedLeadsBySector": {
    "Technology": 12,
    "Healthcare": 8,
    "Finance": 6,
    "Education": 4
  },
  "monthlyLeadTrend": {
    "January 2024": 45,
    "February 2024": 52,
    "March 2024": 48
  },
  "totalLeads": 105
}
```

#### GET `/api/admin/campaigns`
Get all campaigns.

**Response:**
```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Q1 Sales Campaign",
    "description": "First quarter sales push",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-03-31T23:59:59.000Z",
    "targetAudience": "hot",
    "campaignType": "phone",
    "status": "Active",
    "metrics": {
      "reach": 1000,
      "impressions": 850,
      "clicks": 120,
      "conversions": 25
    },
    "createdBy": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "name": "Manager Name",
      "email": "manager@example.com"
    }
  }
]
```

#### GET `/api/admin/sims`
Get all SIM cards.

**Response:**
```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "simNumber": "+91-9876543210",
    "carrier": "Airtel",
    "status": "Active",
    "balance": 150,
    "dataBalance": 1024,
    "validity": "2024-12-31T23:59:59.000Z",
    "assignedTo": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "name": "Employee Name",
      "email": "employee@example.com"
    },
    "totalCalls": 45,
    "totalMinutes": 180,
    "lastUsed": "2024-01-15T10:30:00.000Z"
  }
]
```

#### GET `/api/admin/calls/analytics`
Get call analytics.

**Response:**
```json
{
  "totalCalls": 1250,
  "successfulCalls": 890,
  "missedCalls": 210,
  "rejectedCalls": 150,
  "averageCallDuration": 180,
  "callsByHour": {
    "9": 45,
    "10": 67,
    "11": 89,
    "12": 78
  },
  "callsByDay": {
    "Monday": 180,
    "Tuesday": 195,
    "Wednesday": 210
  },
  "topPerformers": [
    {
      "name": "John Doe",
      "calls": 89,
      "successRate": 85
    }
  ]
}
```

#### GET `/api/admin/performance/dashboard`
Get overall performance metrics.

**Response:**
```json
{
  "totalUsers": 25,
  "totalLeads": 105,
  "totalCalls": 1250,
  "activeSims": 18,
  "conversionRate": 9.5,
  "callSuccessRate": 71.2,
  "monthlyGrowth": 12.5
}
```

#### GET `/api/admin/stats/overview`
Get comprehensive system statistics.

**Response:**
```json
{
  "userStats": {
    "total": 25,
    "admins": 2,
    "managers": 5,
    "employees": 18
  },
  "leadStats": {
    "total": 105,
    "byStatus": {
      "New": 25,
      "Interested": 30,
      "Hot": 15
    },
    "bySector": {
      "Technology": 40,
      "Healthcare": 25,
      "Finance": 20
    }
  },
  "campaignStats": {
    "total": 8,
    "active": 3,
    "completed": 4,
    "byType": {
      "phone": 5,
      "email": 2,
      "social": 1
    }
  },
  "simStats": {
    "total": 20,
    "active": 18,
    "assigned": 15,
    "byCarrier": {
      "Airtel": 8,
      "Jio": 7,
      "Vodafone": 5
    }
  },
  "callStats": {
    "total": 1250,
    "successful": 890,
    "averageDuration": 180
  }
}
```

### 👨‍💼 Manager Routes (`/api/manager`)

*Requires manager role*

#### GET `/api/manager/team`
Get team members under the manager.

**Response:**
```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Employee Name",
    "email": "employee@example.com",
    "role": "employee",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

#### GET `/api/manager/team/performance`
Get team performance summary.

**Response:**
```json
{
  "totalTeamMembers": 5,
  "totalLeads": 45,
  "leadsByStatus": {
    "new": 10,
    "interested": 15,
    "hot": 8,
    "followUp": 7,
    "won": 3,
    "lost": 2
  },
  "conversionRate": 6.7,
  "averageResponseTime": "2.5 hours",
  "teamEfficiency": 87.5
}
```

#### GET `/api/manager/leads`
Get leads under manager's team.

**Response:**
```json
[
  {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Lead Name",
    "phone": "+1234567890",
    "email": "lead@example.com",
    "status": "New",
    "sector": "Technology",
    "region": "North",
    "assignedTo": {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "name": "Employee Name",
      "email": "employee@example.com"
    },
    "followUpDate": "2024-01-20T00:00:00.000Z"
  }
]
```

#### POST `/api/manager/leads`
Create a new lead.

**Request Body:**
```json
{
  "name": "New Lead",
  "phone": "+1234567890",
  "email": "newlead@example.com",
  "sector": "Technology",
  "region": "North",
  "notes": "Interested in our services"
}
```

#### PUT `/api/manager/leads/:id`
Update lead status and assignment.

**Request Body:**
```json
{
  "status": "Hot",
  "assignedTo": "60f7b3b3b3b3b3b3b3b3b3b4",
  "notes": "Lead shows high interest"
}
```

#### GET `/api/manager/dashboard`
Get manager dashboard data.

**Response:**
```json
{
  "stats": {
    "total": 45,
    "new": 10,
    "interested": 15,
    "hot": 8,
    "followUp": 7,
    "won": 3,
    "lost": 2
  },
  "totalSales": 15000,
  "hotLeadsNeedingReassignment": 2,
  "lostLeadsNeedingReassignment": 1,
  "employees": 5,
  "conversionRate": 6.7
}
```

### 👷 Employee Routes (`/api/employee`)

*Requires employee role*

#### GET `/api/employee/profile`
Get employee profile information.

**Response:**
```json
{
  "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
  "name": "Employee Name",
  "email": "employee@example.com",
  "role": "employee",
  "manager": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
    "name": "Manager Name",
    "email": "manager@example.com"
  },
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

#### GET `/api/employee/leads`
Get leads assigned to the employee.

**Query Parameters:**
- `status`: Filter by lead status
- `sector`: Filter by sector
- `region`: Filter by region
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response:**
```json
{
  "leads": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "Lead Name",
      "phone": "+1234567890",
      "email": "lead@example.com",
      "status": "New",
      "sector": "Technology",
      "region": "North",
      "notes": "Interested in our services",
      "followUpDate": "2024-01-20T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  }
}
```

#### GET `/api/employee/leads/:leadId`
Get specific lead details.

**Response:**
```json
{
  "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
  "name": "Lead Name",
  "phone": "+1234567890",
  "email": "lead@example.com",
  "status": "New",
  "sector": "Technology",
  "region": "North",
  "notes": "Interested in our services",
  "followUpDate": "2024-01-20T00:00:00.000Z",
  "assignedTo": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
    "name": "Employee Name",
    "email": "employee@example.com"
  }
}
```

#### PUT `/api/employee/update-lead`
Update lead notes, status, and follow-up date.

**Request Body:**
```json
{
  "leadId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "note": "Called lead, showed interest in premium plan",
  "status": "Interested",
  "followUpDate": "2024-01-25T00:00:00.000Z"
}
```

#### POST `/api/employee/call-log`
Add a new call log entry.

**Request Body:**
```json
{
  "leadId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "callStatus": "completed",
  "notes": "Lead was very interested in our services",
  "callDuration": 300,
  "outcome": "Interested",
  "followUpRequired": true,
  "followUpDate": "2024-01-25T00:00:00.000Z"
}
```

#### GET `/api/employee/my-call-logs`
Get call logs for the employee.

**Query Parameters:**
- `leadId`: Filter by specific lead
- `callStatus`: Filter by call status
- `startDate`: Filter from date
- `endDate`: Filter until date
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response:**
```json
{
  "logs": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "lead": {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
        "name": "Lead Name",
        "phone": "+1234567890",
        "email": "lead@example.com"
      },
      "callStatus": "completed",
      "notes": "Lead was very interested",
      "callDuration": 300,
      "outcome": "Interested",
      "followUpRequired": true,
      "followUpDate": "2024-01-25T00:00:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "pages": 2
  }
}
```

#### POST `/api/employee/upload-call-log`
Upload call recording (audio file).

**Request Body:** `multipart/form-data`
- `recording`: Audio file (MP3, WAV, etc.)
- `leadId`: Lead ID to link the recording

**Response:**
```json
{
  "message": "Call log uploaded successfully",
  "url": "https://res.cloudinary.com/.../recording.mp3"
}
```

#### GET `/api/employee/performance`
Get employee performance metrics.

**Query Parameters:**
- `period`: Performance period (week, month, quarter, year)

**Response:**
```json
{
  "totalLeads": 15,
  "leadsByStatus": {
    "New": 5,
    "Interested": 6,
    "Hot": 2,
    "Follow-up": 2
  },
  "totalCalls": 45,
  "callSuccessRate": 78,
  "averageCallDuration": 180,
  "conversionRate": 13.3,
  "monthlyGrowth": 8.5,
  "period": "month"
}
```

#### GET `/api/employee/dashboard`
Get employee dashboard summary.

**Response:**
```json
{
  "stats": {
    "totalLeads": 15,
    "newLeads": 5,
    "hotLeads": 2,
    "followUpLeads": 2,
    "overdueFollowUps": 1
  },
  "recentActivity": [
    {
      "type": "lead_assigned",
      "description": "New lead assigned: John Doe",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "upcomingTasks": [
    {
      "leadId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "leadName": "John Doe",
      "taskType": "Follow-up Call",
      "dueDate": "2024-01-20T00:00:00.000Z"
    }
  ]
}
```

#### GET `/api/employee/leads/search`
Search leads by various criteria.

**Query Parameters:**
- `q`: Search query (name, phone, email)
- `status`: Filter by status
- `sector`: Filter by sector
- `region`: Filter by region
- `hasFollowUp`: Filter leads with/without follow-up dates

**Response:**
```json
{
  "leads": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "John Doe",
      "phone": "+1234567890",
      "email": "john@example.com",
      "status": "Interested",
      "sector": "Technology",
      "region": "North"
    }
  ],
  "total": 1
}
```

## 🎨 UI Features

### Theme Switching
Both admin and manager dashboards support three themes:
- **Light**: Clean, professional appearance
- **Semi-Dark**: Balanced dark theme
- **Dark**: Full dark mode for extended use

### Modern Design
- Responsive grid layouts
- Interactive charts and graphs
- Smooth animations and transitions
- Professional color schemes
- Mobile-friendly interfaces

## 📊 Analytics & Charts

### Lead Analytics
- Status distribution by sector and region
- Hot vs. Interested lead comparisons
- Monthly lead creation trends
- Sector-region matrix analysis

### Call Analytics
- Call success rates by employee
- Call duration patterns
- Hourly and daily call distributions
- Top performer identification

### Performance Metrics
- Team efficiency scores
- Individual performance tracking
- Conversion rate analysis
- Monthly growth tracking

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB database
- Modern web browser

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Tele_Calling
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file:
   ```env
   MONGO_URI=mongodb://localhost:27017/telecrm
   JWT_SECRET=your-super-secret-jwt-key
   PORT=5000
   ```

4. **Start the server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

5. **Access the application**
   - Admin Dashboard: `http://localhost:5000/admin.html`
   - Manager Dashboard: `http://localhost:5000/manager.html`
   - Employee Dashboard: `http://localhost:5000/employee.html`
   - API Documentation: `http://localhost:5000/api-docs`

## 🚀 API Usage Examples

### Using cURL

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

#### Get Leads (with authentication)
```bash
curl -X GET http://localhost:5000/api/admin/leads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create Lead
```bash
curl -X POST http://localhost:5000/api/admin/leads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Lead","phone":"+1234567890","email":"lead@example.com","sector":"Technology","region":"North"}'
```

### Using JavaScript/Fetch

#### Login
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});

const data = await response.json();
localStorage.setItem('token', data.token);
```

#### Get Leads
```javascript
const response = await fetch('/api/admin/leads', {
  headers: { 
    'Authorization': `Bearer ${localStorage.getItem('token')}` 
  }
});

const leads = await response.json();
```

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Input validation and sanitization
- CORS protection
- Rate limiting (can be added)

## 📱 Mobile Support

- Responsive design for all screen sizes
- Touch-friendly interfaces
- Mobile-optimized navigation
- Progressive Web App features

## 🚀 Future Enhancements

- Real-time notifications with WebSockets
- Advanced reporting and analytics
- Integration with external CRM systems
- Mobile app development
- AI-powered lead scoring
- Advanced call analytics
- Multi-tenant support

## 📞 Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation at `/api-docs`

---

**TeleCRM - Transforming the way you manage customer relationships through intelligent calling solutions.**
