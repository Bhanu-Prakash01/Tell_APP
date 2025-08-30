# 📱 TeleCRM Kotlin Developer Guide

## 🚀 Overview

This guide provides comprehensive information for developing the TeleCRM employee mobile application using Kotlin. The backend API is built with Node.js/Express.js and provides all necessary endpoints for the mobile app functionality.

## 🔐 Authentication

All API requests require JWT authentication. Include the token in the Authorization header:

```kotlin
val headers = mapOf(
    "Authorization" to "Bearer $token",
    "Content-Type" to "application/json"
)
```

## 📋 API Base URL

```
http://your-server-domain:5000/api
```

## 🔑 Authentication Endpoints

### Login
```kotlin
// POST /api/auth/login
data class LoginRequest(
    val email: String,
    val password: String
)

data class LoginResponse(
    val token: String,
    val user: User,
    val role: String
)

// Example usage
val loginRequest = LoginRequest("employee@example.com", "password123")
val response = client.post("/auth/login") {
    contentType(ContentType.Application.Json)
    setBody(loginRequest)
}
```

### Register (if needed)
```kotlin
// POST /api/auth/register
data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val role: String = "employee"
)
```

## 👷 Employee-Specific Endpoints

### Get Employee Profile
```kotlin
// GET /api/employee/profile
data class EmployeeProfile(
    val _id: String,
    val name: String,
    val email: String,
    val role: String,
    val manager: Manager?,
    val createdAt: String
)

data class Manager(
    val _id: String,
    val name: String,
    val email: String
)
```

### Get Assigned Leads
```kotlin
// GET /api/employee/leads
// Query parameters: status, sector, region, page, limit

data class Lead(
    val _id: String,
    val name: String,
    val phone: String,
    val email: String?,
    val status: String,
    val sector: String,
    val region: String,
    val notes: String?,
    val followUpDate: String?,
    val assignedTo: EmployeeProfile?,
    val createdBy: EmployeeProfile?,
    val createdAt: String
)

// Example with filters
val response = client.get("/employee/leads?status=New&page=1&limit=20") {
    headers { append("Authorization", "Bearer $token") }
}
```

### Get Specific Lead Details
```kotlin
// GET /api/employee/leads/{leadId}
val response = client.get("/employee/leads/$leadId") {
    headers { append("Authorization", "Bearer $token") }
}
```

### Update Lead
```kotlin
// PUT /api/employee/update-lead
data class UpdateLeadRequest(
    val leadId: String,
    val note: String?,
    val status: String?,
    val followUpDate: String?
)

val updateRequest = UpdateLeadRequest(
    leadId = "lead_id_here",
    note = "Called lead, showed interest in premium plan",
    status = "Interested",
    followUpDate = "2024-02-15"
)
```

### Add Call Log
```kotlin
// POST /api/employee/call-log
data class CallLogRequest(
    val leadId: String,
    val callStatus: String, // completed, missed, declined, not_lifted, wrong_number, busy, unreachable, voicemail
    val notes: String?,
    val callDuration: Int? = 0,
    val outcome: String? = "Neutral", // Positive, Neutral, Negative, Follow-up Required, Not Interested, Interested, Hot Lead, Converted
    val followUpRequired: Boolean = false,
    val followUpDate: String?
)

data class CallLogResponse(
    val message: String,
    val log: CallLog
)

data class CallLog(
    val _id: String,
    val lead: Lead,
    val callStatus: String,
    val notes: String?,
    val callDuration: Int,
    val outcome: String,
    val followUpRequired: Boolean,
    val followUpDate: String?,
    val createdAt: String
)
```

### Get Call Logs
```kotlin
// GET /api/employee/my-call-logs
// Query parameters: leadId, callStatus, startDate, endDate, page, limit

data class CallLogsResponse(
    val logs: List<CallLog>,
    val pagination: Pagination
)

data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val pages: Int
)
```

### Upload Call Recording
```kotlin
// POST /api/employee/upload-call-log
// Multipart form data

val response = client.post("/employee/upload-call-log") {
    headers { append("Authorization", "Bearer $token") }
    setBody(MultiPartFormDataContent(
        formData {
            append("recording", File("path/to/recording.mp3").readBytes(), Headers.build {
                append(HttpHeaders.ContentType, "audio/mpeg")
                append(HttpHeaders.ContentDisposition, "filename=recording.mp3")
            })
            append("leadId", "lead_id_here")
        }
    ))
}
```

