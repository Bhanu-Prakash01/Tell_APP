require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import middleware
const { errorHandler, notFound, rateLimitHandler } = require('./middleware/errorHandler');
const { httpLogger, bodyLogger, securityHeaderLogger, requestIdMiddleware } = require('./middleware/logger');

// Import routes (will be created in next steps)
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const leadAssignmentRoutes = require('./routes/leadAssignment');
// const customerRoutes = require('./routes/customers');
// const callRoutes = require('./routes/calls');
// const campaignRoutes = require('./routes/campaigns');
// const dashboardRoutes = require('./routes/dashboard');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/uploads');
const employeeRoutes = require('./routes/employee');

// Import logging utilities for application events
const { logger, logAuthEvent, logAppEvent, logSecurityEvent } = require('./utils/logger');
const { auditLogger } = require('./utils/auditLogger');

// Import followup scheduler
const followupScheduler = require('./utils/followupScheduler');

// Create Express app
const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Rate limiting disabled as requested

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS ?
      process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Request ID middleware (must be first to track all requests)
app.use(requestIdMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Compression middleware
app.use(compression());

// Security header validation middleware
app.use(securityHeaderLogger);

// Enhanced logging middleware
app.use(httpLogger);

// Request body logging (only in development or when explicitly enabled)
if (process.env.LOG_REQUEST_BODY === 'true' || process.env.NODE_ENV === 'development') {
  app.use(bodyLogger);
}

// Admin routes - specific routes for admin pages (before static files)
app.get('/admin', (req, res) => {
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/admin/leads', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'leads.html'));
});

app.get('/admin/lead-assignment', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'lead-assignment.html'));
});

app.get('/admin/user-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'user-management.html'));
});

app.get('/admin/apk-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'apk-management.html'));
});

// Static file serving (before API routes to avoid conflicts)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for admin static files (CSS, JS, images, etc.)
app.use('/admin', express.static(path.join(__dirname, 'views')));

// Static file serving (must be after admin routes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Favicon fallback
app.get('/favicon.ico', (req, res) => {
  res.set('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});


// Root route - serve main landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin/users', userRoutes);
app.use('/api/v1/employee', employeeRoutes);
app.use('/api/v1/lead-assignment', leadAssignmentRoutes);
// app.use('/api/v1/customers', customerRoutes);
// app.use('/api/v1/calls', callRoutes);
// app.use('/api/v1/campaigns', campaignRoutes);
// app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// Authenticated upload routes
app.use('/api/v1/uploads', uploadRoutes);
app.get('/api/v1/uploads/apk/latest', async (req, res) => {
  try {
    const APK = require('./models/APK');
    const latestAPK = await APK.findOne().sort({ uploadedAt: -1 });

    if (!latestAPK) {
      return res.status(404).json({
        success: false,
        message: 'No APK available'
      });
    }

    res.json({
      success: true,
      message: 'Latest APK retrieved',
      data: {
        version: latestAPK.version,
        downloadUrl: `/api/v1/uploads/apk/download/${latestAPK.filename}`,
        size: latestAPK.size,
        uploadedAt: latestAPK.uploadedAt
      }
    });
  } catch (error) {
    console.error('Error in getLatestAPK:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve latest APK'
    });
  }
});

app.get('/api/v1/uploads/apk/download/:filename', async (req, res) => {
  try {
    const APK = require('./models/APK');
    const path = require('path');
    const fs = require('fs');

    const { filename } = req.params;
    const apk = await APK.findOne({ filename });

    if (!apk) {
      return res.status(404).json({
        success: false,
        message: 'APK not found'
      });
    }

    const filePath = path.join(__dirname, apk.path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'APK file not found on server'
      });
    }

    res.setHeader('Content-Type', apk.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${apk.originalName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error in downloadAPK:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download APK'
    });
  }
});

app.get('/api/v1/uploads/apk/versions', async (req, res) => {
  try {
    const APK = require('./models/APK');
    const apks = await APK.find()
      .sort({ uploadedAt: -1 })
      .select('version filename size uploadedAt')
      .populate('uploadedBy', 'name');

    res.json({
      success: true,
      message: 'APK versions retrieved',
      data: {
        apks: apks.map(apk => ({
          version: apk.version,
          downloadUrl: `/api/v1/uploads/apk/download/${apk.filename}`,
          size: apk.size,
          uploadedAt: apk.uploadedAt,
          uploadedBy: apk.uploadedBy?.name || 'Unknown'
        })),
        totalCount: apks.length
      }
    });
  } catch (error) {
    console.error('Error in getAPKVersions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve APK versions'
    });
  }
});

// Security monitoring middleware
app.use((err, req, res, next) => {
  // Skip security monitoring for public APK routes
  if (req.path.startsWith('/api/v1/uploads/apk/') && req.method === 'GET') {
    return next(err);
  }

  // Log security-related errors
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    logSecurityEvent('Authentication Error', 'high', {
      error: err.message,
      errorType: err.name,
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
    });

    // Audit failed authentication attempts
    if (req.body && req.body.email) {
      auditLogger.logFailedLogin(req.body.email, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.id,
      });
    }
  }

  // Log rate limiting violations
  if (err.name === 'RateLimitError' || err.message.includes('Too many requests')) {
    logSecurityEvent('Rate Limit Exceeded', 'medium', {
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
    });
  }

  next(err);
});

// Enhanced error logging middleware
app.use((err, req, res, next) => {
  // Skip error logging for public APK routes
  if (req.path.startsWith('/api/v1/uploads/apk/') && req.method === 'GET') {
    return next(err);
  }

  // Log application errors
  logger.error('Unhandled Application Error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    requestId: req.id,
  });

  next(err);
});

// 404 handler - must be after all routes
app.use(notFound);

// Global error handler - must be last
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/telcalling_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error('Shutting down the server due to Uncaught Exception');
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Start followup scheduler
    followupScheduler.start();
    console.log('📅 Followup scheduler started');

    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`
🚀 Telecalling Web Application Started Successfully!
📍 Server: http://localhost:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 API Base URL: http://localhost:${PORT}/api/v1
👨‍💼 Admin Dashboard: http://localhost:${PORT}/admin
📚 API Documentation: http://localhost:${PORT}/api/v1/docs
📅 Followup Scheduler: Running (checks every 5 minutes)
      `);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('✅ HTTP server closed.');

        // Stop followup scheduler
        followupScheduler.stop();
        console.log('✅ Followup scheduler stopped.');

        // Close database connection
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed.');

        console.log('👋 Process terminated gracefully');
        process.exit(0);
      });

      // Force close server after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = app;