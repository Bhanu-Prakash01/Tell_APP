const { logger, logHttpRequest, logSecurityEvent } = require('../utils/logger');

// Security monitoring data
const securityMonitor = {
  failedAttempts: new Map(),
  suspiciousActivities: new Map(),
  rateLimitExceeded: new Map(),
};

// Clean up security monitoring data every hour
setInterval(() => {
  securityMonitor.failedAttempts.clear();
  securityMonitor.suspiciousActivities.clear();
  securityMonitor.rateLimitExceeded.clear();
}, 60 * 60 * 1000);

// HTTP Request Logging Middleware
const httpLogger = (req, res, next) => {
  const startTime = Date.now();

  // Capture original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // Track response data
  let responseBody = null;

  // Override res.send to capture response body
  res.send = function(data) {
    responseBody = data;
    return originalSend.call(this, data);
  };

  // Override res.json to capture response body
  res.json = function(data) {
    responseBody = JSON.stringify(data);
    return originalJson.call(this, data);
  };

  // Override res.end to capture response body for non-json responses
  res.end = function(chunk, encoding) {
    if (chunk && !responseBody) {
      responseBody = chunk.toString();
    }
    return originalEnd.call(this, chunk, encoding);
  };

  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Check for suspicious activity
    checkSuspiciousActivity(req, res, duration);

    // Log the HTTP request
    logHttpRequest(req, res, duration);

    // Log slow requests
    if (duration > 5000) { // 5 seconds threshold
      logger.warn('Slow Request Detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    // Log large response bodies
    if (responseBody && responseBody.length > 1000000) { // 1MB threshold
      logger.warn('Large Response Body', {
        method: req.method,
        url: req.originalUrl,
        responseSize: `${(responseBody.length / 1024 / 1024).toFixed(2)}MB`,
        statusCode: res.statusCode,
      });
    }
  });

  // Log request errors
  res.on('error', (error) => {
    logger.error('Response Error', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
  });

  next();
};

// Check for suspicious activity patterns
const checkSuspiciousActivity = (req, res, duration) => {
  const ip = req.ip;
  const currentTime = Date.now();

  // Check for multiple failed requests
  if (res.statusCode >= 400) {
    const failedAttempts = securityMonitor.failedAttempts.get(ip) || [];
    failedAttempts.push(currentTime);

    // Keep only attempts from last 15 minutes
    const recentFailures = failedAttempts.filter(time => currentTime - time < 15 * 60 * 1000);

    securityMonitor.failedAttempts.set(ip, recentFailures);

    // Alert if too many failures in short time
    if (recentFailures.length >= 10) {
      logSecurityEvent('Multiple Failed Requests', 'high', {
        ip,
        failureCount: recentFailures.length,
        timeWindow: '15 minutes',
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
      });
    }
  }

  // Check for unusually fast requests (potential bot/scanner)
  if (duration < 10 && req.method === 'GET') {
    const fastRequests = securityMonitor.suspiciousActivities.get(ip) || [];
    fastRequests.push(currentTime);

    // Keep only requests from last 5 minutes
    const recentFastRequests = fastRequests.filter(time => currentTime - time < 5 * 60 * 1000);

    securityMonitor.suspiciousActivities.set(ip, recentFastRequests);

    // Alert if too many fast requests
    if (recentFastRequests.length >= 50) {
      logSecurityEvent('Suspicious Fast Requests', 'medium', {
        ip,
        fastRequestCount: recentFastRequests.length,
        timeWindow: '5 minutes',
        userAgent: req.get('User-Agent'),
      });
    }
  }

  // Check for potential DoS attempts (very slow requests)
  if (duration > 30000) { // 30 seconds
    logSecurityEvent('Unusually Slow Request', 'medium', {
      ip,
      duration: `${duration}ms`,
      url: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
  }
};

// Request body logging middleware (for debugging)
const bodyLogger = (req, res, next) => {
  // Only log body in development or when specifically enabled
  if (process.env.LOG_REQUEST_BODY === 'true' || process.env.NODE_ENV === 'development') {
    if (req.body && Object.keys(req.body).length > 0) {
      logger.debug('Request Body', {
        method: req.method,
        url: req.originalUrl,
        body: req.body, // This will be masked by the logger utility
      });
    }
  }
  next();
};

// Database query logging middleware
const queryLogger = (req, res, next) => {
  // Store original mongoose methods if available
  if (req.app.locals.mongoose) {
    const mongoose = req.app.locals.mongoose;

    // Log database operations
    const originalExec = mongoose.Query.prototype.exec;
    mongoose.Query.prototype.exec = function() {
      const startTime = Date.now();
      const collection = this.model?.modelName || 'Unknown';
      const operation = this.op || 'unknown';

      logger.debug('Database Query Started', {
        collection,
        operation,
        conditions: this.getQuery ? this.getQuery() : {},
      });

      return originalExec.apply(this, arguments).then(
        (result) => {
          const duration = Date.now() - startTime;
          logger.debug('Database Query Completed', {
            collection,
            operation,
            duration: `${duration}ms`,
            resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
          });
          return result;
        },
        (error) => {
          const duration = Date.now() - startTime;
          logger.error('Database Query Error', {
            collection,
            operation,
            error: error.message,
            duration: `${duration}ms`,
          });
          throw error;
        }
      );
    };
  }

  next();
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  // Log performance metrics on response
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
    };

    // Log slow endpoints
    if (duration > 1000) { // 1 second threshold
      logger.warn('Slow Endpoint Detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration.toFixed(2)}ms`,
        memoryDiff,
        statusCode: res.statusCode,
      });
    }

    // Log memory spikes
    if (memoryDiff.heapUsed > 50 * 1024 * 1024) { // 50MB threshold
      logger.warn('Memory Spike Detected', {
        method: req.method,
        url: req.originalUrl,
        memoryDiff,
        totalHeapUsed: `${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      });
    }
  });

  next();
};

// Security headers validation middleware
const securityHeaderLogger = (req, res, next) => {
  const missingHeaders = [];
  const requiredHeaders = [
    'user-agent',
    'accept',
    'accept-language',
    'accept-encoding',
  ];

  // Check for missing common headers that might indicate bot/scanner activity
  requiredHeaders.forEach(header => {
    if (!req.get(header)) {
      missingHeaders.push(header);
    }
  });

  // Log suspicious requests with missing headers
  if (missingHeaders.length >= 2) {
    logSecurityEvent('Suspicious Request - Missing Headers', 'low', {
      ip: req.ip,
      missingHeaders,
      url: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent') || 'Not provided',
    });
  }

  next();
};

// API usage tracking middleware
const usageTracker = (req, res, next) => {
  // Track API endpoint usage
  const endpoint = `${req.method} ${req.baseUrl}${req.route?.path || req.path}`;
  const userId = req.user?.id || req.user?._id || 'anonymous';
  const role = req.user?.role || 'anonymous';

  // Log API usage for analytics
  logger.info('API Usage', {
    endpoint,
    userId,
    role,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error('Unhandled Error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
  });

  next(err);
};

// Request ID middleware for tracking
const requestIdMiddleware = (req, res, next) => {
  req.id = require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

module.exports = {
  httpLogger,
  bodyLogger,
  queryLogger,
  performanceMonitor,
  securityHeaderLogger,
  usageTracker,
  errorLogger,
  requestIdMiddleware,
  securityMonitor,
};