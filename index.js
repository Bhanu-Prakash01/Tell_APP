require('dotenv').config();
require('express-async-errors');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

// Database connection
const connectDB = require('./config/db');

// Swagger documentation
const swagger = require('./swagger');

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const managerRoutes = require('./routes/manager');
const employeeRoutes = require('./routes/employee');
const leadRoutes = require('./routes/leads');
const importExportRoutes = require('./routes/importExport');
const salesPipelineRoutes = require('./routes/salesPipeline');
const mailRoutes = require('./routes/mail');

const app = express();

// Middlewares
app.use(express.json({ limit: '50mb' })); // Increased limit for large payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Handle URL-encoded data
app.use(cors());
app.use(morgan('dev'));

// Swagger API Documentation
app.use('/api-docs', swagger.serve, swagger.setup);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/import-export', importExportRoutes);
app.use('/api/sales-pipelines', salesPipelineRoutes);
app.use('/api/admin/mail', mailRoutes);

// Serve static HTML files from public folder
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Error handler middleware (verbose in development)
app.use((err, req, res, next) => {
    const isProd = process.env.NODE_ENV === 'production';
    const safeHeaders = { ...req.headers };
    if (safeHeaders.authorization) safeHeaders.authorization = '<redacted>';
    const payloadPreview = (()=>{
      try{
        if (req.body && typeof req.body === 'object'){
          const clone = { ...req.body };
          ['password','pass','smtpPass','imapPass'].forEach(k=>{ if (clone[k]) clone[k] = '<redacted>'; });
          return JSON.stringify(clone).slice(0,2000);
        }
        return String(req.body).slice(0,2000);
      }catch(_){ return '<unserializable>' }
    })();
    console.error('⚠️  Express Error:', {
      method: req.method,
      url: req.originalUrl,
      headers: safeHeaders,
      params: req.params,
      query: req.query,
      body: payloadPreview,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack
    });
    res.status(500).json(
      isProd
        ? { error: 'Server error' }
        : { error: 'Server error', name: err.name, message: err.message, stack: err.stack }
    );
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 TeleCRM Server running on port http://localhost:${PORT}`);
      console.log(`📚 API Documentation available at: http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('❌ DB connection failed', err);
    process.exit(1);
  });

// Global process error logging
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
