const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import controllers (will be created in next step)
const {
  uploadFile,
  uploadMultipleFiles,
  getFile,
  deleteFile,
  getUserFiles,
  importExcelData,
  exportData
} = require('../controllers/uploadController');

// Import middleware
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');
const { fileUploadErrorHandler } = require('../middleware/errorHandler');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/csv'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
    files: 10 // Maximum 10 files at once
  }
});

// Error handler for multer
router.use(fileUploadErrorHandler);

// All routes require authentication
router.use(authenticateToken);

// File upload routes
router.post('/single', upload.single('file'), uploadFile);
router.post('/multiple', upload.array('files', 10), uploadMultipleFiles);

// File management routes
router.get('/:filename', getFile);
router.delete('/:filename', deleteFile);
router.get('/user/files', getUserFiles);

// Data import/export routes (Manager/Admin only)
router.post('/import/excel', requireManagerOrAdmin, upload.single('file'), importExcelData);
router.get('/export/:type', requireManagerOrAdmin, exportData);

module.exports = router;