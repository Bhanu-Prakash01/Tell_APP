// controllers/managerController.js
const Lead = require('../models/Lead');
const User = require('../models/User');

// Helper function to properly assign leads with status transition and historical tracking
const assignLeadsToEmployee = async (leadIds, employeeId, managerId) => {
  const results = {
    assigned: [],
    skipped: [],
    errors: []
  };

  for (const leadId of leadIds) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        results.errors.push({ leadId, error: 'Lead not found' });
        continue;
      }

      // Check if manager has access to this lead
      const employees = await User.find({ manager: managerId }).select('_id');
      const employeeIds = employees.map(emp => emp._id);

      if (!employeeIds.includes(lead.assignedTo) && lead.createdBy.toString() !== managerId.toString()) {
        results.errors.push({ leadId, error: 'Not authorized to assign this lead' });
        continue;
      }

      // Skip if already assigned to the same employee
      if (lead.assignedTo && String(lead.assignedTo) === String(employeeId)) {
        results.skipped.push({ leadId, reason: 'Already assigned to this employee' });
        continue;
      }

      // Use the model's reassignToEmployee method for proper handling
      await lead.reassignToEmployee(employeeId, managerId);
      results.assigned.push(leadId);

    } catch (error) {
      results.errors.push({ leadId, error: error.message });
    }
  }

  return results;
};

// GET /api/manager/leads
// Returns all leads under the manager (including employee leads)
exports.getManagerLeads = async (req, res) => {
  try {
    const managerId = req.user._id;
    
    // Get all employees under this manager
    const employees = await User.find({ manager: managerId }).select('_id name');
    const employeeIds = employees.map(emp => emp._id);
    
    // Get leads created by manager and assigned to employees under manager
    const leads = await Lead.find({
      $or: [
        { createdBy: managerId },
        { assignedTo: { $in: employeeIds } }
      ]
    })
    .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt')
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

    res.json(leads);
  } catch (err) {
    console.error('getManagerLeads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads', details: err.message });
  }
};

// GET /api/manager/leads/status/:status
// Get leads by specific status
exports.getLeadsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const managerId = req.user._id;
    
    // Get all employees under this manager
    const employees = await User.find({ manager: managerId }).select('_id name');
    const employeeIds = employees.map(emp => emp._id);
    
    const leads = await Lead.find({
      status: status,
      $or: [
        { createdBy: managerId },
        { assignedTo: { $in: employeeIds } }
      ]
    })
    .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt')
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

    res.json(leads);
  } catch (err) {
    console.error('getLeadsByStatus error:', err);
    res.status(500).json({ error: 'Failed to fetch leads', details: err.message });
  }
};

// GET /api/manager/dashboard
// Get dashboard summary for manager
exports.getManagerDashboard = async (req, res) => {
  try {
    const managerId = req.user._id;
    
    // Get all employees under this manager
    const employees = await User.find({ manager: managerId }).select('_id name');
    const employeeIds = employees.map(emp => emp._id);
    
    // Get leads under this manager
    const leads = await Lead.find({
      $or: [
        { createdBy: managerId },
        { assignedTo: { $in: employeeIds } }
      ]
    });
    
    // Calculate statistics
    const stats = {
      total: leads.length,
      new: leads.filter(l => l.status === 'New').length,
      interested: leads.filter(l => l.status === 'Interested').length,
      hot: leads.filter(l => l.status === 'Hot').length,
      followUp: leads.filter(l => l.status === 'Follow-up').length,
      won: leads.filter(l => l.status === 'Won').length,
      lost: leads.filter(l => l.status === 'Lost').length
    };
    
    // Calculate total sales value
    const totalSales = leads
      .filter(l => l.status === 'Won' && l.sellingPrice)
      .reduce((sum, l) => sum + l.sellingPrice, 0);
    
    // Get hot leads that need reassignment
    const hotLeadsNeedingReassignment = leads.filter(l => 
      l.status === 'Hot' && 
      l.reassignmentDate && 
      new Date() >= l.reassignmentDate
    );
    
    // Get lost leads that need reassignment (after 2 weeks)
    const lostLeadsNeedingReassignment = leads.filter(l => 
      l.status === 'Lost' && 
      l.reassignmentDate && 
      new Date() >= l.reassignmentDate
    );
    
    res.json({
      stats,
      totalSales,
      hotLeadsNeedingReassignment: hotLeadsNeedingReassignment.length,
      lostLeadsNeedingReassignment: lostLeadsNeedingReassignment.length,
      employees: employees.length
    });
  } catch (err) {
    console.error('getManagerDashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard', details: err.message });
  }
};

