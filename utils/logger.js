const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors for console output
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` | ${JSON.stringify(meta)}`;
    }

    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` | ${JSON.stringify(meta)}`;
    }

    return log;
  })
);

// Create transports
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info',
  })
);

// File transports with daily rotation
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Combined log file (all levels)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: customFormat,
      level: 'debug',
    })
  );

  // Error log file (error level only)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '60d',
      format: customFormat,
      level: 'error',
    })
  );

  // HTTP requests log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: customFormat,
      level: 'http',
    })
  );

  // Security events log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      format: customFormat,
      level: 'warn',
    })
  );

  // Audit log file (for compliance)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '365d', // Keep audit logs for 1 year
      format: customFormat,
      level: 'info',
    })
  );
}

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: customFormat,
  transports,
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.Console(),
  new DailyRotateFile({
    filename: path.join(logsDir, 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
  })
);

logger.rejections.handle(
  new winston.transports.Console(),
  new DailyRotateFile({
    filename: path.join(logsDir, 'rejections-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
  })
);

// Utility functions for sensitive data masking
const maskSensitiveData = (data) => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveFields = ['password', 'token', 'authorization', 'secret', 'key', 'credit_card', 'ssn'];
  const maskedData = { ...data };

  const maskValue = (value) => {
    if (typeof value === 'string') {
      return value.length > 4 ? value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2) : '*'.repeat(value.length);
    }
    return value;
  };

  const processObject = (obj) => {
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = maskValue(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        processObject(obj[key]);
      }
    }
  };

  processObject(maskedData);
  return maskedData;
};

// Enhanced logging functions
const loggerUtils = {
  // HTTP request logging
  logHttpRequest: (req, res, duration) => {
    const requestData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      body: maskSensitiveData(req.body),
      query: req.query,
      params: req.params,
    };

    if (res.statusCode >= 400) {
      logger.error('HTTP Request Error', requestData);
    } else {
      logger.http('HTTP Request', requestData);
    }
  },

  // Authentication events
  logAuthEvent: (event, userData, additionalData = {}) => {
    const authData = {
      event,
      userId: userData._id || userData.id,
      email: userData.email,
      role: userData.role,
      ip: additionalData.ip,
      userAgent: additionalData.userAgent,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    logger.info(`Authentication Event: ${event}`, maskSensitiveData(authData));
  },

  // Security events
  logSecurityEvent: (event, severity, data) => {
    const securityData = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...data,
    };

    logger.warn(`Security Event: ${event}`, maskSensitiveData(securityData));
  },

  // Application events
  logAppEvent: (event, data = {}) => {
    logger.info(`Application Event: ${event}`, maskSensitiveData(data));
  },

  // Database operations
  logDatabaseOperation: (operation, collection, data = {}) => {
    const dbData = {
      operation,
      collection,
      timestamp: new Date().toISOString(),
      ...data,
    };

    logger.debug('Database Operation', dbData);
  },

  // File operations
  logFileOperation: (operation, filename, data = {}) => {
    const fileData = {
      operation,
      filename,
      timestamp: new Date().toISOString(),
      ...data,
    };

    logger.info('File Operation', fileData);
  },

  // Error logging with context
  logError: (error, context = {}) => {
    const errorData = {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };

    logger.error('Application Error', maskSensitiveData(errorData));
  },

  // Performance monitoring
  logPerformance: (operation, duration, data = {}) => {
    const perfData = {
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...data,
    };

    logger.info('Performance Log', perfData);
  },

  // Business logic events
  logBusinessEvent: (event, entityType, entityId, data = {}) => {
    const businessData = {
      event,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    logger.info(`Business Event: ${event}`, maskSensitiveData(businessData));
  },

  // Admin actions
  logAdminAction: (action, adminUser, targetUser = null, data = {}) => {
    const adminData = {
      action,
      adminUserId: adminUser._id || adminUser.id,
      adminEmail: adminUser.email,
      targetUserId: targetUser ? (targetUser._id || targetUser.id) : null,
      targetUserEmail: targetUser ? targetUser.email : null,
      timestamp: new Date().toISOString(),
      ...data,
    };

    logger.info(`Admin Action: ${action}`, maskSensitiveData(adminData));
  },

  // Lead operations
  logLeadOperation: (operation, leadId, userId, data = {}) => {
    const leadData = {
      operation,
      leadId,
      userId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    logger.info(`Lead Operation: ${operation}`, maskSensitiveData(leadData));
  },

  // Custom log level check
  shouldLog: (level) => {
    return logger.levels[level] <= logger.levels[logger.level];
  },

  // Get current log level
  getLogLevel: () => {
    return logger.level;
  },

  // Set log level dynamically
  setLogLevel: (level) => {
    logger.level = level;
  },

  // Stream for Morgan integration
  stream: {
    write: (message) => {
      logger.http(message.trim());
    },
  },
};

module.exports = {
  logger,
  ...loggerUtils,
  maskSensitiveData,
};