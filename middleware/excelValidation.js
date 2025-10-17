const excelParser = require('../utils/excelParser');

/**
 * Middleware to set Excel file information and structure info on request object
 * This should be used after file upload middleware
 */
const setExcelFileInfo = (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return next();
    }

    // Set basic file information
    req.excelFileInfo = {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      filename: req.file.filename
    };

    // For memory storage (buffer), we need to analyze the structure
    if (req.file.buffer) {
      // We'll set basic structure info here
      // The detailed structure analysis happens in the controller when parsing
      req.excelStructureInfo = {
        totalRows: 0, // Will be updated during parsing
        columns: 0,   // Will be updated during parsing
        hasHeaders: true
      };
    }

    next();
  } catch (error) {
    console.error('Error setting Excel file info:', error);
    next(error);
  }
};

/**
 * Middleware to validate Excel file before processing
 */
const validateExcelUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate the uploaded file
    excelParser.validateFile(req.file);

    // Set file info if not already set
    if (!req.excelFileInfo) {
      req.excelFileInfo = {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        filename: req.file.filename
      };
    }

    next();
  } catch (error) {
    console.error('Excel validation error:', error);
    res.status(400).json({
      success: false,
      message: 'File validation failed',
      error: error.message
    });
  }
};

/**
 * Middleware for progress tracking setup
 */
const setupProgressTracking = (req, res, next) => {
  // Set up progress callback if SSE is being used
  if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    req.progressCallback = (progressData) => {
      res.write(`data: ${JSON.stringify(progressData)}\n\n`);
    };
  }

  next();
};

module.exports = {
  setExcelFileInfo,
  validateExcelUpload,
  setupProgressTracking
};