// PUT /api/manager/update-lead-status
// Manager can update lead status and assign to employees
exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId, status, assignedTo, followUpDate, sellingPrice, lossReason } = req.body;
    const managerId = req.user._id;
    
    if (!leadId || !status) {
      return res.status(400).json({ error: 'leadId and status are required' });
    }
    
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Verify manager has access to this lead
    const employees = await User.find({ manager: managerId }).select('_id');
    const employeeIds = employees.map(emp => emp._id);
    
    if (!employeeIds.includes(lead.assignedTo) && lead.createdBy.toString() !== managerId.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this lead' });
    }
    
    // Update lead status
    lead.status = status;

    if (assignedTo) {
        // Verify the assigned employee is under this manager
        if (!employeeIds.includes(assignedTo)) {
            return res.status(400).json({ error: 'Can only assign to employees under your management' });
        }

        // Track previous assignment for historical data
        if (lead.assignedTo && String(lead.assignedTo) !== String(assignedTo)) {
          if (!lead.previousAssignments) lead.previousAssignments = [];
          lead.previousAssignments.push({
            employee: lead.assignedTo,
            assignedAt: new Date(),
            status: lead.status
          });
        }

        // Update assignment and set callStatus to "Pending"
        lead.assignedTo = assignedTo;
        lead.callStatus = 'Pending'; // Transition from completed to pending
    }
    
    // Handle status-specific logic
    if (status === 'Follow-up') {
      if (!followUpDate) {
        return res.status(400).json({ error: 'Follow-up date is required for Follow-up status' });
      }
      lead.followUpDate = new Date(followUpDate);
      lead.reassignmentDate = undefined;
    } else if (status === 'Won') {
      if (!sellingPrice) {
        return res.status(400).json({ error: 'Selling price is required for Won status' });
      }
      lead.sellingPrice = sellingPrice;
      lead.followUpDate = undefined;
      lead.reassignmentDate = undefined;
    } else if (status === 'Lost') {
      if (!lossReason) {
        return res.status(400).json({ error: 'Loss reason is required for Lost status' });
      }
      lead.lossReason = lossReason;
      lead.followUpDate = undefined;
      // Set reassignment date to 2 weeks from now
      lead.reassignmentDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    } else {
      // Clear all special fields for other statuses
      lead.followUpDate = undefined;
      lead.reassignmentDate = undefined;
      lead.sellingPrice = undefined;
      lead.lossReason = undefined;
    }
    
    await lead.save();
    
    const updated = await Lead.findById(leadId)
      .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');
    
    res.json({ message: 'Lead status updated', lead: updated });
  } catch (err) {
    console.error('updateLeadStatus error:', err);
    res.status(500).json({ error: 'Failed to update lead status', details: err.message });
  }
};

// POST /api/manager/reassign-leads
// Reassign leads that need reassignment (hot leads after 2 weeks, lost leads after 2 weeks)
exports.reassignLeads = async (req, res) => {
  try {
    const managerId = req.user._id;
    
    // Get all employees under this manager
    const employees = await User.find({ manager: managerId }).select('_id');
    if (employees.length === 0) {
      return res.status(400).json({ error: 'No employees found under your management' });
    }
    
    // Get leads that need reassignment
    const leadsToReassign = await Lead.find({
      $and: [
        {
          $or: [
            {
              status: 'Hot',
              reassignmentDate: { $lte: new Date() }
            },
            {
              status: 'Lost',
              reassignmentDate: { $lte: new Date() }
            }
          ]
        },
        {
          $or: [
            { createdBy: managerId },
            { assignedTo: { $in: employees.map(e => e._id) } }
          ]
        }
      ]
    });
    
    if (leadsToReassign.length === 0) {
      return res.json({ message: 'No leads need reassignment' });
    }
    
    // Reassign leads to different employees
    const reassignedLeads = [];
    for (const lead of leadsToReassign) {
      // Find a different employee to assign to
      const currentEmployeeId = lead.assignedTo;
      const availableEmployees = employees.filter(e => e._id.toString() !== currentEmployeeId.toString());
      
      if (availableEmployees.length > 0) {
        // Randomly select a new employee
        const randomIndex = Math.floor(Math.random() * availableEmployees.length);
        const newEmployee = availableEmployees[randomIndex];
        
        // Track previous assignment for historical data
        if (!lead.previousAssignments) lead.previousAssignments = [];
        lead.previousAssignments.push({
          employee: lead.assignedTo,
          assignedAt: new Date(),
          status: lead.status
        });

        // Update assignment and set callStatus to "Pending"
        lead.assignedTo = newEmployee._id;
        lead.callStatus = 'Pending'; // Transition from completed to pending
        lead.reassignmentDate = undefined; // Clear reassignment date

        await lead.save();
        reassignedLeads.push(lead);
      }
    }
    
    res.json({ 
      message: `${reassignedLeads.length} leads reassigned`, 
      reassignedLeads: reassignedLeads.length 
    });
  } catch (err) {
    console.error('reassignLeads error:', err);
    res.status(500).json({ error: 'Failed to reassign leads', details: err.message });
  }
};

