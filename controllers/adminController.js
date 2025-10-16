const User = require('../models/User');
const Lead = require('../models/Lead');
const excelParser = require('../utils/excelParser');
const chartUtils = require('../utils/charts');
const callTimeUtils = require('../utils/callTimeUtils');

// Dashboard statistics controller
const getDashboardStats = async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get list of users with basic info
    const users = await User.find({}, 'name email role createdAt').sort({ createdAt: -1 });

    // Get total leads count
    const totalLeads = await Lead.countDocuments();

    // Get active leads (New or Hot)
    const activeLeads = await Lead.countDocuments({
      status: { $in: ['New', 'Hot'] }
    });

    // Get completed leads (Interested)
    const completedLeads = await Lead.countDocuments({
      status: 'Interested'
    });

    // Get pending leads (Not Interested or unassigned)
    const pendingLeads = await Lead.countDocuments({
      $or: [
        { status: 'Not Interested' },
        { assignedTo: 'Unassigned' }
      ]
    });

    // Get leads by status breakdown
    const leadsByStatus = await Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get call time statistics for dashboard
    const dashboardCallTimeStats = await Lead.aggregate([
      {
        $match: {
          callTime: { $exists: true, $ne: null, $ne: '' },
          assignedTo: { $ne: 'Unassigned' }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          totalLeads: { $sum: 1 },
          totalCallTime: { $sum: { $cond: ['$callTime', 1, 0] } },
          completedLeads: {
            $sum: { $cond: ['$status', { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }, 0] }
          },
          avgCallTime: { $avg: { $cond: ['$callTime', 1, 0] } }
        }
      },
      {
        $sort: { totalLeads: -1 }
      }
    ]);

    // Get leads by assignment breakdown
    const leadsByAssignment = await Lead.aggregate([
      {
        $group: {
          _id: '$assignedTo',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get recent leads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentLeads = await Lead.find(
      { createdAt: { $gte: sevenDaysAgo } },
      'name phone status assignedTo callTime createdAt'
    ).sort({ createdAt: -1 });

    // Get call time statistics
    const callTimeStats = await callTimeUtils.getCallTimeStats(Lead);

    // Calculate overall call time metrics
    const totalCallTimeSeconds = callTimeStats.reduce((sum, stat) => sum + callTimeUtils.durationToSeconds(stat.totalCallTime), 0);
    const totalCompletedCalls = callTimeStats.reduce((sum, stat) => sum + stat.completedLeads, 0);

    const stats = {
      totalUsers,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      })),
      totalLeads,
      activeLeads,
      completedLeads,
      pendingLeads,
      leadsByStatus,
      leadsByAssignment,
      callTimeStats: dashboardCallTimeStats,
      totalCallTime: callTimeUtils.secondsToDuration(totalCallTimeSeconds),
      totalCompletedCalls,
      averageCallTime: callTimeStats.length > 0 ?
        callTimeUtils.secondsToDuration(Math.round(totalCallTimeSeconds / callTimeStats.length)) : '0s',
      recentLeads: recentLeads.map(lead => ({
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        callTime: lead.callTime,
        assignedTo: lead.assignedTo,
        createdAt: lead.createdAt
      }))
    };

    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
      error: error.message
    });
  }
};

// Get chart data for dashboard charts
const getChartData = async (req, res) => {
  try {
    const { chartType, days = 7 } = req.query;

    switch (chartType) {
      case 'dailyTrend':
        return await getDailyTrendData(req, res);
      case 'sectorDistribution':
        return await getSectorDistributionData(req, res);
      case 'assignmentDistribution':
        return await getAssignmentDistributionData(req, res);
      case 'statusDistribution':
        return await getStatusDistributionData(req, res);
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid chart type specified'
        });
    }
  } catch (error) {
    console.error('Error in getChartData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chart data',
      error: error.message
    });
  }
};

// Get daily lead creation trend data
const getDailyTrendData = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate leads by day
    const dailyData = await Lead.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Fill in missing dates with 0 count
    const trendData = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const existingData = dailyData.find(item => item._id === dateKey);

      trendData.push({
        date: dateKey,
        count: existingData ? existingData.count : 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(200).json({
      success: true,
      message: 'Daily trend data retrieved successfully',
      data: trendData
    });

  } catch (error) {
    console.error('Error in getDailyTrendData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve daily trend data',
      error: error.message
    });
  }
};

