# 📱 Mobile App Integration Guide

## Overview
This guide explains how to integrate mobile applications with the TeleCRM system for call log uploads and audio recording management.

## 🚀 **Two Upload Methods Available**

### **Method 1: Multipart Form Data (Web/Desktop)**
- **Endpoint**: `POST /api/employee/call-log-with-recording`
- **Content-Type**: `multipart/form-data`
- **Best for**: Web applications, desktop apps, Postman testing

### **Method 2: JSON with Base64 Audio (Mobile)**
- **Endpoint**: `POST /api/employee/call-log-mobile`
- **Content-Type**: `application/json`
- **Best for**: Mobile apps (Android/iOS), API integrations

## 📱 **Mobile App Integration (Recommended)**

### **Endpoint**
```http
POST /api/employee/call-log-mobile
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### **Request Body Structure**
```json
{
    "leadId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "callStatus": "completed",
    "notes": "Customer showed interest in product",
    "callDuration": 180,
    "outcome": "Interested",
    "followUpRequired": true,
    "followUpDate": "2024-01-20T10:00:00.000Z",
    "callQuality": {
        "signalStrength": "Good",
        "networkType": "4G",
        "audioQuality": "Clear"
    },
    "simCardId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "audioData": "base64_encoded_audio_string_here",
    "audioFormat": "audio/mpeg",
    "fileName": "call_recording_001.mp3"
}
```

### **Audio Data Format**
- **audioData**: Base64 encoded audio file content
- **audioFormat**: MIME type (e.g., "audio/mpeg", "audio/wav")
- **fileName**: Original filename for reference

## 🌐 **Web/Desktop Integration**

### **Endpoint**
```http
POST /api/employee/call-log-with-recording
Content-Type: multipart/form-data
Authorization: Bearer <JWT_TOKEN>
```

### **Form Data Fields**
```
recording: [audio_file]
leadId: 64a1b2c3d4e5f6a7b8c9d0e1
callStatus: completed
notes: Customer showed interest in product
callDuration: 180
outcome: Interested
followUpRequired: true
followUpDate: 2024-01-20T10:00:00.000Z
callQuality[signalStrength]: Good
callQuality[networkType]: 4G
callQuality[audioQuality]: Clear
simCardId: 64a1b2c3d4e5f6a7b8c9d0e1
```

## 🔧 **Mobile App Implementation Examples**

### **Android (Kotlin)**
```kotlin
class CallLogUploader {
    fun uploadCallLog(
        leadId: String,
        audioFile: File,
        callStatus: String,
        notes: String,
        token: String
    ) {
        // Convert audio file to base64
        val audioBytes = audioFile.readBytes()
        val base64Audio = Base64.encodeToString(audioBytes, Base64.DEFAULT)
        
        // Prepare request body
        val requestBody = JSONObject().apply {
            put("leadId", leadId)
            put("callStatus", callStatus)
            put("notes", notes)
            put("audioData", base64Audio)
            put("audioFormat", "audio/mpeg")
            put("fileName", audioFile.name)
        }
        
        // Make HTTP request
        val client = OkHttpClient()
        val request = Request.Builder()
            .url("https://your-domain.com/api/employee/call-log-mobile")
            .addHeader("Authorization", "Bearer $token")
            .addHeader("Content-Type", "application/json")
            .post(requestBody.toString().toRequestBody("application/json".toMediaType()))
            .build()
            
        client.newCall(request).enqueue(object : Callback {
            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    // Handle success
                    Log.d("CallLog", "Upload successful")
                } else {
                    // Handle error
                    Log.e("CallLog", "Upload failed: ${response.code}")
                }
            }
            
            override fun onFailure(call: Call, e: IOException) {
                Log.e("CallLog", "Network error: ${e.message}")
            }
        })
    }
}
```

### **iOS (Swift)**
```swift
class CallLogUploader {
    func uploadCallLog(
        leadId: String,
        audioFile: Data,
        callStatus: String,
        notes: String,
        token: String
    ) {
        // Convert audio data to base64
        let base64Audio = audioFile.base64EncodedString()
        
        // Prepare request body
        let requestBody: [String: Any] = [
            "leadId": leadId,
            "callStatus": callStatus,
            "notes": notes,
            "audioData": base64Audio,
            "audioFormat": "audio/mpeg",
            "fileName": "call_recording.mp3"
        ]
        
        // Make HTTP request
        guard let url = URL(string: "https://your-domain.com/api/employee/call-log-mobile") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: requestBody)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("Network error: \(error)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 201 {
                    print("Upload successful")
                } else {
                    print("Upload failed: \(httpResponse.statusCode)")
                }
            }
        }.resume()
    }
}
```

### **React Native**
```javascript
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

