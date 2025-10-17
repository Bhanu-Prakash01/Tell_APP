const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');
const { excelUpload, handleUploadError } = require('../middleware/fileUpload');
const { setExcelFileInfo, validateExcelUpload, setupProgressTracking } = require('../middleware/excelValidation');

// Import admin controller
const adminController = require('../controllers/adminController');


// Apply authentication to all admin routes
router.use(authenticateToken);

// Allow all authenticated users to access admin routes
router.use(requireAnyRole);

// Dashboard routes
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/charts', adminController.getChartData);
router.get('/dashboard/activity', adminController.getRecentActivity);

// Leads management routes
router.get('/leads', adminController.getAllLeads);

router.get('/leads/:id', adminController.getLeadById);

router.post('/leads/assign', adminController.assignLeads);

router.put('/leads/:id', adminController.updateLead);

router.delete('/leads/:id', adminController.deleteLead);

// Bulk operations routes
router.delete('/leads/bulk-delete', adminController.bulkDeleteLeads);

// Lead assignment routes
router.get('/employees', adminController.getAllEmployees);

// Employee assignments routes
router.get('/assignments/:employeeId', adminController.getEmployeeAssignments);

// Get all lead assignments (for admin dashboard)
router.get('/lead-assignments', adminController.getAllLeadAssignments);

// Excel upload and parsing routes
router.post('/leads/upload-assign/:employeeId',
  excelUpload.single('excel'),
  handleUploadError,
  setExcelFileInfo,
  adminController.uploadAndAssignLeads
);

router.post('/leads/preview',
  excelUpload.single('excel'),
  handleUploadError,
  setExcelFileInfo,
  adminController.previewExcelFile
);

router.post('/leads/bulk-upload',
  excelUpload.single('excel'),
  handleUploadError,
  setExcelFileInfo,
  adminController.bulkUploadLeads
);

router.get('/leads/parsing-report/:uploadId', adminController.getExcelParsingReport);

// Progress tracking route for large file uploads
router.post('/leads/upload-progress/:employeeId',
  excelUpload.single('excel'),
  handleUploadError,
  adminController.uploadAndAssignLeads
);

// Call time statistics route
router.get('/call-time-stats', adminController.getCallTimeStats);

// Export leads data
router.get('/leads/export', adminController.exportLeads);

// User password change route
router.put('/users/:userId/password', adminController.changeUserPassword);

module.exports = router;