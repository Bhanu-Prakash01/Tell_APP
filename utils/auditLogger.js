const { logger, maskSensitiveData } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

// In-memory audit trail for quick access (in production, use Redis or database)
const auditTrail = new Map();
const AUDIT_RETENTION_DAYS = 90;

// Clean up old audit entries daily
setInterval(() => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_DAYS);

  for (const [key, entries] of auditTrail.entries()) {
    const filteredEntries = entries.filter(entry => new Date(entry.timestamp) > cutoffDate);
    if (filteredEntries.length === 0) {
      auditTrail.delete(key);
    } else {
      auditTrail.set(key, filteredEntries);
    }
  }
}, 24 * 60 * 60 * 1000); // Daily cleanup

// Audit event types
const AUDIT_EVENTS = {
  // Authentication events
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // User management events
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',

  // Lead management events
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_UPDATED: 'LEAD_UPDATED',
  LEAD_DELETED: 'LEAD_DELETED',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_STATUS_CHANGED: 'LEAD_STATUS_CHANGED',
  LEAD_BULK_UPDATED: 'LEAD_BULK_UPDATED',

  // Admin actions
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_LOGOUT: 'ADMIN_LOGOUT',
  ADMIN_CONFIG_CHANGED: 'ADMIN_CONFIG_CHANGED',
  ADMIN_BULK_OPERATION: 'ADMIN_BULK_OPERATION',
  ADMIN_USER_MANAGEMENT: 'ADMIN_USER_MANAGEMENT',

  // Data operations
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_IMPORT: 'DATA_IMPORT',
  DATA_BACKUP: 'DATA_BACKUP',
  DATA_PURGE: 'DATA_PURGE',

  // Security events
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',

  // File operations
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_DOWNLOADED: 'FILE_DOWNLOADED',
  FILE_DELETED: 'FILE_DELETED',

  // Campaign operations
  CAMPAIGN_CREATED: 'CAMPAIGN_CREATED',
  CAMPAIGN_UPDATED: 'CAMPAIGN_UPDATED',
  CAMPAIGN_DELETED: 'CAMPAIGN_DELETED',
  CAMPAIGN_ACTIVATED: 'CAMPAIGN_ACTIVATED',
  CAMPAIGN_DEACTIVATED: 'CAMPAIGN_DEACTIVATED',
};

// Audit logger class
class AuditLogger {
  constructor() {
    this.auditFile = path.join(__dirname, '../logs/audit-trail.json');
    this.initializeAuditFile();
  }

  async initializeAuditFile() {
    try {
      await fs.access(this.auditFile);
    } catch (error) {
      // Create audit file if it doesn't exist
      await fs.writeFile(this.auditFile, JSON.stringify([]));
    }
  }

