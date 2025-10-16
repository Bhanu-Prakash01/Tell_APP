const express = require('express');
const router = express.Router();

// Import controllers (will be created in next step)
const {
  getAllCalls,
  getCallById,
  createCall,
  updateCall,
  deleteCall,
  getCallsByCustomer,
  getCallsByAgent,
  getCallStats,
  bulkCreateCalls
} = require('../controllers/callController');

// Import middleware
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Public routes (for agents)
router.get('/', getAllCalls);
router.get('/:id', getCallById);
router.post('/', createCall);
router.put('/:id', updateCall);
router.get('/customer/:customerId', getCallsByCustomer);
router.get('/agent/:agentId', getCallsByAgent);

// Manager and Admin only routes
router.delete('/:id', requireManagerOrAdmin, deleteCall);
router.post('/bulk-create', requireManagerOrAdmin, bulkCreateCalls);
router.get('/stats/overview', requireManagerOrAdmin, getCallStats);

module.exports = router;