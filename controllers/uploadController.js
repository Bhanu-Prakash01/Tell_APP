const { AppError, asyncHandler } = require('../middleware/errorHandler');
const Lead = require('../models/Lead');
const User = require('../models/User');
const APK = require('../models/APK');
const path = require('path');
const fs = require('fs');

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

// @desc    Upload APK file
// @route   POST /api/v1/uploads/apk
// @access  Private (Manager/Admin only)
const uploadAPK = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No APK file uploaded', 400);
  }

  const { version } = req.body;
  if (!version) {
    throw new AppError('APK version is required', 400);
  }

  // Check if version already exists
  const existingAPK = await APK.findOne({ version });
  if (existingAPK) {
    throw new AppError(`APK version ${version} already exists`, 409);
  }

  // Create APK record
  const apk = await APK.create({
    version,
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
    mimetype: req.file.mimetype,
    uploadedBy: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'APK uploaded successfully',
    data: {
      id: apk._id,
      version: apk.version,
      filename: apk.filename,
      size: apk.size,
      uploadedAt: apk.uploadedAt
    }
  });
});

// @desc    Get latest APK version and download link
// @route   GET /api/v1/uploads/apk/latest
// @access  Public
const getLatestAPK = async (req, res) => {
  try {
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
};

// @desc    Download APK file
// @route   GET /api/v1/uploads/apk/download/:filename
// @access  Public
const downloadAPK = async (req, res) => {
  try {
    const { filename } = req.params;

    const apk = await APK.findOne({ filename });
    if (!apk) {
      return res.status(404).json({
        success: false,
        message: 'APK not found'
      });
    }

    const filePath = path.join(__dirname, '..', apk.path);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'APK file not found on server'
      });
    }

    // Set headers for download
    res.setHeader('Content-Type', apk.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${apk.originalName}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error in downloadAPK:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download APK'
    });
  }
};

// @desc    Get all APK versions
// @route   GET /api/v1/uploads/apk/versions
// @access  Public
const getAPKVersions = async (req, res) => {
  try {
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
};

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  getFile,
  deleteFile,
  getUserFiles,
  importExcelData,
  exportData,
  uploadAPK,
  getLatestAPK,
  downloadAPK,
  getAPKVersions
};