const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

// Ensure upload directories exist
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
};

// File filter function for security
const fileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    // Check MIME type
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
    }
  };
};

// Storage configuration with secure naming
const createStorage = (destination) => {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await ensureDirectoryExists(destination);
        cb(null, destination);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      // Generate secure filename with UUID and original extension
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${uuidv4()}${fileExtension}`;
      cb(null, uniqueName);
    }
  });
};

// Document upload middleware (for employee registration)
const documentUpload = multer({
  storage: createStorage(process.env.DOC_UPLOAD_PATH || 'uploads/documents/'),
  limits: {
    fileSize: parseInt(process.env.DOC_MAX_FILE_SIZE) || 5242880, // 5MB default
    files: 10 // Maximum 10 files for multiple documents
  },
  fileFilter: fileFilter([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ])
});

// Excel upload middleware (for lead assignment) - using memory storage for buffer access
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.EXCEL_MAX_FILE_SIZE) || 10485760, // 10MB default
    files: 1 // Single file for Excel upload
  },
  fileFilter: fileFilter([
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.template.macroEnabled.12'
  ])
});

// General file upload middleware (configurable)
const generalFileUpload = (options = {}) => {
  const {
    destination = 'uploads/general/',
    maxFileSize = 10485760, // 10MB default
    maxFiles = 5,
    allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]
  } = options;

  return multer({
    storage: createStorage(destination),
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    },
    fileFilter: fileFilter(allowedTypes)
  });
};

// Error handling middleware for multer errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large',
        error: `File size exceeds the maximum limit of ${Math.round(error.field ? req.fileSizeLimit : (process.env.MAX_FILE_SIZE || 10485760) / 1024 / 1024)}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files',
        error: 'Maximum number of files exceeded'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field',
        error: 'File field not expected'
      });
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type',
      error: error.message
    });
  }

  // Log unexpected errors for debugging
  console.error('File upload error:', error);
  res.status(500).json({
    success: false,
    message: 'File upload failed',
    error: 'An unexpected error occurred during file upload'
  });
};

// Utility function to delete uploaded files (for cleanup on errors)
const deleteUploadedFiles = async (files) => {
  if (!files) return;

  const filesToDelete = Array.isArray(files) ? files : [files];

  for (const file of filesToDelete) {
    try {
      if (file.path) {
        await fs.unlink(file.path);
      }
    } catch (error) {
      console.error('Error deleting file:', file.path, error);
    }
  }
};

// Middleware to add file size limit to request for error reporting
const setFileSizeLimit = (limit) => {
  return (req, res, next) => {
    req.fileSizeLimit = limit;
    next();
  };
};

module.exports = {
  documentUpload,
  excelUpload,
  generalFileUpload,
  handleUploadError,
  deleteUploadedFiles,
  setFileSizeLimit,
  ensureDirectoryExists
};