// Get sector-wise lead distribution data
const getSectorDistributionData = async (req, res) => {
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
      },
      {
        $match: {
          _id: { $ne: null, $ne: '' }
        }
      }
    ]);

    // Filter out empty sectors and limit to top 10
    const filteredData = sectorData
      .filter(item => item._id && item._id.trim() !== '')
      .slice(0, 10);

    res.status(200).json({
      success: true,
      message: 'Sector distribution data retrieved successfully',
      data: filteredData
    });

  } catch (error) {
    console.error('Error in getSectorDistributionData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sector distribution data',
      error: error.message
    });
  }
};

// Get lead assignment distribution data
const getAssignmentDistributionData = async (req, res) => {
  try {
    const assignmentData = await Lead.aggregate([
      {
        $group: {
          _id: '$assignedTo',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Filter out unassigned and limit to top 10 employees
    const filteredData = assignmentData
      .filter(item => item._id && item._id !== 'Unassigned')
      .slice(0, 10);

    res.status(200).json({
      success: true,
      message: 'Assignment distribution data retrieved successfully',
      data: filteredData
    });

  } catch (error) {
    console.error('Error in getAssignmentDistributionData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assignment distribution data',
      error: error.message
    });
  }
};

// Get lead status distribution data
const getStatusDistributionData = async (req, res) => {
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

    res.status(200).json({
      success: true,
      message: 'Status distribution data retrieved successfully',
      data: statusData
    });

  } catch (error) {
    console.error('Error in getStatusDistributionData:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve status distribution data',
      error: error.message
    });
  }
};

// Get recent activity data
const getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Get recent user registrations
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name email role createdAt');

    // Get recent lead assignments
    const recentAssignments = await Lead.find({
      assignedTo: { $ne: 'Unassigned' },
      assignedDate: { $exists: true }
    })
      .sort({ assignedDate: -1 })
      .limit(limit)
      .select('name assignedTo assignedDate status');

    // Get recent status updates (leads updated in last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentStatusUpdates = await Lead.find({
      updatedAt: { $gte: oneDayAgo }
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('name status updatedAt');

    // Combine and sort all activities
    const activities = [];

    // Add user registrations
    recentUsers.forEach(user => {
      activities.push({
        type: 'user_registration',
        title: `New user registered: ${user.name}`,
        description: `Role: ${user.role}`,
        timestamp: user.createdAt,
        icon: '👤'
      });
    });

    // Add lead assignments
    recentAssignments.forEach(lead => {
      activities.push({
        type: 'lead_assignment',
        title: `Lead assigned: ${lead.name}`,
        description: `Assigned to: ${lead.assignedTo}`,
        timestamp: lead.assignedDate,
        icon: '📋'
      });
    });

    // Add status updates
    recentStatusUpdates.forEach(lead => {
      activities.push({
        type: 'status_update',
        title: `Lead status updated: ${lead.name}`,
        description: `New status: ${lead.status}`,
        timestamp: lead.updatedAt,
        icon: '🔄'
      });
    });

    // Sort by timestamp and limit results
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    res.status(200).json({
      success: true,
      message: 'Recent activity retrieved successfully',
      data: limitedActivities
    });

  } catch (error) {
    console.error('Error in getRecentActivity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent activity',
      error: error.message
    });
  }
};

