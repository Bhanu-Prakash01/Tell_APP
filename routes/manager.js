// routes/manager.js
const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const CallLog = require('../models/CallLog');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// All manager routes require authentication and manager role
router.use(auth);
router.use(roles(['manager']));

// ===== TEAM MANAGEMENT =====
// Get team members (employees under this manager)
router.get('/team', async (req, res) => {
    try {
        const employees = await User.find({ manager: req.user.id })
            .select('name email role createdAt')
            .sort({ name: 1 });
        
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get team performance summary
router.get('/team/performance', async (req, res) => {
    try {
        const employees = await User.find({ manager: req.user.id });
        const employeeIds = employees.map(emp => emp._id);
        
        // Get leads assigned to team members
        const teamLeads = await Lead.find({
            assignedTo: { $in: employeeIds }
        });
        
        // Calculate team metrics
        const performance = {
            totalTeamMembers: employees.length,
            totalLeads: teamLeads.length,
            leadsByStatus: {
                new: teamLeads.filter(l => l.status === 'New').length,
                interested: teamLeads.filter(l => l.status === 'Interested').length,
                hot: teamLeads.filter(l => l.status === 'Hot').length,
                followUp: teamLeads.filter(l => l.status === 'Follow-up').length,
                won: teamLeads.filter(l => l.status === 'Won').length,
                lost: teamLeads.filter(l => l.status === 'Lost').length
            },
            conversionRate: teamLeads.length > 0 ? 
                ((teamLeads.filter(l => l.status === 'Won').length / teamLeads.length) * 100).toFixed(1) : 0,
            averageResponseTime: '2.5 hours', // Mock data
            teamEfficiency: 87.5 // Mock data
        };
        
        res.json(performance);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== LEAD MANAGEMENT =====
// Get all leads under manager's team
router.get('/leads', async (req, res) => {
    try {
        const managerId = req.user.id;
        const { assignedOnly, status } = req.query;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name');
        const employeeIds = employees.map(emp => emp._id);
        
        // Build base query
        let query = {};
        if (assignedOnly === 'true') {
            query = { assignedTo: { $in: employeeIds } };
        } else {
            query = { $or: [ { createdBy: managerId }, { assignedTo: { $in: employeeIds } } ] };
        }
        if (status) {
            query.status = status;
        }

        // Get leads per query
        const leads = await Lead.find(query)
        .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt sector region')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get leads for assignment purposes (leads assigned to manager by admin + leads assigned to manager's team)
router.get('/leads/for-assignment', async (req, res) => {
    try {
        const managerId = req.user.id;
        const { status } = req.query;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name');
        const employeeIds = employees.map(emp => emp._id);
        
        // Build query to get leads that manager can assign to employees:
        // 1. Leads assigned to this manager by admin (createdBy = managerId)
        // 2. Leads already assigned to manager's team employees
        let query = {
            $or: [
                { createdBy: managerId }, // Leads assigned to manager by admin
                { assignedTo: { $in: employeeIds } } // Leads already assigned to manager's team
            ]
        };
        
        if (status) {
            query.status = status;
        }

        // Get leads for assignment
        const leads = await Lead.find(query)
        .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt sector region')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Convenience endpoint: only leads assigned to this manager's team
router.get('/leads/assigned', async (req, res) => {
    try {
        const managerId = req.user.id;
        const employees = await User.find({ manager: managerId }).select('_id name');
        const employeeIds = employees.map(emp => emp._id);
        const leads = await Lead.find({ assignedTo: { $in: employeeIds } })
            .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt sector region')
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});



// Get lead analytics for manager's team
router.get('/leads/analytics', async (req, res) => {
    try {
        const managerId = req.user.id;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name');
        const employeeIds = employees.map(emp => emp._id);
        
        // Get leads under manager's team
        const leads = await Lead.find({
            $or: [
                { createdBy: managerId },
                { assignedTo: { $in: employeeIds } }
            ]
        });
        
        // Status distribution
        const statusDistribution = leads.reduce((acc, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1;
            return acc;
        }, {});
        
        // Sector distribution
        const sectorDistribution = leads.reduce((acc, lead) => {
            acc[lead.sector] = (acc[lead.sector] || 0) + 1;
            return acc;
        }, {});
        
        // Region distribution
        const regionDistribution = leads.reduce((acc, lead) => {
            acc[lead.region] = (acc[lead.region] || 0) + 1;
            return acc;
        }, {});
        
        // Hot leads by sector
        const hotLeadsBySector = leads
            .filter(lead => lead.status === 'Hot')
            .reduce((acc, lead) => {
                acc[lead.sector] = (acc[lead.sector] || 0) + 1;
                return acc;
            }, {});
        
        // Interested leads by sector
        const interestedLeadsBySector = leads
            .filter(lead => lead.status === 'Interested')
            .reduce((acc, lead) => {
                acc[lead.sector] = (acc[lead.sector] || 0) + 1;
                return acc;
            }, {});
        
        // Hot leads by region
        const hotLeadsByRegion = leads
            .filter(lead => lead.status === 'Hot')
            .reduce((acc, lead) => {
                acc[lead.region] = (acc[lead.region] || 0) + 1;
                return acc;
            }, {});
        
        // Interested leads by region
        const interestedLeadsByRegion = leads
            .filter(lead => lead.status === 'Interested')
            .reduce((acc, lead) => {
                acc[lead.region] = (acc[lead.region] || 0) + 1;
                return acc;
            }, {});
        
        // Monthly lead creation trend
        const monthlyLeadTrend = leads.reduce((acc, lead) => {
            const month = new Date(lead.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {});
        
        // Team performance by employee
        const teamPerformance = {};
        employees.forEach(emp => {
            const empLeads = leads.filter(lead => lead.assignedTo && lead.assignedTo.toString() === emp._id.toString());
            const wonLeads = empLeads.filter(lead => lead.status === 'Won').length;
            const totalLeads = empLeads.length;
            teamPerformance[emp.name] = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
        });
        
        res.json({
            statusDistribution,
            sectorDistribution,
            regionDistribution,
            hotLeadsBySector,
            interestedLeadsBySector,
            hotLeadsByRegion,
            interestedLeadsByRegion,
            monthlyLeadTrend,
            teamPerformance,
            totalLeads: leads.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get leads by specific status
router.get('/leads/status/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const managerId = req.user.id;
        
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
        .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt sector region')
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Create new lead
router.post('/leads', async (req, res) => {
    try {
        const leadData = {
            ...req.body,
            createdBy: req.user.id
        };
        
        const lead = new Lead(leadData);
        await lead.save();
        
        res.status(201).json({ message: 'Lead created successfully', lead });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update lead status and assignment
router.put('/leads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assignedTo, followUpDate, sellingPrice, lossReason, notes } = req.body;
        
        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        // Verify manager has access to this lead
        const employees = await User.find({ manager: req.user.id }).select('_id');
        const employeeIds = employees.map(emp => emp._id);
        
        if (!employeeIds.includes(lead.assignedTo) && lead.createdBy.toString() !== req.user.id.toString()) {
            return res.status(403).json({ error: 'Not authorized to update this lead' });
        }
        
        // Update lead fields
        if (status) lead.status = status;
        if (assignedTo) lead.assignedTo = assignedTo;
        if (followUpDate) lead.followUpDate = followUpDate;
        if (sellingPrice) lead.sellingPrice = sellingPrice;
        if (lossReason) lead.lossReason = lossReason;
        if (notes) lead.notes = notes;
        
        await lead.save();
        
        res.json({ message: 'Lead updated successfully', lead });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get unfinished leads (status = "New") for manager's team
router.get('/leads/unfinished', async (req, res) => {
    try {
        const managerId = req.user.id;
        const { assigned } = req.query;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name');
        const employeeIds = employees.map(emp => emp._id);
        
        // Build query for unfinished leads
        let query = { 
            status: 'New',
            $or: [
                { createdBy: managerId },
                { assignedTo: { $in: employeeIds } }
            ]
        };
        
        // Filter by assigned/unassigned
        if (assigned === 'true') {
            query.assignedTo = { $in: employeeIds };
        } else if (assigned === 'false') {
            query.assignedTo = null;
        }

        const leads = await Lead.find(query)
            .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt sector region')
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            leads,
            count: leads.length,
            message: 'Unfinished leads retrieved successfully'
        });
    } catch (err) {
        console.error('Get unfinished leads error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get finished leads (status != "New") for manager's team
router.get('/leads/finished', async (req, res) => {
    try {
        const managerId = req.user.id;
        const { assigned, status } = req.query;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name');
        const employeeIds = employees.map(emp => emp._id);
        
        // Build query for finished leads
        let query = { 
            status: { $ne: 'New' },
            $or: [
                { createdBy: managerId },
                { assignedTo: { $in: employeeIds } }
            ]
        };
        
        // Filter by assigned/unassigned
        if (assigned === 'true') {
            query.assignedTo = { $in: employeeIds };
        } else if (assigned === 'false') {
            query.assignedTo = null;
        }
        
        // Filter by specific status
        if (status) {
            query.status = status;
        }

        const leads = await Lead.find(query)
            .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt sector region')
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            leads,
            count: leads.length,
            message: 'Finished leads retrieved successfully'
        });
    } catch (err) {
        console.error('Get finished leads error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get dead leads for manager's team
router.get('/leads/dead', async (req, res) => {
    try {
        const managerId = req.user.id;
        const { reason } = req.query;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name');
        const employeeIds = employees.map(emp => emp._id);
        
        // Build query for dead leads
        let query = { 
            status: 'Dead',
            $or: [
                { createdBy: managerId },
                { assignedTo: { $in: employeeIds } }
            ]
        };
        
        // Filter by dead lead reason
        if (reason) {
            query.deadLeadReason = reason;
        }

        const leads = await Lead.find(query)
            .select('name phone email status notes followUpDate assignedTo createdBy sellingPrice lossReason reassignmentDate createdAt sector region deadLeadReason deadLeadDate callAttempts lastCallAttempt')
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ deadLeadDate: -1 });

        res.json({
            leads,
            count: leads.length,
            message: 'Dead leads retrieved successfully'
        });
    } catch (err) {
        console.error('Get dead leads error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Reactivate dead lead (manager can only reactivate their own leads)
router.put('/leads/:id/reactivate', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        if (lead.status !== 'Dead') {
            return res.status(400).json({ error: 'Lead is not dead' });
        }
        
        // Check if manager has permission to reactivate this lead
        if (lead.createdBy.toString() !== req.user.id.toString()) {
            return res.status(403).json({ error: 'Not authorized to reactivate this lead' });
        }
        
        // Reactivate the lead
        lead.status = 'New';
        lead.deadLeadReason = null;
        lead.deadLeadDate = null;
        lead.callAttempts = 0;
        lead.lastCallAttempt = null;
        
        await lead.save();
        
        const updatedLead = await Lead.findById(lead._id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');
        
        res.json({
            message: 'Lead reactivated successfully',
            lead: updatedLead
        });
    } catch (err) {
        console.error('Reactivate lead error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== CAMPAIGN MANAGEMENT =====
// Get campaigns created by manager
router.get('/campaigns', async (req, res) => {
    try {
        const campaigns = await Campaign.find({ createdBy: req.user.id })
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });
        
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Create new campaign
router.post('/campaigns', async (req, res) => {
    try {
        const campaignData = {
            ...req.body,
            createdBy: req.user.id,
            metrics: {
                reach: 0, impressions: 0, clicks: 0, conversions: 0,
                engagementRate: 0, conversionRate: 0, ctr: 0, roi: 0,
                cost: 0, revenue: 0
            }
        };
        
        const campaign = new Campaign(campaignData);
        await campaign.save();
        
        res.status(201).json({ message: 'Campaign created successfully', campaign });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== CALL RECORDS =====
// Get call records for manager's team
router.get('/call-records', async (req, res) => {
    try {
        const managerId = req.user.id;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id');
        const employeeIds = employees.map(emp => emp._id);
        
        const callRecords = await CallLog.find({ employee: { $in: employeeIds } })
            .populate('lead', 'name phone email status sector region')
            .populate('employee', 'name email role')
            .populate('simCard', 'simNumber carrier')
            .sort({ createdAt: -1 });
        
        res.json(callRecords);
    } catch (err) {
        console.error('getManagerCallRecords error:', err);
        res.status(500).json({ error: 'Failed to fetch call records', details: err.message });
    }
});

// Get call records analytics for manager's team
router.get('/call-records/analytics', async (req, res) => {
    try {
        const managerId = req.user.id;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id');
        const employeeIds = employees.map(emp => emp._id);
        
        const callRecords = await CallLog.find({ employee: { $in: employeeIds } })
            .populate('employee', 'name email')
            .populate('lead', 'sector region');
        
        // Call status distribution
        const statusDistribution = callRecords.reduce((acc, record) => {
            acc[record.callStatus] = (acc[record.callStatus] || 0) + 1;
            return acc;
        }, {});
        
        // Calls by employee
        const callsByEmployee = callRecords.reduce((acc, record) => {
            const empName = record.employee?.name || 'Unknown';
            if (!acc[empName]) {
                acc[empName] = {
                    totalCalls: 0,
                    completedCalls: 0,
                    totalDuration: 0,
                    successRate: 0
                };
            }
            acc[empName].totalCalls++;
            if (record.callStatus === 'completed') {
                acc[empName].completedCalls++;
            }
            acc[empName].totalDuration += record.callDuration || 0;
            return acc;
        }, {});
        
        // Calculate success rates
        Object.keys(callsByEmployee).forEach(emp => {
            const empData = callsByEmployee[emp];
            empData.successRate = empData.totalCalls > 0 ? 
                Math.round((empData.completedCalls / empData.totalCalls) * 100) : 0;
            empData.avgDuration = empData.totalCalls > 0 ? 
                Math.round(empData.totalDuration / empData.totalCalls) : 0;
        });
        
        // Calls by hour
        const callsByHour = callRecords.reduce((acc, record) => {
            const hour = new Date(record.createdAt).getHours();
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {});
        
        // Calls by day of week
        const callsByDay = callRecords.reduce((acc, record) => {
            const day = new Date(record.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});
        
        res.json({
            totalCalls: callRecords.length,
            statusDistribution,
            callsByEmployee,
            callsByHour,
            callsByDay,
            totalDuration: callRecords.reduce((sum, r) => sum + (r.callDuration || 0), 0),
            avgCallDuration: callRecords.length > 0 ? 
                Math.round(callRecords.reduce((sum, r) => sum + (r.callDuration || 0), 0) / callRecords.length) : 0
        });
    } catch (err) {
        console.error('getManagerCallRecordsAnalytics error:', err);
        res.status(500).json({ error: 'Failed to fetch call records analytics', details: err.message });
    }
});

// ===== CALL ANALYTICS =====
// Get team call analytics
router.get('/calls/analytics', async (req, res) => {
    try {
        const employees = await User.find({ manager: req.user.id });
        
        // Mock call data for team
        const callData = {
            totalTeamCalls: 450,
            successfulCalls: 320,
            missedCalls: 75,
            rejectedCalls: 55,
            averageCallDuration: 165, // seconds
            callsByEmployee: employees.map(emp => ({
                id: emp._id,
                name: emp.name,
                totalCalls: Math.floor(Math.random() * 100) + 20,
                successRate: Math.floor(Math.random() * 30) + 70
            })),
            callsByHour: {
                '9': 25, '10': 35, '11': 45, '12': 30,
                '13': 25, '14': 40, '15': 50, '16': 35,
                '17': 25, '18': 20
            }
        };
        
        res.json(callData);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== PERFORMANCE DASHBOARD =====
// Get manager dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        const managerId = req.user.id;
        
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
            employees: employees.length,
            conversionRate: leads.length > 0 ? 
                ((leads.filter(l => l.status === 'Won').length / leads.length) * 100).toFixed(1) : 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== LEAD ASSIGNMENT =====
// Assign leads to a single team member (manual simple)
router.post('/leads/assign', async (req, res) => {
    try {
        const { leadIds, employeeId } = req.body;
        
        // Verify employee is under this manager
        const employee = await User.findOne({ _id: employeeId, manager: req.user.id });
        if (!employee) {
            return res.status(403).json({ error: 'Employee not found or not under your management' });
        }
        
        // Update leads
        await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: { assignedTo: employeeId } }
        );
        
        res.json({ message: 'Leads assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Auto distribute leads evenly among team (round-robin)
router.post('/leads/assign/auto', async (req, res) => {
    try {
        const { leadIds, perEmployee } = req.body;

        const team = await User.find({ manager: req.user.id }).select('_id');
        if (team.length === 0) return res.status(400).json({ error: 'No team members under your management' });

        let candidateLeads = [];
        if (Array.isArray(leadIds) && leadIds.length > 0) {
            candidateLeads = await Lead.find({ _id: { $in: leadIds } });
        } else {
            // fallback to all accessible unassigned leads
            const employeeIds = team.map(t => t._id);
            candidateLeads = await Lead.find({
                $or: [
                    { createdBy: req.user.id },
                    { assignedTo: { $in: employeeIds } },
                    { assignedTo: { $exists: false } },
                ]
            });
        }

        // Filter authorized leads and prefer unassigned first
        const isAuthorized = (lead) => (
            lead.createdBy?.toString() === req.user.id.toString() ||
            !lead.assignedTo ||
            team.find(t => t._id.toString() === String(lead.assignedTo))
        );

        const allowedLeads = candidateLeads.filter(isAuthorized)
            .sort((a, b) => {
                // unassigned first
                const aUn = a.assignedTo ? 1 : 0;
                const bUn = b.assignedTo ? 1 : 0;
                if (aUn !== bUn) return aUn - bUn;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

        if (allowedLeads.length === 0) {
            return res.json({ message: 'No eligible leads to assign', assignedCount: 0, skippedCount: 0, assigned: [], skipped: [] });
        }

        const assigned = [];
        const skipped = [];

        const per = Number.isInteger(perEmployee) ? perEmployee : 0;
        if (per > 0) {
            // Assign up to perEmployee leads per team member
            let idx = 0;
            for (const emp of team) {
                let count = 0;
                while (count < per && idx < allowedLeads.length) {
                    const lead = allowedLeads[idx++];
                    // Skip if already assigned to same employee
                    if (lead.assignedTo && String(lead.assignedTo) === String(emp._id)) { skipped.push(lead._id); continue; }
                    lead.assignedTo = emp._id;
                    await lead.save();
                    assigned.push({ leadId: lead._id, employeeId: emp._id });
                    count++;
                }
                if (idx >= allowedLeads.length) break;
            }
        } else {
            // Round-robin assignment across team without cap
            for (let i = 0; i < allowedLeads.length; i++) {
                const lead = allowedLeads[i];
                const employee = team[i % team.length];
                if (lead.assignedTo && String(lead.assignedTo) === String(employee._id)) { skipped.push(lead._id); continue; }
                lead.assignedTo = employee._id;
                await lead.save();
                assigned.push({ leadId: lead._id, employeeId: employee._id });
            }
        }

        res.json({ message: 'Auto distribution complete', assignedCount: assigned.length, skippedCount: skipped.length, assigned, skipped });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Manual team distribution with explicit mapping { employeeId, leadIds[] }
router.post('/leads/assign/manual-map', async (req, res) => {
    try {
        const { assignments } = req.body; // [{ employeeId, leadIds: [] }]
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({ error: 'assignments array is required' });
        }
        const team = await User.find({ manager: req.user.id }).select('_id');
        const teamIds = new Set(team.map(t=> String(t._id)));
        const results = []; let totalAssigned = 0; let totalSkipped = 0;
        for (const a of assignments) {
            if (!teamIds.has(String(a.employeeId))) { results.push({ employeeId: a.employeeId, error: 'Not under your management' }); continue; }
            if (!Array.isArray(a.leadIds) || a.leadIds.length === 0) { results.push({ employeeId: a.employeeId, assigned: 0 }); continue; }
            const leads = await Lead.find({ _id: { $in: a.leadIds } });
            let assigned = 0; let skipped = 0;
            for (const lead of leads) {
                const isAuth = lead.createdBy?.toString() === req.user.id.toString() || !lead.assignedTo || teamIds.has(String(lead.assignedTo));
                if (!isAuth) { skipped++; continue; }
                lead.assignedTo = a.employeeId;
                await lead.save();
                assigned++;
            }
            totalAssigned += assigned; totalSkipped += skipped;
            results.push({ employeeId: a.employeeId, assigned, skipped });
        }
        res.json({ message: 'Manual distribution complete', totalAssigned, totalSkipped, results });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Bulk lead operations
router.post('/leads/bulk-update', async (req, res) => {
    try {
        const { leadIds, updates } = req.body;
        
        // Verify manager has access to these leads
        const leads = await Lead.find({ _id: { $in: leadIds } });
        const employees = await User.find({ manager: req.user.id }).select('_id');
        const employeeIds = employees.map(emp => emp._id);
        
        const authorizedLeads = leads.filter(lead => 
            employeeIds.includes(lead.assignedTo) || lead.createdBy.toString() === req.user.id.toString()
        );
        
        if (authorizedLeads.length !== leadIds.length) {
            return res.status(403).json({ error: 'Not authorized to update some leads' });
        }
        
        // Update leads
        await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: updates }
        );
        
        res.json({ message: 'Leads updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== REPORTING =====
// Get performance report
router.get('/reports/performance', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const managerId = req.user.id;
        
        const employees = await User.find({ manager: managerId });
        const employeeIds = employees.map(emp => emp._id);
        
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }
        
        const leads = await Lead.find({
            $or: [
                { createdBy: managerId },
                { assignedTo: { $in: employeeIds } }
            ],
            ...dateFilter
        });
        
        const report = {
            period: { startDate, endDate },
            totalLeads: leads.length,
            leadsByStatus: leads.reduce((acc, lead) => {
                acc[lead.status] = (acc[lead.status] || 0) + 1;
                return acc;
            }, {}),
            leadsBySector: leads.reduce((acc, lead) => {
                acc[lead.sector] = (acc[lead.sector] || 0) + 1;
                return acc;
            }, {}),
            leadsByRegion: leads.reduce((acc, lead) => {
                acc[lead.region] = (acc[lead.region] || 0) + 1;
                return acc;
            }, {}),
            totalSales: leads
                .filter(l => l.status === 'Won' && l.sellingPrice)
                .reduce((sum, l) => sum + l.sellingPrice, 0),
            conversionRate: leads.length > 0 ? 
                ((leads.filter(l => l.status === 'Won').length / leads.length) * 100).toFixed(1) : 0
        };
        
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== EMPLOYEE RECORDS =====
// Get comprehensive employee records with leads and call logs
router.get('/employee-records', async (req, res) => {
    try {
        const managerId = req.user.id;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name email');
        const employeeIds = employees.map(emp => emp._id);
        
        // Get call logs for team members with populated lead and employee data
        const callLogs = await CallLog.find({
            employee: { $in: employeeIds }
        })
        .populate('lead', 'name phone email status sector region notes followUpDate')
        .populate('employee', 'name email')
        .populate('simCard', 'simNumber carrier')
        .sort({ createdAt: -1 });
        
        // Transform data to include both call log and lead information
        const employeeRecords = callLogs.map(log => ({
            _id: log._id,
            employee: log.employee,
            lead: log.lead,
            callStatus: log.callStatus,
            callDuration: log.callDuration,
            outcome: log.outcome,
            notes: log.notes,
            followUpDate: log.followUpDate,
            callQuality: log.callQuality,
            simCard: log.simCard,
            recordingFile: log.recordingFile,
            recordingUrl: log.recordingUrl,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt
        }));
        
        res.json(employeeRecords);
    } catch (err) {
        console.error('Employee records error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get employee records analytics
router.get('/employee-records/analytics', async (req, res) => {
    try {
        const managerId = req.user.id;
        
        // Get all employees under this manager
        const employees = await User.find({ manager: managerId }).select('_id name email');
        const employeeIds = employees.map(emp => emp._id);
        
        // Get call logs for team members
        const callLogs = await CallLog.find({
            employee: { $in: employeeIds }
        });
        
        // Calculate analytics
        const analytics = {
            totalEmployees: employees.length,
            totalCalls: callLogs.length,
            totalCallTime: callLogs.reduce((total, log) => total + (log.callDuration || 0), 0),
            callsByStatus: callLogs.reduce((acc, log) => {
                acc[log.callStatus] = (acc[log.callStatus] || 0) + 1;
                return acc;
            }, {}),
            callsByOutcome: callLogs.reduce((acc, log) => {
                if (log.outcome) {
                    acc[log.outcome] = (acc[log.outcome] || 0) + 1;
                }
                return acc;
            }, {}),
            avgCallDuration: callLogs.length > 0 ? 
                Math.round(callLogs.reduce((total, log) => total + (log.callDuration || 0), 0) / callLogs.length) : 0,
            topPerformers: await getTopPerformers(employeeIds),
            recentActivity: await getRecentActivity(employeeIds)
        };
        
        res.json(analytics);
    } catch (err) {
        console.error('Employee records analytics error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Helper function to get top performing employees
async function getTopPerformers(employeeIds) {
    try {
        const pipeline = [
            { $match: { employee: { $in: employeeIds } } },
            { $group: {
                _id: '$employee',
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: { $ifNull: ['$callDuration', 0] } },
                completedCalls: { $sum: { $cond: [{ $eq: ['$callStatus', 'completed'] }, 1, 0] } }
            }},
            { $sort: { totalCalls: -1 } },
            { $limit: 5 },
            { $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'employee'
            }},
            { $unwind: '$employee' },
            { $project: {
                employeeId: '$_id',
                employeeName: '$employee.name',
                employeeEmail: '$employee.email',
                totalCalls: 1,
                totalDuration: 1,
                completedCalls: 1,
                successRate: { $multiply: [{ $divide: ['$completedCalls', '$totalCalls'] }, 100] }
            }}
        ];
        
        return await CallLog.aggregate(pipeline);
    } catch (err) {
        console.error('Top performers aggregation error:', err);
        return [];
    }
}

// Helper function to get recent activity
async function getRecentActivity(employeeIds) {
    try {
        const recentLogs = await CallLog.find({
            employee: { $in: employeeIds }
        })
        .populate('employee', 'name')
        .populate('lead', 'name status')
        .sort({ createdAt: -1 })
        .limit(10);
        
        return recentLogs.map(log => ({
            id: log._id,
            employee: log.employee?.name || 'Unknown',
            lead: log.lead?.name || 'Unknown',
            leadStatus: log.lead?.status || 'Unknown',
            callStatus: log.callStatus,
            duration: log.callDuration,
            outcome: log.outcome,
            timestamp: log.createdAt
        }));
    } catch (err) {
        console.error('Recent activity error:', err);
        return [];
    }
}

module.exports = router;