### Get Performance Metrics
```kotlin
// GET /api/employee/performance
// Query parameter: period (week, month, quarter, year)

data class PerformanceResponse(
    val totalLeads: Int,
    val leadsByStatus: Map<String, Int>,
    val totalCalls: Int,
    val callSuccessRate: Double,
    val averageCallDuration: Int,
    val conversionRate: Double,
    val monthlyGrowth: Double,
    val period: String
)
```

### Get Dashboard Summary
```kotlin
// GET /api/employee/dashboard

data class DashboardResponse(
    val stats: DashboardStats,
    val recentActivity: List<Activity>,
    val upcomingTasks: List<Task>
)

data class DashboardStats(
    val totalLeads: Int,
    val newLeads: Int,
    val hotLeads: Int,
    val followUpLeads: Int,
    val overdueFollowUps: Int
)

data class Activity(
    val type: String,
    val description: String,
    val timestamp: String
)

data class Task(
    val leadId: String,
    val leadName: String,
    val taskType: String,
    val dueDate: String
)
```

### Search Leads
```kotlin
// GET /api/employee/leads/search
// Query parameters: q, status, sector, region, hasFollowUp

data class SearchResponse(
    val leads: List<Lead>,
    val total: Int
)
```

## 📊 Lead Status Values

```kotlin
enum class LeadStatus {
    NEW,
    INTERESTED,
    HOT,
    FOLLOW_UP,
    WON,
    LOST
}
```

## 📱 Call Status Values

```kotlin
enum class CallStatus {
    COMPLETED,
    MISSED,
    DECLINED,
    NOT_LIFTED,
    WRONG_NUMBER,
    BUSY,
    UNREACHABLE,
    VOICEMAIL
}
```

## 🏢 Sector Values

```kotlin
enum class Sector {
    TECHNOLOGY,
    HEALTHCARE,
    FINANCE,
    EDUCATION,
    RETAIL,
    MANUFACTURING,
    REAL_ESTATE,
    OTHER
}
```

## 🌍 State Values (Indian States)

```kotlin
enum class State {
    ANDHRA_PRADESH,
    ARUNACHAL_PRADESH,
    ASSAM,
    BIHAR,
    CHHATTISGARH,
    GOA,
    GUJARAT,
    HARYANA,
    HIMACHAL_PRADESH,
    JHARKHAND,
    KARNATAKA,
    KERALA,
    MADHYA_PRADESH,
    MAHARASHTRA,
    MANIPUR,
    MEGHALAYA,
    MIZORAM,
    NAGALAND,
    ODISHA,
    PUNJAB,
    RAJASTHAN,
    SIKKIM,
    TAMIL_NADU,
    TELANGANA,
    TRIPURA,
    UTTAR_PRADESH,
    UTTARAKHAND,
    WEST_BENGAL,
    DELHI,
    JAMMU_AND_KASHMIR,
    LADAKH,
    CHANDIGARH,
    DADRA_AND_NAGAR_HAVELI_AND_DAMAN_AND_DIU,
    LAKSHADWEEP,
    PUDUCHERRY,
    ANDAMAN_AND_NICOBAR_ISLANDS
}
```

## 🔧 Kotlin Implementation Examples

### HTTP Client Setup
```kotlin
import io.ktor.client.*
import io.ktor.client.engine.android.*
import io.ktor.client.features.json.*
import io.ktor.client.request.*
import io.ktor.http.*

class TeleCRMClient {
    private val client = HttpClient(Android) {
        install(JsonFeature) {
            serializer = KotlinxSerializer()
        }
    }
    
    private val baseUrl = "http://your-server-domain:5000/api"
    private var authToken: String? = null
    
    fun setAuthToken(token: String) {
        authToken = token
    }
    
    suspend fun login(email: String, password: String): LoginResponse {
        return client.post("$baseUrl/auth/login") {
            contentType(ContentType.Application.Json)
            setBody(LoginRequest(email, password))
        }
    }
    
    suspend fun getLeads(page: Int = 1, limit: Int = 20): List<Lead> {
        return client.get("$baseUrl/employee/leads") {
            headers {
                append("Authorization", "Bearer $authToken")
            }
            parameter("page", page)
            parameter("limit", limit)
        }
    }
    
    suspend fun updateLead(request: UpdateLeadRequest): Lead {
        return client.put("$baseUrl/employee/update-lead") {
            headers {
                append("Authorization", "Bearer $authToken")
            }
            contentType(ContentType.Application.Json)
            setBody(request)
        }
    }
    
    suspend fun addCallLog(request: CallLogRequest): CallLogResponse {
        return client.post("$baseUrl/employee/call-log") {
            headers {
                append("Authorization", "Bearer $authToken")
            }
            contentType(ContentType.Application.Json)
            setBody(request)
        }
    }
}
```