class CallLogUploader {
    async uploadCallLog(leadId, audioFilePath, callStatus, notes, token) {
        try {
            // Read file and convert to base64
            const audioData = await RNFS.readFile(audioFilePath, 'base64');
            
            // Prepare request body
            const requestBody = {
                leadId,
                callStatus,
                notes,
                audioData,
                audioFormat: 'audio/mpeg',
                fileName: audioFilePath.split('/').pop()
            };
            
            // Make HTTP request
            const response = await fetch('https://your-domain.com/api/employee/call-log-mobile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Upload successful:', result);
                return result;
            } else {
                const error = await response.json();
                console.error('Upload failed:', error);
                throw new Error(error.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
}
```

## 🧪 **Testing with cURL**

### **Test Mobile Endpoint (JSON)**
```bash
curl -X POST "https://your-domain.com/api/employee/call-log-mobile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "callStatus": "completed",
    "notes": "Test call recording",
    "audioData": "base64_encoded_audio_here",
    "audioFormat": "audio/mpeg",
    "fileName": "test_recording.mp3"
  }'
```

### **Test Web Endpoint (Multipart)**
```bash
curl -X POST "https://your-domain.com/api/employee/call-log-with-recording" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "recording=@audio_file.mp3" \
  -F "leadId=64a1b2c3d4e5f6a7b8c9d0e1" \
  -F "callStatus=completed" \
  -F "notes=Test call recording"
```

## 📊 **Response Format**

### **Success Response (201)**
```json
{
    "message": "Mobile call log with recording saved successfully",
    "log": {
        "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
        "lead": {
            "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
            "name": "John Doe",
            "phone": "+1234567890",
            "email": "john@example.com",
            "status": "Interested",
            "sector": "Technology",
            "region": "North America"
        },
        "employee": {
            "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
            "name": "Employee Name",
            "email": "employee@company.com"
        },
        "callStatus": "completed",
        "callStartTime": "2024-01-15T10:30:00.000Z",
        "notes": "Customer showed interest in product",
        "recordingFile": "https://res.cloudinary.com/.../call_recording.mp3",
        "recordingUrl": "https://res.cloudinary.com/.../call_recording.mp3",
        "fileHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
    },
    "recordingUrl": "https://res.cloudinary.com/.../call_recording.mp3"
}
```

### **Error Responses**

#### **Duplicate File (400)**
```json
{
    "error": "Duplicate file detected",
    "details": "This audio file has already been uploaded. Please use a different file.",
    "existingCallLogId": "64a1b2c3d4e5f6a7b8c9d0e1",
    "uploadedAt": "2024-01-15T10:30:00.000Z"
}
```

#### **Validation Error (400)**
```json
{
    "error": "leadId and callStatus required"
}
```

#### **Authorization Error (403)**
```json
{
    "error": "Not allowed to log call for this lead"
}
```

#### **Server Error (500)**
```json
{
    "error": "Failed to save mobile call log with recording",
    "details": "Database connection error"
}
```

## 🔒 **Security & Authentication**

### **JWT Token Required**
- All endpoints require valid JWT token
- Token must be included in Authorization header
- Format: `Bearer <JWT_TOKEN>`

### **User Authorization**
- Users can only upload call logs for leads assigned to them
- System validates lead ownership before processing
- Prevents unauthorized access to lead data

### **File Validation**
- SHA256 hash calculation for duplicate detection
- File size limits enforced by server configuration
- Supported audio formats: MP3, WAV, M4A, etc.

## 📱 **Mobile App Best Practices**

### **Audio Recording**
- Use appropriate audio quality settings
- Compress audio files to reduce size
- Handle recording permissions properly
- Provide user feedback during upload

### **Network Handling**
- Implement retry logic for failed uploads
- Show upload progress to users
- Handle offline scenarios gracefully
- Validate network connectivity

### **Error Handling**
- Display user-friendly error messages
- Log errors for debugging
- Implement fallback mechanisms
- Provide clear next steps for users

### **Performance Optimization**
- Compress audio before upload
- Use background uploads when possible
- Implement upload queuing
- Cache successful uploads locally

## 🔧 **Configuration & Limits**

### **Server Limits**
```javascript
// Express configuration
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer configuration
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
    }
});
```

### **Cloudinary Configuration**
```javascript
cloudinary.config({
    cloud_name: 'your_cloud_name',
    api_key: 'your_api_key',
    api_secret: 'your_api_secret'
});
```

### **Database Indexing**
```javascript
// CallLog model
fileHash: {
    type: String,
    required: false,
    index: true // For fast duplicate detection
}
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Payload Too Large Error**
```bash
PayloadTooLargeError: request entity too large
```
**Solution**: Use the mobile endpoint (`/call-log-mobile`) for large files

#### **2. Content-Type Mismatch**
```bash
Error: Invalid content type
```
**Solution**: Ensure correct Content-Type header for your endpoint

#### **3. Authentication Failed**
```bash
Error: Unauthorized
```
**Solution**: Check JWT token validity and format

#### **4. Duplicate File Error**
```json
{
    "error": "Duplicate file detected"
}
```
**Solution**: Use a different audio file or check if file was already uploaded

### **Debug Steps**
1. **Check request headers** - Ensure correct Content-Type and Authorization
2. **Validate JWT token** - Verify token is valid and not expired
3. **Check file format** - Ensure audio file is supported format
4. **Monitor server logs** - Check for detailed error messages
5. **Test with cURL** - Verify endpoint functionality

## 📈 **Monitoring & Analytics**

### **Admin Dashboard**
- Monitor upload success rates
- Track duplicate file attempts
- View user upload patterns
- Analyze system performance

### **Logging**
- All upload attempts are logged
- Error details captured for debugging
- User activity tracking
- Performance metrics

## 🔄 **API Versioning**

### **Current Version**
- **v1**: `/api/employee/call-log-mobile`
- **v1**: `/api/employee/call-log-with-recording`

### **Future Versions**
- **v2**: Enhanced audio processing
- **v3**: AI-powered analysis
- **v4**: Advanced analytics

## 📚 **Additional Resources**

### **Documentation**
- [TeleCRM API Documentation](./API_DOCUMENTATION.md)
- [Duplicate File Checking](./DUPLICATE_FILE_CHECKING.md)
- [Authentication Guide](./AUTHENTICATION.md)

### **Support**
- **Technical Issues**: Check server logs and error responses
- **Integration Help**: Review code examples and testing guides
- **API Updates**: Monitor endpoint changes and new features

---

**Last Updated:** January 2024  
**Version:** 1.0.0  
**Maintainer:** TeleCRM Development Team
