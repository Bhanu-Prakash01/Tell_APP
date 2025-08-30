# 🔍 Duplicate File Checking System

## Overview
The TeleCRM system now includes robust duplicate file detection to prevent users from uploading the same audio file multiple times. This feature uses SHA256 cryptographic hashing to identify duplicate files with 100% accuracy.

## 🚀 Features

### ✅ **Automatic Duplicate Detection**
- **Real-time checking** during file upload
- **SHA256 hashing** for file fingerprinting
- **Per-user and global** duplicate detection
- **Immediate error response** for duplicates

### ✅ **Multiple Detection Levels**
1. **User-level duplicates** - Same user can't upload same file twice
2. **Global duplicates** - No user can upload a file that already exists
3. **Hash-based identification** - Content-based, not filename-based

### ✅ **Admin Monitoring**
- **Duplicate file dashboard** for administrators
- **Detailed analytics** on duplicate attempts
- **User tracking** for duplicate uploads

## 🔧 Technical Implementation

### Database Schema Changes
```javascript
// Added to CallLog model
fileHash: {
    type: String,
    required: false,
    index: true // For faster duplicate checking
}
```

### File Upload Process
```javascript
// 1. Calculate file hash
const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

// 2. Check for duplicates
const existingCallLog = await CallLog.findOne({ fileHash: fileHash });

// 3. Reject if duplicate found
if (existingCallLog) {
    return res.status(400).json({ 
        error: 'Duplicate file detected',
        details: 'This audio file has already been uploaded'
    });
}

// 4. Proceed with upload if unique
```

## 📡 API Endpoints

### 1. **Upload Call Log with Recording**
```http
POST /api/employee/call-log-with-recording
Content-Type: multipart/form-data

Parameters:
- recording: Audio file (mp3, wav, etc.)
- leadId: Lead ID
- callStatus: Call status
- notes: Call notes
- callDuration: Call duration
- outcome: Call outcome
- followUpRequired: Boolean
- followUpDate: Date
- callQuality: Object
- simCardId: SIM card ID
```

**Response for Duplicate:**
```json
{
    "error": "Duplicate file detected",
    "details": "This audio file has already been uploaded. Please use a different file.",
    "existingCallLogId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "uploadedAt": "2024-01-15T10:30:00.000Z"
}
```

### 2. **Check File Duplicate (Pre-upload)**
```http
POST /api/employee/check-file-duplicate
Content-Type: multipart/form-data

Parameters:
- recording: Audio file to check
```

**Response:**
```json
{
    "isDuplicate": true,
    "fileHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    "existingCallLog": {
        "id": "64a1b2c3d4e5f6a7b8c9d0e1",
        "uploadedBy": "64a1b2c3d4e5f6a7b8c9d0e1",
        "uploadedAt": "2024-01-15T10:30:00.000Z",
        "lead": "64a1b2c3d4e5f6a7b8c9d0e1"
    },
    "message": "This file has already been uploaded"
}
```

### 3. **Admin Duplicate Files Monitor**
```http
GET /api/admin/duplicate-files?page=1&limit=20
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
    "duplicateFiles": [
        {
            "fileHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
            "duplicateCount": 3,
            "callLogs": [
                {
                    "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
                    "lead": { "name": "John Doe", "phone": "+1234567890", "email": "john@example.com" },
                    "employee": { "name": "Employee 1", "email": "emp1@company.com" },
                    "callStartTime": "2024-01-15T10:30:00.000Z",
                    "createdAt": "2024-01-15T10:30:00.000Z",
                    "fileHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
                    "recordingFile": "https://res.cloudinary.com/.../call_recording.mp3"
                }
            ]
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 5,
        "pages": 1
    }
}
```

## 🧪 Testing

### Run Test Script
```bash
node test-duplicate-check.js
```

### Manual Testing with cURL

#### 1. **Test Duplicate Detection**
```bash
# First upload
curl -X POST "http://localhost:5000/api/employee/call-log-with-recording" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "recording=@audio1.mp3" \
  -F "leadId=64a1b2c3d4e5f6a7b8c9d0e1" \
  -F "callStatus=completed"

# Try to upload same file again (should fail)
curl -X POST "http://localhost:5000/api/employee/call-log-with-recording" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "recording=@audio1.mp3" \
  -F "leadId=64a1b2c3d4e5f6a7b8c9d0e1" \
  -F "callStatus=completed"
```

#### 2. **Pre-check File Duplicate**
```bash
curl -X POST "http://localhost:5000/api/employee/check-file-duplicate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "recording=@audio1.mp3"
```

