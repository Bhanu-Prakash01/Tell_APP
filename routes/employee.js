const express = require('express');
const router = express.Router();

// Import controllers
const {
  login,
  register,
  getProfile,
  getTodayLeads,
  updateLead
} = require('../controllers/employeeController');

// Import middleware
const { authenticateToken, requireEmployee } = require('../middleware/auth');
const {
  documentUpload,
  handleUploadError,
  deleteUploadedFiles,
  setFileSizeLimit
} = require('../middleware/fileUpload');

// Public routes
router.post('/login', login);

// Employee registration with document upload
router.post('/register',
  setFileSizeLimit(parseInt(process.env.DOC_MAX_FILE_SIZE) || 5242880),
  (req, res, next) => {
    // Use the document upload middleware for addressProof and signedOfferLetter
    documentUpload.fields([
      { name: 'addressProof', maxCount: 1 },
      { name: 'signedOfferLetter', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  },
  register
);

// Protected routes (require employee authentication)
router.use(authenticateToken); // All routes below require authentication
router.use(requireEmployee); // All routes below require employee role

router.get('/profile', getProfile);
router.get('/leads/today', getTodayLeads);
router.put('/leads/update/:id', updateLead);

module.exports = router;