### ViewModel Example
```kotlin
class LeadsViewModel : ViewModel() {
    private val client = TeleCRMClient()
    private val _leads = MutableLiveData<List<Lead>>()
    val leads: LiveData<List<Lead>> = _leads
    
    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading
    
    fun loadLeads(page: Int = 1) {
        viewModelScope.launch {
            try {
                _loading.value = true
                val leadsList = client.getLeads(page)
                _leads.value = leadsList
            } catch (e: Exception) {
                // Handle error
            } finally {
                _loading.value = false
            }
        }
    }
    
    fun updateLeadStatus(leadId: String, status: String, note: String?) {
        viewModelScope.launch {
            try {
                val request = UpdateLeadRequest(leadId, note, status, null)
                client.updateLead(request)
                // Refresh leads
                loadLeads()
            } catch (e: Exception) {
                // Handle error
            }
        }
    }
}
```

### Repository Pattern
```kotlin
class TeleCRMRepository(private val client: TeleCRMClient) {
    suspend fun login(email: String, password: String): Result<LoginResponse> {
        return try {
            val response = client.login(email, password)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getLeads(page: Int = 1): Result<List<Lead>> {
        return try {
            val leads = client.getLeads(page)
            Result.success(leads)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateLead(request: UpdateLeadRequest): Result<Lead> {
        return try {
            val lead = client.updateLead(request)
            Result.success(lead)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

## 🎨 UI Components

### Lead Card Component
```kotlin
@Composable
fun LeadCard(
    lead: Lead,
    onCallClick: () -> Unit,
    onUpdateClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp),
        elevation = 4.dp
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = lead.name,
                    style = MaterialTheme.typography.h6
                )
                StatusChip(status = lead.status)
            }
            
            Text(
                text = lead.phone,
                style = MaterialTheme.typography.body1
            )
            
            lead.email?.let { email ->
                Text(
                    text = email,
                    style = MaterialTheme.typography.body2,
                    color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f)
                )
            }
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${lead.sector} • ${lead.region}",
                    style = MaterialTheme.typography.caption
                )
                
                Row {
                    IconButton(onClick = onCallClick) {
                        Icon(Icons.Default.Call, "Call")
                    }
                    IconButton(onClick = onUpdateClick) {
                        Icon(Icons.Default.Edit, "Update")
                    }
                }
            }
        }
    }
}

@Composable
fun StatusChip(status: String) {
    val (backgroundColor, textColor) = when (status) {
        "New" -> Color(0xFF6366F1) to Color.White
        "Interested" -> Color(0xFF10B981) to Color.White
        "Hot" -> Color(0xFFEF4444) to Color.White
        "Follow-up" -> Color(0xFFF59E0B) to Color.White
        "Won" -> Color(0xFF8B5CF6) to Color.White
        "Lost" -> Color(0xFF64748B) to Color.White
        else -> Color.Gray to Color.White
    }
    
    Surface(
        color = backgroundColor,
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            text = status,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            color = textColor,
            style = MaterialTheme.typography.caption
        )
    }
}
```

## 🔄 Data Synchronization

### Offline Support
```kotlin
@Entity(tableName = "leads")
data class LeadEntity(
    @PrimaryKey val id: String,
    val name: String,
    val phone: String,
    val email: String?,
    val status: String,
    val sector: String,
    val region: String,
    val notes: String?,
    val followUpDate: String?,
    val lastSynced: Long = System.currentTimeMillis()
)