// Get all leads with filtering and pagination
const getAllLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit,
      status,
      assignedTo,
      sector,
      location,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    if (sector) {
      filter.sector = { $regex: sector, $options: 'i' };
    }

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get leads with pagination
    let leadsQuery = Lead.find(filter).sort(sort);
    
    // Apply pagination only if limit is specified
    if (limit) {
      leadsQuery = leadsQuery.skip(skip).limit(limitNum);
    }
    
    const leads = await leadsQuery;

    // Get total count for pagination
    const total = await Lead.countDocuments(filter);

    // Get unique values for filter dropdowns
    const statusOptions = await Lead.distinct('status');
    const assignedToOptions = await Lead.distinct('assignedTo');
    const sectorOptions = await Lead.distinct('sector');
    const locationOptions = await Lead.distinct('location');

    res.status(200).json({
      success: true,
      message: 'Leads retrieved successfully',
      data: {
        leads: leads.map(lead => ({
          id: lead._id,
          name: lead.name,
          phone: lead.phone,
          website: lead.website,
          location: lead.location,
          sector: lead.sector,
          status: lead.status,
          notes: lead.notes,
          callTime: lead.callTime,
          assignedTo: lead.assignedTo,
          assignedDate: lead.assignedDate,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: limit ? Math.ceil(total / limitNum) : 1,
          totalLeads: total,
          hasNextPage: limit ? skip + limitNum < total : false,
          hasPrevPage: limit ? parseInt(page) > 1 : false
        },
        filters: {
          statusOptions,
          assignedToOptions,
          sectorOptions,
          locationOptions
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllLeads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leads',
      error: error.message
    });
  }
};

// Get specific lead details
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lead retrieved successfully',
      data: {
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        description: lead.description,
        website: lead.website,
        location: lead.location,
        sector: lead.sector,
        status: lead.status,
        notes: lead.notes,
        callTime: lead.callTime,
        assignedTo: lead.assignedTo,
        assignedDate: lead.assignedDate,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt
      }
    });

  } catch (error) {
    console.error('Error in getLeadById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead',
      error: error.message
    });
  }
};

