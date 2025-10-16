const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  excelUpload,
  handleUploadError,
  deleteUploadedFiles,
  setFileSizeLimit
} = require('../middleware/fileUpload');

// Import admin controller
const adminController = require('../controllers/adminController');


// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Lead assignment routes with Excel upload
router.post('/assign/:employeeId', [
  setFileSizeLimit(parseInt(process.env.EXCEL_MAX_FILE_SIZE) || 10485760),
  (req, res, next) => {
    // Use the Excel upload middleware for lead assignment
    excelUpload.single('excelFile')(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  }
], adminController.uploadAndAssignLeads);

module.exports = router;