@Entity(tableName = "call_logs")
data class CallLogEntity(
    @PrimaryKey val id: String,
    val leadId: String,
    val callStatus: String,
    val notes: String?,
    val callDuration: Int,
    val outcome: String,
    val followUpRequired: Boolean,
    val followUpDate: String?,
    val isSynced: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
```

### Sync Service
```kotlin
class SyncService(private val repository: TeleCRMRepository) {
    suspend fun syncOfflineData() {
        // Sync pending call logs
        val pendingCallLogs = getPendingCallLogs()
        pendingCallLogs.forEach { callLog ->
            try {
                repository.addCallLog(callLog)
                markCallLogAsSynced(callLog.id)
            } catch (e: Exception) {
                // Handle sync error
            }
        }
        
        // Sync lead updates
        val pendingLeadUpdates = getPendingLeadUpdates()
        pendingLeadUpdates.forEach { update ->
            try {
                repository.updateLead(update)
                markLeadUpdateAsSynced(update.leadId)
            } catch (e: Exception) {
                // Handle sync error
            }
        }
    }
}
```

## 🔔 Push Notifications

### Notification Service
```kotlin
class NotificationService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        // Handle different notification types
        when (remoteMessage.data["type"]) {
            "new_lead" -> handleNewLeadNotification(remoteMessage)
            "follow_up_reminder" -> handleFollowUpReminder(remoteMessage)
            "call_reminder" -> handleCallReminder(remoteMessage)
        }
    }
    
    private fun handleNewLeadNotification(remoteMessage: RemoteMessage) {
        val leadId = remoteMessage.data["leadId"]
        val leadName = remoteMessage.data["leadName"]
        
        // Show notification and navigate to lead details
        showNotification(
            title = "New Lead Assigned",
            body = "You have been assigned a new lead: $leadName",
            data = mapOf("leadId" to leadId)
        )
    }
}
```

## 📱 Key Features to Implement

1. **Lead Management**
   - View assigned leads
   - Update lead status and notes
   - Filter leads by status, sector, region
   - Search leads by name, phone, email

2. **Call Management**
   - Log calls with status and notes
   - Record call duration
   - Upload call recordings
   - View call history

3. **Dashboard**
   - Performance metrics
   - Recent activity
   - Upcoming tasks
   - Follow-up reminders

4. **Offline Support**
   - Cache leads locally
   - Queue offline actions
   - Sync when online

5. **Push Notifications**
   - New lead assignments
   - Follow-up reminders
   - Call reminders

## 🚨 Error Handling

```kotlin
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>()
    object Loading : ApiResult<Nothing>()
}

suspend fun <T> safeApiCall(apiCall: suspend () -> T): ApiResult<T> {
    return try {
        ApiResult.Success(apiCall.invoke())
    } catch (e: HttpRequestException) {
        ApiResult.Error("Network error: ${e.message}", e.response.status.value)
    } catch (e: Exception) {
        ApiResult.Error("Unknown error: ${e.message}")
    }
}
```

## 📝 Testing

### Unit Tests
```kotlin
@Test
fun `test lead status update`() = runTest {
    val repository = mockk<TeleCRMRepository>()
    val viewModel = LeadsViewModel(repository)
    
    coEvery { repository.updateLead(any()) } returns Result.success(mockLead)
    
    viewModel.updateLeadStatus("lead_id", "Interested", "Test note")
    
    coVerify { repository.updateLead(any()) }
}
```

### UI Tests
```kotlin
@Test
fun testLeadCardDisplay() {
    composeTestRule.setContent {
        LeadCard(
            lead = testLead,
            onCallClick = {},
            onUpdateClick = {}
        )
    }
    
    composeTestRule.onNodeWithText(testLead.name).assertIsDisplayed()
    composeTestRule.onNodeWithText(testLead.phone).assertIsDisplayed()
}
```

## 🔧 Configuration

### Build Configuration
```kotlin
android {
    compileSdk = 34
    
    defaultConfig {
        applicationId = "com.telecrm.employee"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }
    
    buildFeatures {
        compose = true
    }
    
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.1"
    }
}
```

### Dependencies
```kotlin
dependencies {
    // Ktor client
    implementation("io.ktor:ktor-client-android:2.3.7")
    implementation("io.ktor:ktor-client-json:2.3.7")
    implementation("io.ktor:ktor-client-serialization:2.3.7")
    
    // Compose
    implementation("androidx.compose.ui:ui:1.5.4")
    implementation("androidx.compose.material:material:1.5.4")
    implementation("androidx.compose.ui:ui-tooling-preview:1.5.4")
    
    // ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    
    // Room database
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    
    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-messaging")
}
```

## 📞 Support

For technical support or questions about the API:
- Check the API documentation at `/api-docs`
- Review the server logs for error details
- Contact the backend development team

---

**TeleCRM Employee Mobile App - Built with ❤️ for efficient telecalling operations**