// Assign leads to employees
const assignLeads = async (req, res) => {
  try {
    const { leadIds, employeeId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Lead IDs array is required'
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    // Verify employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (employee.role !== 'Employee') {
      return res.status(400).json({
        success: false,
        message: 'Can only assign leads to employees'
      });
    }

    // Update leads assignment
    const result = await Lead.updateMany(
      { _id: { $in: leadIds } },
      {
        assignedTo: employee.name,
        assignedDate: new Date()
      }
    );

    // Log the assignment action
    console.log(`Admin ${req.user.name} assigned ${result.modifiedCount} leads to ${employee.name}`);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} leads assigned successfully`,
      data: {
        assignedCount: result.modifiedCount,
        employeeName: employee.name,
        leadIds: leadIds
      }
    });

  } catch (error) {
    console.error('Error in assignLeads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign leads',
      error: error.message
    });
  }
};

// Update lead information
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;

    const lead = await Lead.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Log the update action
    console.log(`Admin ${req.user.name} updated lead: ${lead.name}`);

    res.status(200).json({
      success: true,
      message: 'Lead updated successfully',
      data: {
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        description: lead.description,
        website: lead.website,
        location: lead.location,
        sector: lead.sector,
        status: lead.status,
        notes: lead.notes,
        callTime: lead.callTime,
        assignedTo: lead.assignedTo,
        assignedDate: lead.assignedDate,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt
      }
    });

  } catch (error) {
    console.error('Error in updateLead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lead',
      error: error.message
    });
  }
};

// Delete lead
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findByIdAndDelete(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Log the deletion action
    console.log(`Admin ${req.user.name} deleted lead: ${lead.name}`);

    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully',
      data: {
        id: lead._id,
        name: lead.name
      }
    });

  } catch (error) {
    console.error('Error in deleteLead:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lead',
      error: error.message
    });
  }
};

// Get all employees for assignment
const getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find(
      { role: 'Employee' },
      'name email role createdAt'
    ).sort({ name: 1 });

    // Get lead statistics for each employee
    const employeesWithStats = await Promise.all(employees.map(async (employee) => {
      // Count active leads (New or Hot status) for this employee
      const activeLeads = await Lead.countDocuments({
        assignedTo: employee.name,
        status: { $in: ['New', 'Hot'] }
      });

      // Count completed leads (Interested status) for this employee
      const completedLeads = await Lead.countDocuments({
        assignedTo: employee.name,
        status: 'Interested'
      });

      return {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: 'General', // Default department since it doesn't exist in User model
        activeLeads: activeLeads,
        completedLeads: completedLeads,
        createdAt: employee.createdAt
      };
    }));

    res.status(200).json({
      success: true,
      message: 'Employees retrieved successfully',
      data: employeesWithStats
    });

  } catch (error) {
    console.error('Error in getAllEmployees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve employees',
      error: error.message
    });
  }
};

// Upload and assign leads from Excel file with enhanced parsing
const uploadAndAssignLeads = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required'
      });
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    // Verify employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (employee.role !== 'Employee') {
      return res.status(400).json({
        success: false,
        message: 'Can only assign leads to employees'
      });
    }

    // Parse Excel file using the new parser utility
    const parseOptions = {
      skipDuplicates: true,
      validateData: true,
      batchSize: req.optimizationSettings?.batchSize || 1000,
      progressCallback: req.progressCallback || null
    };

    const parseResult = await excelParser.parseExcelFile(req.file, parseOptions);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to parse Excel file',
        error: parseResult.error || 'Unknown parsing error'
      });
    }

    const { leads, summary, errors, duplicates } = parseResult.data;

    // Check if we have any valid leads to insert
    if (leads.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid leads found in Excel file',
        data: {
          summary,
          errors,
          duplicates
        }
      });
    }

    // Assign leads to employee
    const leadsToInsert = leads.map(lead => ({
      ...lead,
      assignedTo: employee.name,
      assignedDate: new Date()
    }));

    // Insert leads into database in batches for better performance
    const insertedLeads = await Lead.insertMany(leadsToInsert);

    // Generate parsing report
    const report = excelParser.generateReport(parseResult);

    // Log the bulk assignment action
    console.log(`Admin ${req.user.name} uploaded and assigned ${insertedLeads.length} leads to ${employee.name} from ${req.excelFileInfo.originalName}`);

    res.status(200).json({
      success: true,
      message: `${insertedLeads.length} leads uploaded and assigned successfully`,
      data: {
        assignedCount: insertedLeads.length,
        employeeName: employee.name,
        fileInfo: req.excelFileInfo,
        structureInfo: req.excelStructureInfo,
        summary,
        report,
        leads: insertedLeads.map(lead => ({
          id: lead._id,
          name: lead.name,
          phone: lead.phone,
          status: lead.status,
          assignedTo: lead.assignedTo
        }))
      }
    });

  } catch (error) {
    console.error('Error in uploadAndAssignLeads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload and assign leads',
      error: error.message
    });
  }
};

// Get all lead assignments (for admin dashboard)
const getAllLeadAssignments = async (req, res) => {
  try {
    const {
      page = 1,
      limit,
      status,
      employee,
      startDate,
      endDate
    } = req.query;

    // Build filter for assignments
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (employee) {
      filter.assignedTo = { $regex: employee, $options: 'i' };
    }

    if (startDate || endDate) {
      filter.assignedDate = {};
      if (startDate) filter.assignedDate.$gte = new Date(startDate);
      if (endDate) filter.assignedDate.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * (limit ? parseInt(limit) : 0);
    const limitNum = limit ? parseInt(limit) : 0;

    // Get assignments with pagination
    let assignmentsQuery = Lead.find(filter).sort({ assignedDate: -1 });
    
    // Apply pagination only if limit is specified
    if (limit) {
      assignmentsQuery = assignmentsQuery.skip(skip).limit(limitNum);
    }
    
    const assignments = await assignmentsQuery;

    // Get total count
    const total = await Lead.countDocuments(filter);

    // Get unique employees for filter dropdown
    const employeeOptions = await Lead.distinct('assignedTo');

    res.status(200).json({
      success: true,
      message: 'Lead assignments retrieved successfully',
      data: {
        assignments: assignments.map(lead => ({
          id: lead._id,
          name: lead.name,
          phone: lead.phone,
          website: lead.website,
          location: lead.location,
          sector: lead.sector,
          status: lead.status,
          callTime: lead.callTime,
          assignedTo: lead.assignedTo,
          assignedDate: lead.assignedDate,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: limit ? Math.ceil(total / limitNum) : 1,
          totalAssignments: total,
          hasNextPage: limit ? skip + limitNum < total : false,
          hasPrevPage: limit ? parseInt(page) > 1 : false
        },
        filters: {
          employeeOptions
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllLeadAssignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lead assignments',
      error: error.message
    });
  }
};

// Get previous assignments for employee
const getEmployeeAssignments = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Verify employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const {
      page = 1,
      limit,
      status,
      startDate,
      endDate
    } = req.query;

    // Build filter for assignments
    const filter = { assignedTo: employee.name };

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.assignedDate = {};
      if (startDate) filter.assignedDate.$gte = new Date(startDate);
      if (endDate) filter.assignedDate.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * (limit ? parseInt(limit) : 0);
    const limitNum = limit ? parseInt(limit) : 0;

    // Get assignments with pagination
    let assignmentsQuery = Lead.find(filter).sort({ assignedDate: -1 });
    
    // Apply pagination only if limit is specified
    if (limit) {
      assignmentsQuery = assignmentsQuery.skip(skip).limit(limitNum);
    }
    
    const assignments = await assignmentsQuery;

    // Get total count
    const total = await Lead.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: 'Employee assignments retrieved successfully',
      data: {
        employee: {
          id: employee._id,
          name: employee.name,
          email: employee.email
        },
        assignments: assignments.map(lead => ({
          id: lead._id,
          name: lead.name,
          phone: lead.phone,
          website: lead.website,
          location: lead.location,
          sector: lead.sector,
          status: lead.status,
          callTime: lead.callTime,
          assignedDate: lead.assignedDate,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: limit ? Math.ceil(total / limitNum) : 1,
          totalAssignments: total,
          hasNextPage: limit ? skip + limitNum < total : false,
          hasPrevPage: limit ? parseInt(page) > 1 : false
        }
      }
    });

  } catch (error) {
    console.error('Error in getEmployeeAssignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve employee assignments',
      error: error.message
    });
  }
};

// Preview Excel file data before import
const previewExcelFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required for preview'
      });
    }

    // Parse Excel file with preview options (first 10 rows only)
    const parseResult = await excelParser.parseExcelFile(req.file, {
      skipDuplicates: false, // Don't check duplicates for preview
      validateData: true,
      batchSize: 10, // Only process first 10 rows for preview
      progressCallback: null
    });

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to parse Excel file for preview',
        error: parseResult.error || 'Unknown parsing error'
      });
    }

    const { leads, summary, errors, duplicates } = parseResult.data;

    // Generate preview report
    const report = excelParser.generateReport(parseResult);

    res.status(200).json({
      success: true,
      message: 'Excel file preview generated successfully',
      data: {
        fileInfo: req.excelFileInfo,
        structureInfo: req.excelStructureInfo,
        preview: {
          sampleLeads: leads.slice(0, 5), // Show first 5 leads
          totalAvailable: summary.parsedLeads,
          errors: errors.slice(0, 5), // Show first 5 errors
          duplicates: duplicates.slice(0, 5), // Show first 5 duplicates
          summary,
          report
        }
      }
    });

  } catch (error) {
    console.error('Error in previewExcelFile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview Excel file',
      error: error.message
    });
  }
};

// Get Excel parsing report for a specific upload
const getExcelParsingReport = async (req, res) => {
  try {
    const { uploadId } = req.params;

    // In a real implementation, you might want to store parsing reports
    // For now, we'll return a placeholder response
    res.status(200).json({
      success: true,
      message: 'Parsing report retrieved successfully',
      data: {
        uploadId,
        report: {
          fileSummary: {
            totalRows: 0,
            successfullyParsed: 0,
            errors: 0,
            duplicates: 0,
            successRate: '0%'
          },
          errors: [],
          duplicates: [],
          columnMapping: {},
          detectedHeaders: []
        }
      }
    });

  } catch (error) {
    console.error('Error in getExcelParsingReport:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve parsing report',
      error: error.message
    });
  }
};

// Bulk upload leads without assignment (for later assignment)
const bulkUploadLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required'
      });
    }

    // Initialize progress tracking
    const totalRows = req.excelStructureInfo?.totalRows || 0;
    const progressCallback = req.progressCallback;
    let processedRows = 0;

    // Send initial progress
    if (progressCallback) {
      progressCallback({
        stage: 'parsing',
        processed: 0,
        total: totalRows,
        percentage: 0,
        message: 'Starting file parsing...',
        duplicates: 0,
        errors: 0
      });
    }

    // Parse Excel file with progress tracking
    const parseOptions = {
      skipDuplicates: true,
      validateData: true,
      batchSize: req.optimizationSettings?.batchSize || 1000,
      progressCallback: null // We'll handle progress manually
    };

    const parseResult = await excelParser.parseExcelFile(req.file, parseOptions);

    if (!parseResult.success) {
      if (progressCallback) {
        progressCallback({
          stage: 'error',
          processed: 0,
          total: totalRows,
          percentage: 0,
          message: 'Failed to parse Excel file',
          error: parseResult.error
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Failed to parse Excel file',
        error: parseResult.error || 'Unknown parsing error'
      });
    }

    const { leads, summary, errors, duplicates } = parseResult.data;

    // Update progress for parsing completion
    processedRows = summary.parsedLeads || 0;
    const duplicateCount = summary.duplicates || 0;
    const errorCount = summary.errors || 0;

    if (progressCallback) {
      let message = `Parsed ${processedRows} leads successfully`;
      if (duplicateCount > 0) {
        message += `, skipped ${duplicateCount} duplicates`;
      }
      if (errorCount > 0) {
        message += `, ${errorCount} errors`;
      }

      progressCallback({
        stage: 'parsed',
        processed: processedRows,
        total: totalRows,
        percentage: Math.round((processedRows / totalRows) * 100),
        message,
        duplicates: duplicateCount,
        errors: errorCount
      });
    }

    // Check if we have any valid leads to insert
    if (leads.length === 0) {
      if (progressCallback) {
        progressCallback({
          stage: 'complete',
          processed: 0,
          total: totalRows,
          percentage: 100,
          message: 'No valid leads found in file',
          completed: true
        });
      }
      return res.status(400).json({
        success: false,
        message: 'No valid leads found in Excel file',
        data: {
          summary,
          errors,
          duplicates
        }
      });
    }

    // Send progress for database insertion start
    if (progressCallback) {
      progressCallback({
        stage: 'inserting',
        processed: processedRows,
        total: totalRows,
        percentage: Math.round((processedRows / totalRows) * 100),
        message: `Inserting ${leads.length} leads into database...`
      });
    }

    // Insert leads in batches to show progress
    const batchSize = 100; // Insert in smaller batches for progress tracking
    const insertedLeads = [];
    const totalBatches = Math.ceil(leads.length / batchSize);

    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const batchResult = await Lead.insertMany(batch);
      insertedLeads.push(...batchResult);

      // Update progress for each batch
      const currentProcessed = Math.min(i + batchSize, leads.length);
      const currentPercentage = Math.round((currentProcessed / totalRows) * 100);

      if (progressCallback) {
        progressCallback({
          stage: 'inserting',
          processed: currentProcessed,
          total: totalRows,
          percentage: currentPercentage,
          message: `Inserted ${currentProcessed} of ${totalRows} leads...`
        });
      }
    }

    // Send completion progress
    if (progressCallback) {
      progressCallback({
        stage: 'complete',
        processed: totalRows,
        total: totalRows,
        percentage: 100,
        message: `Successfully uploaded ${insertedLeads.length} leads`,
        completed: true,
        finalCount: insertedLeads.length,
        details: {
          uploaded: insertedLeads.length,
          duplicates: duplicates.length,
          errors: errors.length
        }
      });
    }

    // Generate parsing report
    const report = excelParser.generateReport(parseResult);

    // Log the bulk upload action
    console.log(`Admin ${req.user.name} bulk uploaded ${insertedLeads.length} leads from ${req.excelFileInfo.originalName}`);

    // For SSE responses, we need to end the connection properly
    if (progressCallback) {
      // Wait a moment for the final progress to be sent
      setTimeout(() => {
        if (!res.headersSent) {
          res.status(200).json({
            success: true,
            message: `${insertedLeads.length} leads uploaded successfully`,
            data: {
              uploadedCount: insertedLeads.length,
              fileInfo: req.excelFileInfo,
              structureInfo: req.excelStructureInfo,
              summary,
              report,
              leads: insertedLeads.map(lead => ({
                id: lead._id,
                name: lead.name,
                phone: lead.phone,
                status: lead.status,
                assignedTo: lead.assignedTo
              }))
            }
          });
        }
      }, 1000);
    } else {
      // Regular JSON response
      res.status(200).json({
        success: true,
        message: `${insertedLeads.length} leads uploaded successfully`,
        data: {
          uploadedCount: insertedLeads.length,
          fileInfo: req.excelFileInfo,
          structureInfo: req.excelStructureInfo,
          summary,
          report,
          leads: insertedLeads.map(lead => ({
            id: lead._id,
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            assignedTo: lead.assignedTo
          }))
        }
      });
    }

  } catch (error) {
    console.error('Error in bulkUploadLeads:', error);

    // Send error progress if callback exists
    if (req.progressCallback) {
      req.progressCallback({
        stage: 'error',
        processed: 0,
        total: req.excelStructureInfo?.totalRows || 0,
        percentage: 0,
        message: 'Upload failed',
        error: error.message,
        completed: true
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to bulk upload leads',
      error: error.message
    });
  }
};

// Get call time statistics for dashboard
const getCallTimeStats = async (req, res) => {
  try {
    const callTimeStats = await callTimeUtils.getCallTimeStats(Lead);

    res.status(200).json({
      success: true,
      message: 'Call time statistics retrieved successfully',
      data: callTimeStats
    });

  } catch (error) {
    console.error('Error in getCallTimeStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve call time statistics',
      error: error.message
    });
  }
};

// Export leads data
const exportLeads = async (req, res) => {
  try {
    const {
      status,
      assignedTo,
      sector,
      search,
      format = 'csv'
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (assignedTo) {
      filter.assignedTo = { $regex: assignedTo, $options: 'i' };
    }

    if (sector) {
      filter.sector = { $regex: sector, $options: 'i' };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } }
      ];
    }

    // Get leads based on filter
    const leads = await Lead.find(filter, {
      name: 1,
      phone: 1,
      email: 1,
      website: 1,
      location: 1,
      sector: 1,
      status: 1,
      notes: 1,
      callTime: 1,
      assignedTo: 1,
      assignedDate: 1,
      createdAt: 1,
      updatedAt: 1
    }).sort({ createdAt: -1 });

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leads found matching the specified criteria'
      });
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `leads_export_${timestamp}`;

    // Handle different export formats
    switch (format.toLowerCase()) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

        return res.status(200).json({
          success: true,
          message: 'Leads exported successfully',
          data: {
            exportedCount: leads.length,
            format: 'json',
            filename: `${filename}.json`,
            leads: leads.map(lead => ({
              id: lead._id,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              website: lead.website,
              location: lead.location,
              sector: lead.sector,
              status: lead.status,
              notes: lead.notes,
              callTime: lead.callTime,
              assignedTo: lead.assignedTo,
              assignedDate: lead.assignedDate,
              createdAt: lead.createdAt,
              updatedAt: lead.updatedAt
            }))
          }
        });

      case 'excel':
      case 'csv':
      default:
        // Generate CSV content
        const headers = [
          'Name', 'Phone', 'Email', 'Website', 'Location', 'Sector',
          'Status', 'Notes', 'Call Time', 'Assigned To', 'Assigned Date', 'Created At', 'Updated At'
        ];

        const csvRows = [
          headers.join(','),
          ...leads.map(lead => [
            `"${(lead.name || '').replace(/"/g, '""')}"`,
            `"${(lead.phone || '').replace(/"/g, '""')}"`,
            `"${(lead.email || '').replace(/"/g, '""')}"`,
            `"${(lead.website || '').replace(/"/g, '""')}"`,
            `"${(lead.location || '').replace(/"/g, '""')}"`,
            `"${(lead.sector || '').replace(/"/g, '""')}"`,
            `"${(lead.status || '').replace(/"/g, '""')}"`,
            `"${(lead.notes || '').replace(/"/g, '""')}"`,
            `"${(lead.callTime || '').replace(/"/g, '""')}"`,
            `"${(lead.assignedTo || '').replace(/"/g, '""')}"`,
            `"${lead.assignedDate ? new Date(lead.assignedDate).toLocaleDateString() : ''}"`,
            `"${new Date(lead.createdAt).toLocaleDateString()}"`,
            `"${new Date(lead.updatedAt).toLocaleDateString()}"`
          ].join(','))
        ];

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

        return res.status(200).send(csvContent);
    }

  } catch (error) {
    console.error('Error in exportLeads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export leads',
      error: error.message
    });
  }
};

// Change user password
const changeUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = password;
    await user.save();

    // Log the password change action
    console.log(`Admin ${req.user.name} changed password for user: ${user.name}`);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error in changeUserPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getChartData,
  getDailyTrendData,
  getSectorDistributionData,
  getAssignmentDistributionData,
  getStatusDistributionData,
  getRecentActivity,
  getAllLeads,
  getLeadById,
  assignLeads,
  updateLead,
  deleteLead,
  getAllEmployees,
  uploadAndAssignLeads,
  getEmployeeAssignments,
  getAllLeadAssignments,
  previewExcelFile,
  getExcelParsingReport,
  bulkUploadLeads,
  getCallTimeStats,
  exportLeads,
  changeUserPassword
};