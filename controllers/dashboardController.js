const { AppError, asyncHandler } = require('../middleware/errorHandler');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');

// @desc    Get dashboard overview stats
// @route   GET /api/v1/dashboard/overview
// @access  Private
const getDashboardOverview = asyncHandler(async (req, res) => {
  try {
    // Get basic stats
    const [totalUsers, totalLeads, activeLeads, completedLeads, pendingLeads] = await Promise.all([
      User.countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: { $in: ['New', 'Hot', 'Interested'] } }),
      Lead.countDocuments({ status: 'Converted' }),
      Lead.countDocuments({ status: { $in: ['New', 'Hot', 'Interested'] } })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalLeads,
        activeLeads,
        completedLeads,
        pendingLeads
      }
    });
  } catch (error) {
    console.error('Error getting dashboard overview:', error);
    throw new AppError('Failed to load dashboard overview', 500);
  }
});

// @desc    Get real-time stats
// @route   GET /api/v1/dashboard/real-time-stats
// @access  Private
const getRealTimeStats = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayLeads, todayUsers, recentActivity] = await Promise.all([
      Lead.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: today } }),
      Lead.find({ createdAt: { $gte: today } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name status createdAt')
    ]);

    res.json({
      success: true,
      data: {
        todayLeads,
        todayUsers,
        recentActivity: recentActivity.map(lead => ({
          title: `New lead: ${lead.name}`,
          description: `Status: ${lead.status}`,
          timestamp: lead.createdAt,
          icon: '📞'
        }))
      }
    });
  } catch (error) {
    console.error('Error getting real-time stats:', error);
    throw new AppError('Failed to load real-time stats', 500);
  }
});

// @desc    Get call analytics data
// @route   GET /api/v1/dashboard/analytics/calls
// @access  Private (Manager/Admin only)
const getCallAnalytics = asyncHandler(async (req, res) => {
  try {
    // Placeholder for call analytics
    // This would integrate with your call tracking system
    res.json({
      success: true,
      data: {
        totalCalls: 0,
        successfulCalls: 0,
        averageCallDuration: 0,
        callTrends: []
      }
    });
  } catch (error) {
    console.error('Error getting call analytics:', error);
    throw new AppError('Failed to load call analytics', 500);
  }
});

// @desc    Get agent performance data
// @route   GET /api/v1/dashboard/performance/agents
// @access  Private (Manager/Admin only)
const getAgentPerformance = asyncHandler(async (req, res) => {
  try {
    // Get agent performance metrics
    const agentStats = await User.aggregate([
      {
        $match: { role: 'Employee' }
      },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'assignedLeads'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          totalLeads: { $size: '$assignedLeads' },
          convertedLeads: {
            $size: {
              $filter: {
                input: '$assignedLeads',
                cond: { $eq: ['$$this.status', 'Converted'] }
              }
            }
          },
          conversionRate: {
            $cond: [
              { $eq: [{ $size: '$assignedLeads' }, 0] },
              0,
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$assignedLeads',
                            cond: { $eq: ['$$this.status', 'Converted'] }
                          }
                        }
                      },
                      { $size: '$assignedLeads' }
                    ]
                  },
                  100
                ]
              }
            ]
          }
        }
      },
      {
        $sort: { conversionRate: -1 }
      }
    ]);

    res.json({
      success: true,
      data: agentStats
    });
  } catch (error) {
    console.error('Error getting agent performance:', error);
    throw new AppError('Failed to load agent performance', 500);
  }
});

// @desc    Get customer insights data
// @route   GET /api/v1/dashboard/insights/customers
// @access  Private (Manager/Admin only)
const getCustomerInsights = asyncHandler(async (req, res) => {
  try {
    // Get customer/lead insights
    const insights = await Lead.aggregate([
      {
        $group: {
          _id: '$company',
          count: { $sum: 1 },
          statuses: { $push: '$status' }
        }
      },
      {
        $project: {
          company: '$_id',
          totalLeads: '$count',
          _id: 0
        }
      },
      {
        $sort: { totalLeads: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Error getting customer insights:', error);
    throw new AppError('Failed to load customer insights', 500);
  }
});

// @desc    Get campaign metrics data
// @route   GET /api/v1/dashboard/metrics/campaigns
// @access  Private (Manager/Admin only)
const getCampaignMetrics = asyncHandler(async (req, res) => {
  try {
    // Get campaign metrics
    const campaignStats = await Campaign.aggregate([
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'campaign',
          as: 'leads'
        }
      },
      {
        $project: {
          name: 1,
          totalLeads: { $size: '$leads' },
          convertedLeads: {
            $size: {
              $filter: {
                input: '$leads',
                cond: { $eq: ['$$this.status', 'Converted'] }
              }
            }
          },
          conversionRate: {
            $cond: [
              { $eq: [{ $size: '$leads' }, 0] },
              0,
              {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$leads',
                            cond: { $eq: ['$$this.status', 'Converted'] }
                          }
                        }
                      },
                      { $size: '$leads' }
                    ]
                  },
                  100
                ]
              }
            ]
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: campaignStats
    });
  } catch (error) {
    console.error('Error getting campaign metrics:', error);
    throw new AppError('Failed to load campaign metrics', 500);
  }
});

