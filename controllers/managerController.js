// controllers/managerController.js
const Lead = require('../models/Lead');
const User = require('../models/User');

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
    
    // Track previous assignment
    if (lead.assignedTo && String(lead.assignedTo) !== String(assignedTo)) {
      if (!lead.previousAssignments) lead.previousAssignments = [];
      lead.previousAssignments.push({
        employee: lead.assignedTo,
        assignedAt: new Date(),
        status: lead.status
      });
    }
    
    // Update lead
    lead.status = status;
    
    if (assignedTo) {
      // Verify the assigned employee is under this manager
      if (!employeeIds.includes(assignedTo)) {
        return res.status(400).json({ error: 'Can only assign to employees under your management' });
      }
      lead.assignedTo = assignedTo;
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
        
        // Track previous assignment
        if (!lead.previousAssignments) lead.previousAssignments = [];
        lead.previousAssignments.push({
          employee: lead.assignedTo,
          assignedAt: new Date(),
          status: lead.status
        });
        
        // Update assignment
        lead.assignedTo = newEmployee._id;
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

module.exports = {
  getManagerLeads: exports.getManagerLeads,
  getLeadsByStatus: exports.getLeadsByStatus,
  getManagerDashboard: exports.getManagerDashboard,
  updateLeadStatus: exports.updateLeadStatus,
  reassignLeads: exports.reassignLeads,
  getManagerEmployees: exports.getManagerEmployees
};