  // Core audit logging method
  async log(eventType, user, action, details = {}, metadata = {}) {
    const auditEntry = {
      id: require('crypto').randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      user: {
        id: user._id || user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      action,
      details: maskSensitiveData(details),
      metadata: {
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        sessionId: metadata.sessionId,
        requestId: metadata.requestId,
        ...metadata,
      },
      compliance: {
        retentionUntil: new Date(Date.now() + AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        category: this.getComplianceCategory(eventType),
        severity: this.getSeverityLevel(eventType),
      },
    };

    // Log to Winston
    logger.info(`AUDIT: ${eventType}`, maskSensitiveData(auditEntry));

    // Store in memory for quick access
    this.storeInMemory(auditEntry);

    // Store in file for persistence
    await this.storeInFile(auditEntry);

    return auditEntry.id;
  }

  // Store audit entry in memory
  storeInMemory(entry) {
    const userId = entry.user.id;
    if (!auditTrail.has(userId)) {
      auditTrail.set(userId, []);
    }

    const userEntries = auditTrail.get(userId);
    userEntries.push(entry);

    // Keep only last 1000 entries per user
    if (userEntries.length > 1000) {
      userEntries.splice(0, userEntries.length - 1000);
    }
  }

  // Store audit entry in file
  async storeInFile(entry) {
    try {
      const data = await fs.readFile(this.auditFile, 'utf8');
      const entries = JSON.parse(data);
      entries.push(entry);

      // Keep only last 10000 entries in file
      if (entries.length > 10000) {
        entries.splice(0, entries.length - 10000);
      }

      await fs.writeFile(this.auditFile, JSON.stringify(entries, null, 2));
    } catch (error) {
      logger.error('Failed to write audit entry to file', { error: error.message, entry: entry.id });
    }
  }

  // Get compliance category for audit event
  getComplianceCategory(eventType) {
    const categories = {
      [AUDIT_EVENTS.USER_LOGIN]: 'Authentication',
      [AUDIT_EVENTS.USER_LOGOUT]: 'Authentication',
      [AUDIT_EVENTS.USER_LOGIN_FAILED]: 'Security',
      [AUDIT_EVENTS.PASSWORD_CHANGED]: 'Authentication',
      [AUDIT_EVENTS.PASSWORD_RESET]: 'Authentication',
      [AUDIT_EVENTS.USER_CREATED]: 'User Management',
      [AUDIT_EVENTS.USER_UPDATED]: 'User Management',
      [AUDIT_EVENTS.USER_DELETED]: 'User Management',
      [AUDIT_EVENTS.USER_ROLE_CHANGED]: 'Authorization',
      [AUDIT_EVENTS.USER_STATUS_CHANGED]: 'User Management',
      [AUDIT_EVENTS.LEAD_CREATED]: 'Business Data',
      [AUDIT_EVENTS.LEAD_UPDATED]: 'Business Data',
      [AUDIT_EVENTS.LEAD_DELETED]: 'Business Data',
      [AUDIT_EVENTS.LEAD_ASSIGNED]: 'Business Process',
      [AUDIT_EVENTS.LEAD_STATUS_CHANGED]: 'Business Process',
      [AUDIT_EVENTS.LEAD_BULK_UPDATED]: 'Business Data',
      [AUDIT_EVENTS.ADMIN_LOGIN]: 'Authentication',
      [AUDIT_EVENTS.ADMIN_LOGOUT]: 'Authentication',
      [AUDIT_EVENTS.ADMIN_CONFIG_CHANGED]: 'System Configuration',
      [AUDIT_EVENTS.ADMIN_BULK_OPERATION]: 'Business Data',
      [AUDIT_EVENTS.ADMIN_USER_MANAGEMENT]: 'User Management',
      [AUDIT_EVENTS.DATA_EXPORT]: 'Data Handling',
      [AUDIT_EVENTS.DATA_IMPORT]: 'Data Handling',
      [AUDIT_EVENTS.DATA_BACKUP]: 'Data Handling',
      [AUDIT_EVENTS.DATA_PURGE]: 'Data Handling',
      [AUDIT_EVENTS.SECURITY_VIOLATION]: 'Security',
      [AUDIT_EVENTS.UNAUTHORIZED_ACCESS]: 'Security',
      [AUDIT_EVENTS.SUSPICIOUS_ACTIVITY]: 'Security',
      [AUDIT_EVENTS.FILE_UPLOADED]: 'File Management',
      [AUDIT_EVENTS.FILE_DOWNLOADED]: 'File Management',
      [AUDIT_EVENTS.FILE_DELETED]: 'File Management',
      [AUDIT_EVENTS.CAMPAIGN_CREATED]: 'Business Data',
      [AUDIT_EVENTS.CAMPAIGN_UPDATED]: 'Business Data',
      [AUDIT_EVENTS.CAMPAIGN_DELETED]: 'Business Data',
      [AUDIT_EVENTS.CAMPAIGN_ACTIVATED]: 'Business Process',
      [AUDIT_EVENTS.CAMPAIGN_DEACTIVATED]: 'Business Process',
    };

    return categories[eventType] || 'General';
  }

  // Get severity level for audit event
  getSeverityLevel(eventType) {
    const severityLevels = {
      [AUDIT_EVENTS.USER_LOGIN_FAILED]: 'high',
      [AUDIT_EVENTS.SECURITY_VIOLATION]: 'high',
      [AUDIT_EVENTS.UNAUTHORIZED_ACCESS]: 'high',
      [AUDIT_EVENTS.SUSPICIOUS_ACTIVITY]: 'medium',
      [AUDIT_EVENTS.USER_DELETED]: 'high',
      [AUDIT_EVENTS.USER_ROLE_CHANGED]: 'high',
      [AUDIT_EVENTS.ADMIN_CONFIG_CHANGED]: 'medium',
      [AUDIT_EVENTS.DATA_PURGE]: 'high',
      [AUDIT_EVENTS.LEAD_BULK_UPDATED]: 'medium',
      [AUDIT_EVENTS.ADMIN_BULK_OPERATION]: 'medium',
    };

    return severityLevels[eventType] || 'low';
  }

  // Specific audit logging methods for common operations
  async logUserLogin(user, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.USER_LOGIN,
      user,
      'User logged in',
      { loginMethod: 'standard' },
      metadata
    );
  }

  async logUserLogout(user, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.USER_LOGOUT,
      user,
      'User logged out',
      {},
      metadata
    );
  }

