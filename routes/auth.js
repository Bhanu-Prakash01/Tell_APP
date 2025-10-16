const express = require('express');
const router = express.Router();
const multer = require('multer');

// Import controllers (will be created in next step)
const {
  register,
  login,
  logout,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

// Import middleware
const { authenticateToken, optionalAuth, requireAdmin, requireEmployee, requireAnyRole } = require('../middleware/auth');

// Configure multer for document uploads (addressProof and signedOfferLetter)
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const documentFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and DOCX files are allowed for documents'), false);
  }
};

const uploadDocuments = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB default for documents
    files: 2 // Maximum 2 files (addressProof and signedOfferLetter)
  }
});

// Public routes
router.post('/register', uploadDocuments.fields([
  { name: 'addressProof', maxCount: 1 },
  { name: 'signedOfferLetter', maxCount: 1 }
]), register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Debug route - only in development
if (process.env.NODE_ENV === 'development') {
  router.get('/debug-users', async (req, res) => {
    try {
      const User = require('../models/User');
      const users = await User.find({}, 'name email role isActive createdAt');
      res.json({
        success: true,
        count: users.length,
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: error.message
      });
    }
  });
}

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);
router.post('/logout', optionalAuth, logout);

// Admin only routes
router.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
  // Placeholder for admin user management
  res.json({ success: true, message: 'Admin users endpoint' });
});

// Employee only routes
router.get('/employee/dashboard', authenticateToken, requireEmployee, (req, res) => {
  // Placeholder for employee dashboard
  res.json({ success: true, message: 'Employee dashboard endpoint' });
});

module.exports = router;