// GET /api/manager/employees
// Get all employees under the manager
exports.getManagerEmployees = async (req, res) => {
  try {
    const managerId = req.user._id;
    
    const employees = await User.find({ manager: managerId })
      .select('name email role createdAt')
      .sort({ name: 1 });
    
    res.json(employees);
  } catch (err) {
    console.error('getManagerEmployees error:', err);
    res.status(500).json({ error: 'Failed to fetch employees', details: err.message });
  }
};

// GET /api/manager/call-tracking/daily
// Get daily call statistics for all employees under manager
exports.getDailyCallStats = async (req, res) => {
  try {
    const { date, employeeId } = req.query;
    const managerId = req.user._id;

    // Calculate date range
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Get all employees under this manager
    let employeeFilter = { manager: managerId };
    if (employeeId) {
      employeeFilter._id = employeeId;
    }

    const employees = await User.find(employeeFilter).select('_id name email');

    if (employees.length === 0) {
      return res.json({ message: 'No employees found', dailyStats: [] });
    }

    // Get call logs for the specified date
    const callLogs = await CallLog.find({
      employee: { $in: employees.map(emp => emp._id) },
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
    .populate('employee', 'name email')
    .populate('lead', 'name phone status')
    .sort({ createdAt: -1 });

    // Calculate daily statistics for each employee
    const dailyStats = employees.map(employee => {
      const employeeCalls = callLogs.filter(log => log.employee._id.toString() === employee._id.toString());

      const stats = {
        employee: {
          _id: employee._id,
          name: employee.name,
          email: employee.email
        },
        totalCalls: employeeCalls.length,
        completedCalls: employeeCalls.filter(call => call.callStatus === 'completed').length,
        missedCalls: employeeCalls.filter(call => call.callStatus === 'missed').length,
        totalDuration: employeeCalls.reduce((sum, call) => sum + (call.callDuration || 0), 0),
        averageDuration: employeeCalls.length > 0 ?
          Math.round(employeeCalls.reduce((sum, call) => sum + (call.callDuration || 0), 0) / employeeCalls.length) : 0,
        successRate: employeeCalls.length > 0 ?
          Math.round((employeeCalls.filter(call => call.callStatus === 'completed').length / employeeCalls.length) * 100) : 0,
        callsByStatus: employeeCalls.reduce((acc, call) => {
          acc[call.callStatus] = (acc[call.callStatus] || 0) + 1;
          return acc;
        }, {}),
        callsByOutcome: employeeCalls.reduce((acc, call) => {
          if (call.outcome) {
            acc[call.outcome] = (acc[call.outcome] || 0) + 1;
          }
          return acc;
        }, {}),
        recentCalls: employeeCalls.slice(0, 5).map(call => ({
          leadName: call.lead?.name || 'Unknown',
          leadPhone: call.lead?.phone || 'Unknown',
          callStatus: call.callStatus,
          outcome: call.outcome,
          duration: call.callDuration,
          createdAt: call.createdAt
        }))
      };

      return stats;
    });

    // Calculate team summary
    const teamSummary = {
      totalCalls: callLogs.length,
      totalCompleted: callLogs.filter(log => log.callStatus === 'completed').length,
      totalMissed: callLogs.filter(log => log.callStatus === 'missed').length,
      totalDuration: callLogs.reduce((sum, log) => sum + (log.callDuration || 0), 0),
      averageSuccessRate: dailyStats.length > 0 ?
        Math.round(dailyStats.reduce((sum, emp) => sum + emp.successRate, 0) / dailyStats.length) : 0,
      topPerformer: dailyStats.reduce((top, current) =>
        current.totalCalls > top.totalCalls ? current : top, dailyStats[0] || { totalCalls: 0 })
    };

    res.json({
      date: startOfDay.toISOString().split('T')[0],
      dailyStats,
      teamSummary,
      totalEmployees: employees.length
    });

  } catch (err) {
    console.error('getDailyCallStats error:', err);
    res.status(500).json({ error: 'Failed to fetch daily call statistics', details: err.message });
  }
};

// GET /api/manager/call-tracking/history
// Get call history for team with filters
exports.getTeamCallHistory = async (req, res) => {
  try {
    const { startDate, endDate, employeeId, callStatus, outcome, page = 1, limit = 50 } = req.query;
    const managerId = req.user._id;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get employees under this manager
    let employeeFilter = { manager: managerId };
    if (employeeId) {
      employeeFilter._id = employeeId;
    }

    const employees = await User.find(employeeFilter).select('_id');
    if (employees.length === 0) {
      return res.json({
        calls: [],
        pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 }
      });
    }

    // Build query for call logs
    let query = { employee: { $in: employees.map(emp => emp._id) } };

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Status filter
    if (callStatus) query.callStatus = callStatus;

    // Outcome filter
    if (outcome) query.outcome = outcome;

    // Get total count
    const total = await CallLog.countDocuments(query);

    // Get call logs with pagination
    const calls = await CallLog.find(query)
      .populate('employee', 'name email')
      .populate('lead', 'name phone email status sector region')
      .populate('simCard', 'simNumber carrier')
      .select('employee lead callStatus callDuration outcome notes followUpRequired followUpDate recordingUrl createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    });

  } catch (err) {
    console.error('getTeamCallHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch team call history', details: err.message });
  }
};

// GET /api/manager/call-tracking/summary
// Get call tracking summary for manager dashboard
exports.getCallTrackingSummary = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const managerId = req.user._id;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get employees under this manager
    const employees = await User.find({ manager: managerId }).select('_id name');
    if (employees.length === 0) {
      return res.json({ summary: {}, trends: [] });
    }

    // Get call logs for the period
    const callLogs = await CallLog.find({
      employee: { $in: employees.map(emp => emp._id) },
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Calculate daily trends
    const trends = [];
    for (let i = parseInt(days) - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayCalls = callLogs.filter(log =>
        log.createdAt >= dayStart && log.createdAt <= dayEnd
      );

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        totalCalls: dayCalls.length,
        completedCalls: dayCalls.filter(call => call.callStatus === 'completed').length,
        totalDuration: dayCalls.reduce((sum, call) => sum + (call.callDuration || 0), 0)
      });
    }

    // Calculate summary statistics
    const summary = {
      totalCalls: callLogs.length,
      completedCalls: callLogs.filter(log => log.callStatus === 'completed').length,
      missedCalls: callLogs.filter(log => log.callStatus === 'missed').length,
      totalDuration: callLogs.reduce((sum, log) => sum + (log.callDuration || 0), 0),
      averageDuration: callLogs.length > 0 ?
        Math.round(callLogs.reduce((sum, log) => sum + (log.callDuration || 0), 0) / callLogs.length) : 0,
      successRate: callLogs.length > 0 ?
        Math.round((callLogs.filter(log => log.callStatus === 'completed').length / callLogs.length) * 100) : 0,
      employeesActive: new Set(callLogs.map(log => log.employee.toString())).size,
      totalEmployees: employees.length
    };

    res.json({
      summary,
      trends,
      period: `${days} days`
    });

  } catch (err) {
    console.error('getCallTrackingSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch call tracking summary', details: err.message });
  }
};