  async logFailedLogin(email, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.USER_LOGIN_FAILED,
      { email }, // Anonymous user object for failed attempts
      'Failed login attempt',
      { email },
      metadata
    );
  }

  async logPasswordChange(user, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.PASSWORD_CHANGED,
      user,
      'Password changed',
      {},
      metadata
    );
  }

  async logUserCreation(createdUser, createdBy, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.USER_CREATED,
      createdBy,
      'User account created',
      {
        createdUserId: createdUser._id,
        createdUserEmail: createdUser.email,
        createdUserRole: createdUser.role,
      },
      metadata
    );
  }

  async logUserUpdate(updatedUser, updatedBy, changes, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.USER_UPDATED,
      updatedBy,
      'User account updated',
      {
        updatedUserId: updatedUser._id,
        updatedUserEmail: updatedUser.email,
        changes: changes,
      },
      metadata
    );
  }

  async logUserDeletion(deletedUser, deletedBy, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.USER_DELETED,
      deletedBy,
      'User account deleted',
      {
        deletedUserId: deletedUser._id,
        deletedUserEmail: deletedUser.email,
        deletedUserRole: deletedUser.role,
      },
      metadata
    );
  }

  async logLeadCreation(lead, createdBy, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.LEAD_CREATED,
      createdBy,
      'Lead created',
      {
        leadId: lead._id,
        leadName: lead.name,
        leadPhone: lead.phone,
        leadEmail: lead.email,
      },
      metadata
    );
  }

  async logLeadUpdate(lead, updatedBy, changes, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.LEAD_UPDATED,
      updatedBy,
      'Lead updated',
      {
        leadId: lead._id,
        leadName: lead.name,
        changes: changes,
      },
      metadata
    );
  }

  async logLeadAssignment(lead, assignedBy, assignedTo, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.LEAD_ASSIGNED,
      assignedBy,
      'Lead assigned',
      {
        leadId: lead._id,
        leadName: lead.name,
        assignedToId: assignedTo._id,
        assignedToEmail: assignedTo.email,
      },
      metadata
    );
  }

  async logAdminAction(admin, action, target, details, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.ADMIN_USER_MANAGEMENT,
      admin,
      action,
      {
        targetUserId: target?._id,
        targetUserEmail: target?.email,
        ...details,
      },
      metadata
    );
  }

  async logDataExport(user, exportType, recordCount, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.DATA_EXPORT,
      user,
      'Data exported',
      {
        exportType,
        recordCount,
        format: metadata.format || 'unknown',
      },
      metadata
    );
  }

  async logFileUpload(user, file, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.FILE_UPLOADED,
      user,
      'File uploaded',
      {
        fileName: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        purpose: metadata.purpose,
      },
      metadata
    );
  }

  async logSecurityViolation(violationType, details, metadata = {}) {
    return await this.log(
      AUDIT_EVENTS.SECURITY_VIOLATION,
      { id: 'system', email: 'system', role: 'system' },
      violationType,
      details,
      metadata
    );
  }

  // Query audit trail
  async getUserAuditTrail(userId, options = {}) {
    const {
      startDate,
      endDate,
      eventTypes,
      limit = 100,
      offset = 0
    } = options;

    let entries = auditTrail.get(userId) || [];

    // Apply filters
    if (startDate) {
      entries = entries.filter(entry => new Date(entry.timestamp) >= new Date(startDate));
    }

    if (endDate) {
      entries = entries.filter(entry => new Date(entry.timestamp) <= new Date(endDate));
    }

    if (eventTypes && eventTypes.length > 0) {
      entries = entries.filter(entry => eventTypes.includes(entry.eventType));
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    return entries.slice(offset, offset + limit);
  }

  // Get audit statistics
  async getAuditStats(userId, days = 30) {
    const entries = auditTrail.get(userId) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEntries = entries.filter(entry => new Date(entry.timestamp) >= cutoffDate);

    const stats = {
      totalEvents: recentEntries.length,
      eventsByType: {},
      eventsByCategory: {},
      eventsBySeverity: { low: 0, medium: 0, high: 0 },
      dailyBreakdown: {},
    };

    recentEntries.forEach(entry => {
      // Count by event type
      stats.eventsByType[entry.eventType] = (stats.eventsByType[entry.eventType] || 0) + 1;

      // Count by category
      stats.eventsByCategory[entry.compliance.category] = (stats.eventsByCategory[entry.compliance.category] || 0) + 1;

      // Count by severity
      stats.eventsBySeverity[entry.compliance.severity]++;

      // Daily breakdown
      const date = entry.timestamp.split('T')[0];
      stats.dailyBreakdown[date] = (stats.dailyBreakdown[date] || 0) + 1;
    });

    return stats;
  }

  // Search audit trail
  async searchAuditTrail(searchCriteria, options = {}) {
    const {
      userId,
      searchTerm,
      eventTypes,
      categories,
      severity,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = searchCriteria;

    let entries = [];

    // Collect entries from relevant users
    if (userId) {
      entries = auditTrail.get(userId) || [];
    } else {
      // Search across all users
      for (const userEntries of auditTrail.values()) {
        entries.push(...userEntries);
      }
    }

    // Apply filters
    if (startDate) {
      entries = entries.filter(entry => new Date(entry.timestamp) >= new Date(startDate));
    }

    if (endDate) {
      entries = entries.filter(entry => new Date(entry.timestamp) <= new Date(endDate));
    }

    if (eventTypes && eventTypes.length > 0) {
      entries = entries.filter(entry => eventTypes.includes(entry.eventType));
    }

    if (categories && categories.length > 0) {
      entries = entries.filter(entry => categories.includes(entry.compliance.category));
    }

    if (severity) {
      entries = entries.filter(entry => entry.compliance.severity === severity);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      entries = entries.filter(entry =>
        entry.action.toLowerCase().includes(term) ||
        entry.details && JSON.stringify(entry.details).toLowerCase().includes(term) ||
        entry.user.email.toLowerCase().includes(term) ||
        entry.user.name && entry.user.name.toLowerCase().includes(term)
      );
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    return entries.slice(offset, offset + limit);
  }

  // Export audit trail for compliance
  async exportAuditTrail(userId, format = 'json', options = {}) {
    const entries = await this.getUserAuditTrail(userId, { ...options, limit: 10000 });

    switch (format) {
      case 'csv':
        return this.convertToCSV(entries);
      case 'json':
      default:
        return JSON.stringify(entries, null, 2);
    }
  }

  // Convert audit entries to CSV format
  convertToCSV(entries) {
    if (entries.length === 0) return '';

    const headers = [
      'Timestamp',
      'Event Type',
      'User Email',
      'User Role',
      'Action',
      'Details',
      'IP Address',
      'Category',
      'Severity'
    ];

    const csvRows = [
      headers.join(','),
      ...entries.map(entry => [
        entry.timestamp,
        entry.eventType,
        entry.user.email,
        entry.user.role,
        `"${entry.action}"`,
        `"${JSON.stringify(entry.details).replace(/"/g, '""')}"`,
        entry.metadata.ip || '',
        entry.compliance.category,
        entry.compliance.severity
      ].join(','))
    ];

    return csvRows.join('\n');
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

module.exports = {
  auditLogger,
  AUDIT_EVENTS,
};