// @desc    Get chart data for dashboard
// @route   GET /api/v1/dashboard/charts
// @access  Private
const getCharts = asyncHandler(async (req, res) => {
  try {
    const { chartType, days = 7 } = req.query;

    switch (chartType) {
      case 'statusDistribution':
        return await getStatusDistribution(req, res);
      case 'assignmentDistribution':
        return await getAssignmentDistribution(req, res);
      case 'dailyTrend':
        return await getDailyTrend(req, res, days);
      case 'sectorDistribution':
        return await getSectorDistribution(req, res);
      default:
        throw new AppError('Invalid chart type', 400);
    }
  } catch (error) {
    console.error('Error getting chart data:', error);
    throw error;
  }
});

// @desc    Get lead status distribution
// @route   GET /api/v1/dashboard/charts?chartType=statusDistribution
// @access  Private
const getStatusDistribution = asyncHandler(async (req, res) => {
  try {
    const statusData = await Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: statusData
    });
  } catch (error) {
    console.error('Error getting status distribution:', error);
    throw new AppError('Failed to load status distribution', 500);
  }
});

// @desc    Get lead assignment distribution
// @route   GET /api/v1/dashboard/charts?chartType=assignmentDistribution
// @access  Private
const getAssignmentDistribution = asyncHandler(async (req, res) => {
  try {
    const assignmentData = await User.aggregate([
      {
        $match: { role: 'Employee' }
      },
      {
        $lookup: {
          from: 'leads',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'leads'
        }
      },
      {
        $project: {
          _id: '$name',
          count: { $size: '$leads' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: assignmentData
    });
  } catch (error) {
    console.error('Error getting assignment distribution:', error);
    throw new AppError('Failed to load assignment distribution', 500);
  }
});

// @desc    Get daily lead creation trend
// @route   GET /api/v1/dashboard/charts?chartType=dailyTrend&days=7
// @access  Private
const getDailyTrend = asyncHandler(async (req, res, days) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trendData = await Lead.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json({
      success: true,
      data: trendData
    });
  } catch (error) {
    console.error('Error getting daily trend:', error);
    throw new AppError('Failed to load daily trend', 500);
  }
});

// @desc    Get sector distribution
// @route   GET /api/v1/dashboard/charts?chartType=sectorDistribution
// @access  Private
const getSectorDistribution = asyncHandler(async (req, res) => {
  try {
    const sectorData = await Lead.aggregate([
      {
        $group: {
          _id: '$sector',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: sectorData
    });
  } catch (error) {
    console.error('Error getting sector distribution:', error);
    throw new AppError('Failed to load sector distribution', 500);
  }
});

// @desc    Get recent activity
// @route   GET /api/v1/dashboard/activity
// @access  Private
const getActivity = asyncHandler(async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const activities = await Lead.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('name status createdAt')
      .populate('assignedTo', 'name');

    const formattedActivities = activities.map(lead => ({
      title: `New lead: ${lead.name}`,
      description: `Status: ${lead.status}${lead.assignedTo ? ` | Assigned to: ${lead.assignedTo.name}` : ''}`,
      timestamp: lead.createdAt,
      icon: '📞'
    }));

    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    console.error('Error getting recent activity:', error);
    throw new AppError('Failed to load recent activity', 500);
  }
});

// @desc    Get reports data
// @route   GET /api/v1/dashboard/reports
// @access  Private (Manager/Admin only)
const getReports = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Placeholder for reports functionality
    res.json({
      success: true,
      data: {
        reports: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting reports:', error);
    throw new AppError('Failed to load reports', 500);
  }
});

// @desc    Export report
// @route   GET /api/v1/dashboard/reports/export/:type
// @access  Private (Manager/Admin only)
const exportReport = asyncHandler(async (req, res) => {
  try {
    const { type } = req.params;

    // Placeholder for export functionality
    res.json({
      success: true,
      message: `Report export for ${type} initiated`,
      data: {
        downloadUrl: null,
        status: 'processing'
      }
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    throw new AppError('Failed to export report', 500);
  }
});

module.exports = {
  getDashboardOverview,
  getCallAnalytics,
  getAgentPerformance,
  getCustomerInsights,
  getCampaignMetrics,
  getRealTimeStats,
  getCharts,
  getActivity,
  getReports,
  exportReport
};