// GET /api/manager/employee-call-counts
// Get individual call counts for each employee under manager
exports.getEmployeeCallCounts = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    const managerId = req.user._id;

    // Calculate date range
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const startDateObj = startDate ? new Date(startDate) : new Date(endDateObj.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days

    // Get all employees under this manager
    let employeeFilter = { manager: managerId };
    if (employeeId) {
      employeeFilter._id = employeeId;
    }

    const employees = await User.find(employeeFilter).select('_id name email role createdAt');

    if (employees.length === 0) {
      return res.json({ message: 'No employees found', callCounts: [] });
    }

    // Get call logs for the specified period
    const callLogs = await CallLog.find({
      employee: { $in: employees.map(emp => emp._id) },
      createdAt: { $gte: startDateObj, $lte: endDateObj }
    })
    .populate('employee', 'name email')
    .populate('lead', 'name phone status sector region')
    .sort({ createdAt: -1 });

    // Calculate call counts for each employee
    const callCounts = employees.map(employee => {
      const employeeCalls = callLogs.filter(log => log.employee._id.toString() === employee._id.toString());

      // Group calls by date for trend analysis
      const callsByDate = {};
      employeeCalls.forEach(call => {
        const date = call.createdAt.toISOString().split('T')[0];
        if (!callsByDate[date]) {
          callsByDate[date] = {
            total: 0,
            completed: 0,
            missed: 0,
            duration: 0
          };
        }
        callsByDate[date].total++;
        if (call.callStatus === 'completed') {
          callsByDate[date].completed++;
        } else if (call.callStatus === 'missed') {
          callsByDate[date].missed++;
        }
        callsByDate[date].duration += call.callDuration || 0;
      });

      // Convert to array and sort by date
      const dailyTrend = Object.entries(callsByDate)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate summary statistics
      const totalCalls = employeeCalls.length;
      const completedCalls = employeeCalls.filter(call => call.callStatus === 'completed').length;
      const missedCalls = employeeCalls.filter(call => call.callStatus === 'missed').length;
      const totalDuration = employeeCalls.reduce((sum, call) => sum + (call.callDuration || 0), 0);
      const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
      const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

      // Group by status
      const callsByStatus = employeeCalls.reduce((acc, call) => {
        acc[call.callStatus] = (acc[call.callStatus] || 0) + 1;
        return acc;
      }, {});

      // Group by outcome
      const callsByOutcome = employeeCalls.reduce((acc, call) => {
        if (call.outcome) {
          acc[call.outcome] = (acc[call.outcome] || 0) + 1;
        }
        return acc;
      }, {});

      // Calculate success outcomes
      const successfulOutcomes = ['Positive', 'Interested', 'Hot Lead', 'Converted'];
      const successfulCalls = employeeCalls.filter(call =>
        successfulOutcomes.includes(call.outcome)
      ).length;

      return {
        employee: {
          _id: employee._id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          joinedAt: employee.createdAt
        },
        summary: {
          totalCalls,
          completedCalls,
          missedCalls,
          totalDuration,
          averageDuration,
          successRate,
          successfulCalls,
          callsByStatus,
          callsByOutcome
        },
        dailyTrend,
        recentCalls: employeeCalls.slice(0, 10).map(call => ({
          _id: call._id,
          leadName: call.lead?.name || 'Unknown',
          leadPhone: call.lead?.phone || 'Unknown',
          callStatus: call.callStatus,
          outcome: call.outcome,
          duration: call.callDuration,
          createdAt: call.createdAt
        }))
      };
    });

    // Calculate team averages
    const teamSummary = {
      totalEmployees: employees.length,
      totalTeamCalls: callLogs.length,
      averageCallsPerEmployee: employees.length > 0 ? Math.round(callLogs.length / employees.length) : 0,
      averageSuccessRate: callCounts.length > 0 ?
        Math.round(callCounts.reduce((sum, emp) => sum + emp.summary.successRate, 0) / callCounts.length) : 0,
      topPerformer: callCounts.reduce((top, current) =>
        current.summary.totalCalls > top.summary.totalCalls ? current : top, callCounts[0] || { summary: { totalCalls: 0 } })
    };

    res.json({
      period: {
        startDate: startDateObj.toISOString().split('T')[0],
        endDate: endDateObj.toISOString().split('T')[0]
      },
      callCounts,
      teamSummary
    });

  } catch (err) {
    console.error('getEmployeeCallCounts error:', err);
    res.status(500).json({ error: 'Failed to fetch employee call counts', details: err.message });
  }
};

module.exports = {
  assignLeadsToEmployee,
  getManagerLeads: exports.getManagerLeads,
  getLeadsByStatus: exports.getLeadsByStatus,
  getManagerDashboard: exports.getManagerDashboard,
  updateLeadStatus: exports.updateLeadStatus,
  reassignLeads: exports.reassignLeads,
  getManagerEmployees: exports.getManagerEmployees,
  getDailyCallStats: exports.getDailyCallStats,
  getTeamCallHistory: exports.getTeamCallHistory,
  getCallTrackingSummary: exports.getCallTrackingSummary,
  getEmployeeCallCounts: exports.getEmployeeCallCounts
};
