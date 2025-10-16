const express = require('express');
const router = express.Router();

// Import controllers (will be created in next step)
const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  importCustomers,
  exportCustomers,
  getCustomerStats
} = require('../controllers/customerController');

// Import middleware
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Public routes (for agents)
router.get('/search', searchCustomers);
router.get('/', getAllCustomers);
router.get('/:id', getCustomerById);

// Manager and Admin only routes
router.post('/', requireManagerOrAdmin, createCustomer);
router.put('/:id', requireManagerOrAdmin, updateCustomer);
router.delete('/:id', requireManagerOrAdmin, deleteCustomer);
router.post('/import', requireManagerOrAdmin, importCustomers);
router.get('/export/csv', requireManagerOrAdmin, exportCustomers);
router.get('/stats/overview', requireManagerOrAdmin, getCustomerStats);

module.exports = router;