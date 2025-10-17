const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Lead = require('../models/Lead');
const User = require('../models/User');

// @desc    Upload single file
// @route   POST /api/v1/uploads/single
// @access  Private
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    }
  });
});

// @desc    Upload multiple files
// @route   POST /api/v1/uploads/multiple
// @access  Private
const uploadMultipleFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('No files uploaded', 400);
  }

  const filesData = req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    path: file.path
  }));

  res.json({
    success: true,
    message: `${req.files.length} files uploaded successfully`,
    data: {
      files: filesData,
      totalCount: req.files.length
    }
  });
});

// @desc    Get file by filename
// @route   GET /api/v1/uploads/:filename
// @access  Private
const getFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // In a real implementation, you would serve the file from storage
  // For now, return file information
  res.json({
    success: true,
    message: 'File information retrieved',
    data: {
      filename,
      message: 'File serving not implemented in this demo'
    }
  });
});

// @desc    Delete file by filename
// @route   DELETE /api/v1/uploads/:filename
// @access  Private
const deleteFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // In a real implementation, you would delete the file from storage
  res.json({
    success: true,
    message: `File ${filename} deleted successfully`
  });
});

// @desc    Get user's uploaded files
// @route   GET /api/v1/uploads/user/files
// @access  Private
const getUserFiles = asyncHandler(async (req, res) => {
  // In a real implementation, you would query user's files from database
  res.json({
    success: true,
    message: 'User files retrieved',
    data: {
      files: [],
      message: 'File tracking not implemented in this demo'
    }
  });
});

// @desc    Import Excel data (generic)
// @route   POST /api/v1/uploads/import/excel
// @access  Private (Manager/Admin only)
// Note: This is a generic import function. For lead-specific imports, use /api/v1/admin/leads/bulk-upload
const importExcelData = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Excel file is required', 400);
  }

  res.json({
    success: true,
    message: 'Excel import initiated',
    data: {
      filename: req.file.originalname,
      size: req.file.size,
      message: 'Use /api/v1/admin/leads/bulk-upload for lead imports'
    }
  });
});

// @desc    Export data
// @route   GET /api/v1/uploads/export/:type
// @access  Private (Manager/Admin only)
// Note: This is a generic export function. For lead-specific exports, use /api/v1/admin/leads/export
const exportData = asyncHandler(async (req, res) => {
  const { type } = req.params;

  res.json({
    success: true,
    message: `${type} export initiated`,
    data: {
      exportType: type,
      message: 'Use /api/v1/admin/leads/export for lead exports'
    }
  });
});

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  getFile,
  deleteFile,
  getUserFiles,
  importExcelData,
  exportData
};