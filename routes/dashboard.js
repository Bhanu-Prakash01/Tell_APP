const express = require('express');
const router = express.Router();

// Import controllers (will be created in next step)
const {
  getDashboardOverview,
  getCallAnalytics,
  getAgentPerformance,
  getCustomerInsights,
  getCampaignMetrics,
  getRealTimeStats,
  getReports,
  exportReport,
  getRecentActivity,
  getCharts
} = require('../controllers/dashboardController');

// Import middleware
const { authenticateToken, requireManagerOrAdmin } = require('../middleware/auth');

// Public dashboard routes (for all authenticated users)
router.get('/overview', authenticateToken, getDashboardOverview);
router.get('/real-time-stats', getRealTimeStats);
router.get('/activity', (req, res) => {
  // Simple activity endpoint for all authenticated users
  res.json({
    success: true,
    data: [
      {
        title: 'System Started',
        description: 'Telecalling application started successfully',
        timestamp: new Date().toISOString(),
        icon: '🚀'
      }
    ]
  });
});
router.get('/charts', authenticateToken, getCharts);

// Manager and Admin only routes
router.get('/analytics/calls', requireManagerOrAdmin, getCallAnalytics);
router.get('/performance/agents', requireManagerOrAdmin, getAgentPerformance);
router.get('/insights/customers', requireManagerOrAdmin, getCustomerInsights);
router.get('/metrics/campaigns', requireManagerOrAdmin, getCampaignMetrics);
router.get('/reports', requireManagerOrAdmin, getReports);
router.get('/reports/export/:type', requireManagerOrAdmin, exportReport);

module.exports = router;