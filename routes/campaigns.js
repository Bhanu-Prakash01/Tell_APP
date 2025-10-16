const express = require('express');
const router = express.Router();

// Import controllers (will be created in next step)
const {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaignStatus,
  getCampaignStats,
  assignCustomersToCampaign,
  getCampaignCustomers
} = require('../controllers/campaignController');

// Import middleware
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Public routes (for agents)
router.get('/', getAllCampaigns);
router.get('/:id', getCampaignById);
router.get('/:id/customers', getCampaignCustomers);

// Manager and Admin only routes
router.post('/', requireManagerOrAdmin, createCampaign);
router.put('/:id', requireManagerOrAdmin, updateCampaign);
router.delete('/:id', requireManagerOrAdmin, deleteCampaign);
router.patch('/:id/toggle-status', requireManagerOrAdmin, toggleCampaignStatus);
router.get('/stats/overview', requireManagerOrAdmin, getCampaignStats);
router.post('/:id/assign-customers', requireManagerOrAdmin, assignCustomersToCampaign);

module.exports = router;