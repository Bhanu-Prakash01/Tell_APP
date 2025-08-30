# 🚀 TeleCRM - SIM-Based Calling CRM System

A comprehensive Customer Relationship Management system designed specifically for telecalling operations with SIM-based calling features, elegant UI, and powerful analytics.

## ✨ Features

### 🎯 **Core CRM Features**
- **Lead Management**: Complete lead lifecycle from creation to conversion
- **Campaign Management**: Multi-channel marketing campaigns with A/B testing
- **Team Management**: Hierarchical structure (Admin → Manager → Employee)
- **Performance Analytics**: Real-time metrics and reporting

### 📱 **SIM-Based Calling System**
- **SIM Card Management**: Track multiple SIM cards with balance monitoring
- **Call Analytics**: Comprehensive call tracking and quality metrics
- **Call Recording**: Audio recording storage and management
- **Network Monitoring**: Signal strength and network type tracking

### 🎨 **Beautiful Dracula Night Theme**
- **Dark Mode**: Easy on the eyes for long working sessions
- **Modern UI**: Gradient backgrounds, glowing effects, and smooth animations
- **Responsive Design**: Works perfectly on all devices
- **Professional Appearance**: Suitable for client presentations

### 📊 **Advanced Analytics**
- **Lead Scoring**: AI-powered lead prioritization
- **Performance Metrics**: Team and individual performance tracking
- **Call Analytics**: Success rates, duration analysis, and quality metrics
- **Sales Forecasting**: Predictive analytics for business growth

## 🏗️ System Architecture

```
TeleCRM/
├── 📁 config/          # Database configuration
├── 📁 controllers/     # Business logic controllers
├── 📁 middleware/      # Authentication & authorization
├── 📁 models/          # Database models & schemas
├── 📁 public/          # Frontend HTML/CSS/JS
├── 📁 routes/          # API endpoints
└── 📁 index.js         # Main server file
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB database
- Modern web browser

### Installation

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
   Create a `.env` file in the root directory:
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

## 👥 User Roles & Permissions

### 🔐 **Admin**
- Full system access
- User management (create managers/employees)
- SIM card management
- System-wide analytics
- Campaign oversight

### 👨‍💼 **Manager**
- Team management
- Lead assignment and tracking
- Performance monitoring
- Campaign creation
- Team analytics

### 👷 **Employee**
- Lead management
- Call logging
- Recording uploads
- Performance tracking
- Follow-up scheduling

## 📱 SIM Management Features

### **SIM Card Tracking**
- Multiple carrier support (Airtel, Jio, Vodafone, BSNL, MTNL)
- Balance monitoring and alerts
- Validity tracking
- Usage analytics

### **Call Quality Monitoring**
- Signal strength tracking
- Network type detection (2G/3G/4G/5G)
- Audio quality assessment
- Call success rate analysis

### **Automated Features**
- Low balance alerts
- Validity expiry notifications
- Auto-recharge options
- Usage pattern analysis

## 📊 Analytics & Reporting

### **Lead Analytics**
- Status distribution by sector and region
- Hot vs. Interested lead comparisons
- Conversion rate tracking
- Lead scoring algorithms

### **Call Analytics**
- Success rate by employee
- Call duration patterns
- Quality metrics
- Cost analysis

### **Performance Metrics**
- Team efficiency scores
- Individual performance tracking
- Sales forecasting
- ROI calculations

## 🔌 API Endpoints

### **Admin Routes** (`/api/admin`)
- `GET /managers` - Get all managers
- `POST /managers` - Create new manager
- `GET /employees` - Get all employees
- `POST /employees` - Create new employee
- `GET /leads/analytics` - Lead analytics
- `GET /campaigns/analytics` - Campaign analytics
- `GET /sims` - SIM card status
- `GET /calls/analytics` - Call analytics
- `GET /performance/dashboard` - Performance metrics

### **Manager Routes** (`/api/manager`)
- `GET /team` - Get team members
- `GET /team/performance` - Team performance
- `GET /leads` - Get team leads
- `POST /leads` - Create new lead
- `PUT /leads/:id` - Update lead
- `GET /calls/analytics` - Team call analytics
- `GET /dashboard` - Manager dashboard
- `GET /reports/performance` - Performance reports

### **Employee Routes** (`/api/employee`)
- `GET /leads` - Get assigned leads
- `PUT /update-lead` - Update lead status
- `POST /call-log` - Log call details
- `GET /my-call-logs` - Get call history

## 🎨 UI Components

### **Dracula Theme Features**
- Dark color scheme with purple accents
- Gradient backgrounds and borders
- Glowing effects and shadows
- Smooth hover animations
- Custom scrollbars

### **Responsive Design**
- Mobile-first approach
- Adaptive layouts
- Touch-friendly interfaces
- Cross-browser compatibility

## 📈 Performance Features

### **Real-time Updates**
- Live dashboard updates
- Real-time notifications
- Instant data refresh
- WebSocket support (planned)

### **Data Optimization**
- Efficient database queries
- Caching strategies
- Lazy loading
- Pagination support

## 🔒 Security Features

### **Authentication**
- JWT-based authentication
- Role-based access control
- Secure password hashing
- Session management

### **Data Protection**
- Input validation
- SQL injection prevention
- XSS protection
- CSRF protection

## 🚀 Deployment

### **Production Setup**
1. Set environment variables
2. Configure MongoDB connection
3. Set up reverse proxy (Nginx)
4. Configure SSL certificates
5. Set up monitoring and logging

### **Docker Support** (Coming Soon)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 📝 Development

### **Code Style**
- ES6+ JavaScript
- Async/await patterns
- Consistent error handling
- Comprehensive logging

### **Testing** (Coming Soon)
- Unit tests with Jest
- Integration tests
- API endpoint testing
- UI component testing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Future Roadmap

### **Phase 2 Features**
- AI-powered lead scoring
- Advanced call analytics
- Mobile app development
- Integration with external CRM systems

### **Phase 3 Features**
- Machine learning insights
- Predictive analytics
- Advanced reporting
- Multi-tenant support

---

**Built with ❤️ for modern telecalling operations**

*TeleCRM - Transforming the way you manage customer relationships through intelligent calling solutions.*