#### 3. **Admin Monitor Duplicates**
```bash
curl -X GET "http://localhost:5000/api/admin/duplicate-files" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

## 🔒 Security Features

### **Hash Algorithm**
- **SHA256** - Industry standard cryptographic hash
- **Collision resistance** - Extremely low probability of hash collisions
- **Deterministic** - Same input always produces same output

### **Access Control**
- **Employee endpoints** - Only authenticated employees can access
- **Admin endpoints** - Only administrators can view duplicate analytics
- **JWT validation** - Secure token-based authentication

### **Data Privacy**
- **File content** - Never stored in database, only hash
- **User isolation** - Employees can't see other users' file hashes
- **Audit trail** - Complete tracking of duplicate attempts

## 📊 Performance Considerations

### **Database Indexing**
```javascript
// fileHash field is indexed for fast lookups
fileHash: {
    type: String,
    required: false,
    index: true
}
```

### **Hash Calculation**
- **In-memory processing** - File buffer processed in memory
- **Streaming uploads** - Efficient file handling with multer
- **Async operations** - Non-blocking duplicate checks

### **Caching Strategy**
- **Hash-based lookups** - O(1) time complexity for duplicate detection
- **Minimal database queries** - Single query per file upload
- **Efficient aggregation** - MongoDB aggregation for admin analytics

## 🚨 Error Handling

### **Duplicate File Errors**
```javascript
// User-friendly error messages
{
    "error": "Duplicate file detected",
    "details": "This audio file has already been uploaded. Please use a different file.",
    "existingCallLogId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "uploadedAt": "2024-01-15T10:30:00.000Z"
}
```

### **Validation Errors**
```javascript
// Missing file
{
    "error": "No file provided"
}

// File upload failure
{
    "error": "Failed to upload recording file"
}
```

### **Server Errors**
```javascript
// Internal server error
{
    "error": "Failed to save call log with recording",
    "details": "Database connection error"
}
```

## 🔄 Workflow Integration

### **Employee Workflow**
1. **Select audio file** for call log
2. **System calculates** file hash automatically
3. **Duplicate check** performed in real-time
4. **Upload proceeds** if file is unique
5. **Error returned** if duplicate detected

### **Manager Workflow**
1. **View call records** including file uploads
2. **Monitor team** file upload patterns
3. **Identify** potential duplicate attempts
4. **Coach employees** on proper file management

### **Admin Workflow**
1. **Monitor system** for duplicate file patterns
2. **Analyze** duplicate file analytics
3. **Investigate** suspicious upload patterns
4. **Maintain** system integrity

## 🎯 Use Cases

### **Prevent Data Duplication**
- **Storage optimization** - No duplicate files in cloud storage
- **Data integrity** - Consistent call log records
- **User experience** - Clear feedback on duplicate attempts

### **Quality Assurance**
- **Content verification** - Ensure unique call recordings
- **Audit compliance** - Track all file upload attempts
- **Performance monitoring** - Identify system usage patterns

### **Security Monitoring**
- **Upload patterns** - Detect unusual file upload behavior
- **Access control** - Prevent unauthorized file uploads
- **Compliance** - Maintain data governance standards

## 🔧 Configuration

### **Environment Variables**
```bash
# Cloudinary configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# File upload limits
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=mp3,wav,m4a
```

### **Database Configuration**
```javascript
// MongoDB connection with proper indexing
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Ensure indexes are created
    autoIndex: true
});
```

## 📈 Monitoring & Analytics

### **Key Metrics**
- **Duplicate detection rate** - Percentage of duplicate attempts
- **File upload success rate** - Successful vs failed uploads
- **Storage efficiency** - Space saved by preventing duplicates
- **User behavior patterns** - Upload frequency and timing

### **Admin Dashboard**
- **Real-time monitoring** of file uploads
- **Duplicate file reports** with detailed analytics
- **User activity tracking** for compliance
- **System performance** metrics

## 🚀 Future Enhancements

### **Planned Features**
- **Fuzzy matching** - Detect similar audio files
- **Audio fingerprinting** - Advanced audio analysis
- **Batch processing** - Handle multiple file uploads
- **API rate limiting** - Prevent abuse

### **Integration Opportunities**
- **AI-powered analysis** - Intelligent duplicate detection
- **Machine learning** - Pattern recognition for uploads
- **Advanced analytics** - Predictive duplicate prevention
- **Mobile app support** - Native duplicate checking

## 📚 References

### **Technical Documentation**
- [SHA256 Hash Algorithm](https://en.wikipedia.org/wiki/SHA-2)
- [MongoDB Aggregation](https://docs.mongodb.com/manual/aggregation/)
- [Multer File Upload](https://github.com/expressjs/multer)
- [Cloudinary API](https://cloudinary.com/documentation)

### **Security Standards**
- [NIST Hash Functions](https://csrc.nist.gov/projects/hash-functions)
- [OWASP File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Data Privacy Regulations](https://gdpr.eu/)

---

**Last Updated:** January 2024  
**Version:** 1.0.0  
**Maintainer:** TeleCRM Development Team
