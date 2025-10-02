const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const SimCard = require('../models/SimCard');
const CallLog = require('../models/CallLog');
const SalesPipeline = require('../models/SalesPipeline');
const AdminController = require('../controllers/adminController');
const CampaignController = require('../controllers/campaignController');
const PipelineController = require('../controllers/pipelineController');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// All admin routes require authentication and admin role
router.use(auth);
router.use(roles(['admin']));

// ===== USER MANAGEMENT =====
// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({})
            .populate('manager', 'name email')
            .select('name email role manager createdAt')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all managers
router.get('/managers', async (req, res) => {
    try {
        const managers = await User.find({ role: 'manager' })
            .select('name email role createdAt')
            .sort({ createdAt: -1 });
        res.json(managers);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all employees
router.get('/employees', async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' })
            .populate('manager', 'name email')
            .select('name email role manager createdAt')
            .sort({ createdAt: -1 });
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get employees for auto-assign (simplified)
router.get('/users/employees', async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' })
            .select('_id name email')
            .sort({ name: 1 });
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get managers for auto-assign (simplified)
router.get('/users/managers', async (req, res) => {
    try {
        const managers = await User.find({ role: 'manager' })
            .select('_id name email')
            .sort({ name: 1 });
        res.json(managers);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new manager
router.post('/managers', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        
        const manager = new User({
            name,
            email,
            password,
            role: 'manager'
        });
        await manager.save();
        
        // Remove password from response
        const managerResponse = manager.toObject();
        delete managerResponse.password;
        
        res.status(201).json({ message: 'Manager created successfully', manager: managerResponse });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Create new employee
router.post('/employees', async (req, res) => {
    try {
        const { name, email, password, managerId } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        
        // Verify manager exists
        if (managerId) {
            const manager = await User.findById(managerId);
            if (!manager || manager.role !== 'manager') {
                return res.status(400).json({ error: 'Invalid manager ID' });
            }
        }
        
        const employee = new User({
            name,
            email,
            password,
            role: 'employee',
            manager: managerId
        });
        await employee.save();
        
        // Remove password from response
        const employeeResponse = employee.toObject();
        delete employeeResponse.password;
        
        res.status(201).json({ message: 'Employee created successfully', employee: employeeResponse });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update user
router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, manager } = req.body;
        
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
        if (manager !== undefined) user.manager = manager;
        
        await user.save();
        
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.json({ message: 'User updated successfully', user: userResponse });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user has assigned leads
        const assignedLeads = await Lead.find({ assignedTo: id });
        if (assignedLeads.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete user with assigned leads. Please reassign leads first.' 
            });
        }
        
        await User.findByIdAndDelete(id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== LEAD MANAGEMENT =====
// Get all leads (with optional filters: managerId, status, assigned=true|false, page, limit)
router.get('/leads', async (req, res) => {
    try {
        const { managerId, status, assigned, page = 1, limit = 50 } = req.query;
        const filter = {};

        // Filter by manager ownership (createdBy)
        if (managerId) {
            filter.createdBy = managerId;
        }
        // Filter by status
        if (status) {
            filter.status = status;
        }
        // Filter by assigned/unassigned
        if (assigned === 'true') {
            filter.assignedTo = { $ne: null };
        } else if (assigned === 'false') {
            filter.assignedTo = null;
        }

        // Parse pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const total = await Lead.countDocuments(filter);

        // Get paginated leads
        const leads = await Lead.find(filter)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            leads,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Bulk assign leads to a manager (make manager the owner/creator)
router.post('/leads/assign-manager', async (req, res) => {
    try {
        const { managerId, leadIds, clearAssignments } = req.body;

        if (!managerId || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'managerId and leadIds[] are required' });
        }

        // Verify manager exists and has correct role
        const manager = await User.findById(managerId);
        if (!manager || manager.role !== 'manager') {
            return res.status(400).json({ error: 'Invalid manager ID' });
        }

        const update = { createdBy: managerId };
        if (clearAssignments) update.assignedTo = null;

        const result = await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: update }
        );

        res.json({
            message: 'Leads assigned to manager successfully',
            matched: result.matchedCount ?? result.n,
            modified: result.modifiedCount ?? result.nModified
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get single lead by ID (only match valid ObjectId)
router.get('/leads/:id([0-9a-fA-F]{24})', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        res.json(lead);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Create new lead
router.post('/leads', async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            status,
            sector,
            region,
            notes,
            assignedTo,
            followUpDate,
            sellingPrice,
            lossReason
        } = req.body;

        // Validate required fields
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }

        // Check if lead with same phone already exists
        const existingLead = await Lead.findOne({ phone });
        if (existingLead) {
            return res.status(400).json({ error: 'Lead with this phone number already exists' });
        }

        const lead = new Lead({
            name,
            phone,
            email,
            status: status || 'New',
            sector: sector || 'Other',
            region: region || 'Central',
            notes,
            assignedTo,
            followUpDate: followUpDate ? new Date(followUpDate) : undefined,
            sellingPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
            lossReason,
            createdBy: req.user.id
        });

        await lead.save();

        const populatedLead = await Lead.findById(lead._id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');

        res.status(201).json(populatedLead);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update lead
router.put('/leads/:id', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const {
            name,
            phone,
            email,
            status,
            sector,
            region,
            notes,
            assignedTo,
            followUpDate,
            sellingPrice,
            lossReason
        } = req.body;

        // Validate required fields
        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }

        // Check if phone number is already used by another lead
        if (phone !== lead.phone) {
            const existingLead = await Lead.findOne({ phone });
            if (existingLead) {
                return res.status(400).json({ error: 'Lead with this phone number already exists' });
            }
        }

        // Update fields
        lead.name = name;
        lead.phone = phone;
        lead.email = email;
        lead.status = status;
        lead.sector = sector;
        lead.region = region;
        lead.notes = notes;
        lead.assignedTo = assignedTo;
        lead.followUpDate = followUpDate ? new Date(followUpDate) : undefined;
        lead.sellingPrice = sellingPrice ? parseFloat(sellingPrice) : undefined;
        lead.lossReason = lossReason;

        await lead.save();

        const updatedLead = await Lead.findById(lead._id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');

        res.json(updatedLead);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete lead
router.delete('/leads/:id', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        await Lead.findByIdAndDelete(req.params.id);
        res.json({ message: 'Lead deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete all leads
router.delete('/leads', async (req, res) => {
    try {
        const { confirm } = req.query;
        
        if (confirm !== 'true') {
            return res.status(400).json({ error: 'Confirmation required. Add ?confirm=true to confirm deletion.' });
        }

        const result = await Lead.deleteMany({});
        res.json({ 
            message: `All leads deleted successfully. ${result.deletedCount} leads were removed.`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error('Delete all leads error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get lead analytics
router.get('/leads/analytics', async (req, res) => {
    try {
        const leads = await Lead.find();

        const safeKey = (v, fallback) => (v && typeof v === 'string' ? v : fallback);
        const isValidDate = (d) => {
            const dt = new Date(d);
            return !isNaN(dt.getTime());
        };

        // Status distribution
        const statusDistribution = leads.reduce((acc, lead) => {
            const key = safeKey(lead.status, 'Unknown');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Sector distribution
        const sectorDistribution = leads.reduce((acc, lead) => {
            const key = safeKey(lead.sector, 'Other');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Region distribution
        const regionDistribution = leads.reduce((acc, lead) => {
            const key = safeKey(lead.region, 'Unknown');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Hot leads by sector
        const hotLeadsBySector = leads
            .filter(lead => lead.status === 'Hot')
            .reduce((acc, lead) => {
                const key = safeKey(lead.sector, 'Other');
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

        // Interested leads by sector
        const interestedLeadsBySector = leads
            .filter(lead => lead.status === 'Interested')
            .reduce((acc, lead) => {
                const key = safeKey(lead.sector, 'Other');
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

        // Hot leads by region
        const hotLeadsByRegion = leads
            .filter(lead => lead.status === 'Hot')
            .reduce((acc, lead) => {
                const key = safeKey(lead.region, 'Unknown');
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

        // Interested leads by region
        const interestedLeadsByRegion = leads
            .filter(lead => lead.status === 'Interested')
            .reduce((acc, lead) => {
                const key = safeKey(lead.region, 'Unknown');
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});

        // Monthly lead creation trend (skip invalid dates)
        const monthlyLeadTrend = leads.reduce((acc, lead) => {
            if (!isValidDate(lead.createdAt)) return acc;
            const month = new Date(lead.createdAt).toLocaleString('en-US', { month: 'long', year: 'numeric' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {});

        // Sector-Region matrix for hot and interested leads
        const sectorRegionMatrix = leads
            .filter(lead => lead.status === 'Hot' || lead.status === 'Interested')
            .reduce((acc, lead) => {
                const sector = safeKey(lead.sector, 'Other');
                const region = safeKey(lead.region, 'Unknown');
                if (!acc[sector]) acc[sector] = {};
                if (!acc[sector][region]) acc[sector][region] = { hot: 0, interested: 0 };
                if (lead.status === 'Hot') acc[sector][region].hot++;
                if (lead.status === 'Interested') acc[sector][region].interested++;
                return acc;
            }, {});

        res.json({
            statusDistribution,
            sectorDistribution,
            regionDistribution,
            hotLeadsBySector,
            interestedLeadsBySector,
            hotLeadsByRegion,
            interestedLeadsByRegion,
            monthlyLeadTrend,
            sectorRegionMatrix,
            totalLeads: leads.length
        });
    } catch (err) {
        console.error('Lead analytics error', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get unfinished leads (status = "New")
router.get('/leads/unfinished', async (req, res) => {
    try {
        const { managerId, assigned, page = 1, limit = 50 } = req.query;
        const filter = { status: 'New' };

        // Filter by manager ownership (createdBy)
        if (managerId) {
            filter.createdBy = managerId;
        }
        // Filter by assigned/unassigned
        if (assigned === 'true') {
            filter.assignedTo = { $ne: null };
        } else if (assigned === 'false') {
            filter.assignedTo = null;
        }

        // Parse pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const total = await Lead.countDocuments(filter);

        // Get paginated leads
        const leads = await Lead.find(filter)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            leads,
            total,
            count: leads.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            message: 'Unfinished leads retrieved successfully'
        });
    } catch (err) {
        console.error('Get unfinished leads error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get finished leads (status != "New")
router.get('/leads/finished', async (req, res) => {
    try {
        const { managerId, assigned, status, page = 1, limit = 50 } = req.query;
        const filter = { status: { $ne: 'New' } };

        // Filter by manager ownership (createdBy)
        if (managerId) {
            filter.createdBy = managerId;
        }
        // Filter by assigned/unassigned
        if (assigned === 'true') {
            filter.assignedTo = { $ne: null };
        } else if (assigned === 'false') {
            filter.assignedTo = null;
        }
        // Filter by specific status
        if (status) {
            filter.status = status;
        }

        // Parse pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const total = await Lead.countDocuments(filter);

        // Get paginated leads
        const leads = await Lead.find(filter)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            leads,
            total,
            count: leads.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            message: 'Finished leads retrieved successfully'
        });
    } catch (err) {
        console.error('Get finished leads error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get dead leads (status = "Dead")
router.get('/leads/dead', async (req, res) => {
    try {
        const { managerId, reason, page = 1, limit = 50 } = req.query;
        const filter = { status: 'Dead' };

        // Filter by manager ownership (createdBy)
        if (managerId) {
            filter.createdBy = managerId;
        }
        // Filter by dead lead reason
        if (reason) {
            filter.deadLeadReason = reason;
        }

        // Parse pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const total = await Lead.countDocuments(filter);

        // Get paginated leads
        const leads = await Lead.find(filter)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ deadLeadDate: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            leads,
            total,
            count: leads.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            message: 'Dead leads retrieved successfully'
        });
    } catch (err) {
        console.error('Get dead leads error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Reactivate dead lead (change status back to New)
router.put('/leads/:id/reactivate', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        if (lead.status !== 'Dead') {
            return res.status(400).json({ error: 'Lead is not dead' });
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

// Auto assign leads
router.post('/leads/auto-assign', async (req, res) => {
    try {
        const { status, assignType, personId, count, sector, region } = req.body;

        // Validate required fields
        if (!status || !assignType || !personId || !count) {
            return res.status(400).json({ 
                error: 'Missing required fields: status, assignType, personId, count' 
            });
        }

        // Validate assignType
        if (!['employee', 'manager'].includes(assignType)) {
            return res.status(400).json({ 
                error: 'assignType must be either "employee" or "manager"' 
            });
        }

        // Verify the person exists and has the correct role
        const person = await User.findById(personId);
        if (!person) {
            return res.status(404).json({ error: 'Person not found' });
        }

        if (person.role !== assignType) {
            return res.status(400).json({ 
                error: `Person is not an ${assignType}` 
            });
        }

        // Build filter for leads to assign
        const filter = {
            status: status,
            assignedTo: null, // Only unassigned leads
            $or: [
                { createdBy: { $exists: true } }, // Has a creator
                { createdBy: null } // Or no creator (legacy leads)
            ]
        };

        // Add optional filters
        if (sector) {
            filter.sector = sector;
        }
        if (region) {
            filter.region = region;
        }

        // Find unassigned leads matching criteria
        const availableLeads = await Lead.find(filter)
            .sort({ createdAt: 1 }) // Oldest first
            .limit(parseInt(count));

        if (availableLeads.length === 0) {
            return res.json({
                message: 'No leads available for assignment with the given criteria',
                assignedCount: 0,
                skippedCount: 0
            });
        }

        // Assign leads
        let assignedCount = 0;
        let skippedCount = 0;

        for (const lead of availableLeads) {
            try {
                // Update the lead
                lead.assignedTo = personId;
                lead.assignedDate = new Date();
                
                // If assigning to employee, also set the manager as creator
                if (assignType === 'employee' && person.manager) {
                    lead.createdBy = person.manager;
                } else if (assignType === 'manager') {
                    lead.createdBy = personId;
                }

                await lead.save();
                assignedCount++;
            } catch (error) {
                console.error(`Error assigning lead ${lead._id}:`, error);
                skippedCount++;
            }
        }

        res.json({
            message: 'Auto assignment completed',
            assignedCount,
            skippedCount,
            totalProcessed: availableLeads.length,
            assignedTo: {
                id: person._id,
                name: person.name,
                email: person.email,
                role: person.role
            }
        });

    } catch (err) {
        console.error('Auto assign error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== USER PERFORMANCE ANALYTICS =====
// Get employee lead completion statistics
router.get('/analytics/employee-performance', async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' })
            .populate('manager', 'name email')
            .select('name email manager createdAt');

        const employeeStats = await Promise.all(employees.map(async (employee) => {
            // Get all leads assigned to this employee
            const assignedLeads = await Lead.find({ assignedTo: employee._id });
            
            // Get completed leads (status != 'New')
            const completedLeads = assignedLeads.filter(lead => lead.status !== 'New');
            
            // Get pending leads (status = 'New')
            const pendingLeads = assignedLeads.filter(lead => lead.status === 'New');
            
            // Get dead leads
            const deadLeads = assignedLeads.filter(lead => lead.status === 'Dead');
            
            // Get won leads
            const wonLeads = assignedLeads.filter(lead => lead.status === 'Won');
            
            // Get call logs for this employee
            const callLogs = await CallLog.find({ employee: employee._id });
            
            // Calculate completion rate
            const completionRate = assignedLeads.length > 0 ? 
                ((completedLeads.length / assignedLeads.length) * 100).toFixed(1) : 0;
            
            // Calculate conversion rate
            const conversionRate = assignedLeads.length > 0 ? 
                ((wonLeads.length / assignedLeads.length) * 100).toFixed(1) : 0;

            return {
                employee: {
                    _id: employee._id,
                    name: employee.name,
                    email: employee.email,
                    manager: employee.manager
                },
                stats: {
                    totalAssigned: assignedLeads.length,
                    completed: completedLeads.length,
                    pending: pendingLeads.length,
                    dead: deadLeads.length,
                    won: wonLeads.length,
                    totalCalls: callLogs.length,
                    completionRate: parseFloat(completionRate),
                    conversionRate: parseFloat(conversionRate),
                    avgCallsPerLead: assignedLeads.length > 0 ? 
                        (callLogs.length / assignedLeads.length).toFixed(1) : 0
                }
            };
        }));

        res.json({
            employeeStats,
            summary: {
                totalEmployees: employees.length,
                totalAssignedLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.totalAssigned, 0),
                totalCompletedLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.completed, 0),
                totalPendingLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.pending, 0),
                totalDeadLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.dead, 0),
                totalWonLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.won, 0),
                avgCompletionRate: employeeStats.length > 0 ? 
                    (employeeStats.reduce((sum, emp) => sum + emp.stats.completionRate, 0) / employeeStats.length).toFixed(1) : 0,
                avgConversionRate: employeeStats.length > 0 ? 
                    (employeeStats.reduce((sum, emp) => sum + emp.stats.conversionRate, 0) / employeeStats.length).toFixed(1) : 0
            }
        });
    } catch (err) {
        console.error('Employee performance analytics error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get manager lead completion statistics
router.get('/analytics/manager-performance', async (req, res) => {
    try {
        const managers = await User.find({ role: 'manager' })
            .select('name email createdAt');

        const managerStats = await Promise.all(managers.map(async (manager) => {
            // Get all employees under this manager
            const employees = await User.find({ manager: manager._id }).select('_id');
            const employeeIds = employees.map(emp => emp._id);
            
            // Get leads created by this manager
            const createdLeads = await Lead.find({ createdBy: manager._id });
            
            // Get leads assigned to manager's team
            const teamLeads = await Lead.find({ 
                assignedTo: { $in: employeeIds } 
            });
            
            // Get all leads under this manager (created + team assigned)
            const allLeads = await Lead.find({
                $or: [
                    { createdBy: manager._id },
                    { assignedTo: { $in: employeeIds } }
                ]
            });
            
            // Calculate statistics
            const completedLeads = allLeads.filter(lead => lead.status !== 'New');
            const pendingLeads = allLeads.filter(lead => lead.status === 'New');
            const deadLeads = allLeads.filter(lead => lead.status === 'Dead');
            const wonLeads = allLeads.filter(lead => lead.status === 'Won');
            
            // Get team call logs
            const teamCallLogs = await CallLog.find({ 
                employee: { $in: employeeIds } 
            });
            
            // Calculate rates
            const completionRate = allLeads.length > 0 ? 
                ((completedLeads.length / allLeads.length) * 100).toFixed(1) : 0;
            
            const conversionRate = allLeads.length > 0 ? 
                ((wonLeads.length / allLeads.length) * 100).toFixed(1) : 0;

            return {
                manager: {
                    _id: manager._id,
                    name: manager.name,
                    email: manager.email
                },
                stats: {
                    totalLeads: allLeads.length,
                    createdLeads: createdLeads.length,
                    teamAssignedLeads: teamLeads.length,
                    completed: completedLeads.length,
                    pending: pendingLeads.length,
                    dead: deadLeads.length,
                    won: wonLeads.length,
                    teamSize: employees.length,
                    totalTeamCalls: teamCallLogs.length,
                    completionRate: parseFloat(completionRate),
                    conversionRate: parseFloat(conversionRate),
                    avgCallsPerLead: allLeads.length > 0 ? 
                        (teamCallLogs.length / allLeads.length).toFixed(1) : 0
                }
            };
        }));

        res.json({
            managerStats,
            summary: {
                totalManagers: managers.length,
                totalLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.totalLeads, 0),
                totalCompletedLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.completed, 0),
                totalPendingLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.pending, 0),
                totalDeadLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.dead, 0),
                totalWonLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.won, 0),
                totalTeamSize: managerStats.reduce((sum, mgr) => sum + mgr.stats.teamSize, 0),
                avgCompletionRate: managerStats.length > 0 ? 
                    (managerStats.reduce((sum, mgr) => sum + mgr.stats.completionRate, 0) / managerStats.length).toFixed(1) : 0,
                avgConversionRate: managerStats.length > 0 ? 
                    (managerStats.reduce((sum, mgr) => sum + mgr.stats.conversionRate, 0) / managerStats.length).toFixed(1) : 0
            }
        });
    } catch (err) {
        console.error('Manager performance analytics error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get combined user performance overview
router.get('/analytics/user-performance-overview', async (req, res) => {
    try {
        const { days = 30, from, to, role, performance } = req.query;
        
        // Build date filter
        let dateFilter = {};
        if (from && to) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(from),
                    $lte: new Date(to)
                }
            };
        } else {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - parseInt(days));
            dateFilter = { createdAt: { $gte: daysAgo } };
        }

        // Build role filter
        let roleFilter = {};
        if (role && role !== 'all') {
            roleFilter = { role };
        }

        // Get employee data with filters
        const employees = await User.find({ role: 'employee', ...dateFilter, ...roleFilter })
            .populate('manager', 'name email')
            .select('name email manager createdAt');

        const employeeStats = await Promise.all(employees.map(async (employee) => {
            const assignedLeads = await Lead.find({ assignedTo: employee._id });
            const completedLeads = assignedLeads.filter(lead => lead.status !== 'New');
            const pendingLeads = assignedLeads.filter(lead => lead.status === 'New');
            const deadLeads = assignedLeads.filter(lead => lead.status === 'Dead');
            const wonLeads = assignedLeads.filter(lead => lead.status === 'Won');
            const callLogs = await CallLog.find({ employee: employee._id });
            
            const completionRate = assignedLeads.length > 0 ? 
                ((completedLeads.length / assignedLeads.length) * 100).toFixed(1) : 0;
            const conversionRate = assignedLeads.length > 0 ? 
                ((wonLeads.length / assignedLeads.length) * 100).toFixed(1) : 0;

            return {
                employee: {
                    _id: employee._id,
                    name: employee.name,
                    email: employee.email,
                    manager: employee.manager
                },
                stats: {
                    totalAssigned: assignedLeads.length,
                    completed: completedLeads.length,
                    pending: pendingLeads.length,
                    dead: deadLeads.length,
                    won: wonLeads.length,
                    totalCalls: callLogs.length,
                    completionRate: parseFloat(completionRate),
                    conversionRate: parseFloat(conversionRate),
                    avgCallsPerLead: assignedLeads.length > 0 ? 
                        (callLogs.length / assignedLeads.length).toFixed(1) : 0
                }
            };
        }));

        // Apply performance level filtering
        if (performance && performance !== 'all') {
            const filteredStats = employeeStats.filter(emp => {
                const rate = emp.stats.completionRate;
                switch (performance) {
                    case 'high':
                        return rate >= 80;
                    case 'medium':
                        return rate >= 50 && rate < 80;
                    case 'low':
                        return rate < 50;
                    default:
                        return true;
                }
            });
            employeeStats.length = 0;
            employeeStats.push(...filteredStats);
        }

        const employeeSummary = {
            totalEmployees: employees.length,
            totalAssignedLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.totalAssigned, 0),
            totalCompletedLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.completed, 0),
            totalPendingLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.pending, 0),
            totalDeadLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.dead, 0),
            totalWonLeads: employeeStats.reduce((sum, emp) => sum + emp.stats.won, 0),
            avgCompletionRate: employeeStats.length > 0 ? 
                (employeeStats.reduce((sum, emp) => sum + emp.stats.completionRate, 0) / employeeStats.length).toFixed(1) : 0,
            avgConversionRate: employeeStats.length > 0 ? 
                (employeeStats.reduce((sum, emp) => sum + emp.stats.conversionRate, 0) / employeeStats.length).toFixed(1) : 0
        };

        // Get manager data directly
        const managers = await User.find({ role: 'manager' })
            .select('name email createdAt');

        const managerStats = await Promise.all(managers.map(async (manager) => {
            const employees = await User.find({ manager: manager._id }).select('_id');
            const employeeIds = employees.map(emp => emp._id);
            
            const createdLeads = await Lead.find({ createdBy: manager._id });
            const teamLeads = await Lead.find({ assignedTo: { $in: employeeIds } });
            
            const allLeads = await Lead.find({
                $or: [
                    { createdBy: manager._id },
                    { assignedTo: { $in: employeeIds } }
                ]
            });
            
            const completedLeads = allLeads.filter(lead => lead.status !== 'New');
            const pendingLeads = allLeads.filter(lead => lead.status === 'New');
            const deadLeads = allLeads.filter(lead => lead.status === 'Dead');
            const wonLeads = allLeads.filter(lead => lead.status === 'Won');
            
            const teamCallLogs = await CallLog.find({ employee: { $in: employeeIds } });
            
            const completionRate = allLeads.length > 0 ? 
                ((completedLeads.length / allLeads.length) * 100).toFixed(1) : 0;
            const conversionRate = allLeads.length > 0 ? 
                ((wonLeads.length / allLeads.length) * 100).toFixed(1) : 0;

            return {
                manager: {
                    _id: manager._id,
                    name: manager.name,
                    email: manager.email
                },
                stats: {
                    totalLeads: allLeads.length,
                    createdLeads: createdLeads.length,
                    teamAssignedLeads: teamLeads.length,
                    completed: completedLeads.length,
                    pending: pendingLeads.length,
                    dead: deadLeads.length,
                    won: wonLeads.length,
                    teamSize: employees.length,
                    totalTeamCalls: teamCallLogs.length,
                    completionRate: parseFloat(completionRate),
                    conversionRate: parseFloat(conversionRate),
                    avgCallsPerLead: allLeads.length > 0 ? 
                        (teamCallLogs.length / allLeads.length).toFixed(1) : 0
                }
            };
        }));

        const managerSummary = {
            totalManagers: managers.length,
            totalLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.totalLeads, 0),
            totalCompletedLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.completed, 0),
            totalPendingLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.pending, 0),
            totalDeadLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.dead, 0),
            totalWonLeads: managerStats.reduce((sum, mgr) => sum + mgr.stats.won, 0),
            totalTeamSize: managerStats.reduce((sum, mgr) => sum + mgr.stats.teamSize, 0),
            avgCompletionRate: managerStats.length > 0 ? 
                (managerStats.reduce((sum, mgr) => sum + mgr.stats.completionRate, 0) / managerStats.length).toFixed(1) : 0,
            avgConversionRate: managerStats.length > 0 ? 
                (managerStats.reduce((sum, mgr) => sum + mgr.stats.conversionRate, 0) / managerStats.length).toFixed(1) : 0
        };

        // Calculate overview
        const overview = {
            totalUsers: employeeSummary.totalEmployees + managerSummary.totalManagers,
            totalLeads: employeeSummary.totalAssignedLeads + managerSummary.totalLeads,
            totalCompleted: employeeSummary.totalCompletedLeads + managerSummary.totalCompletedLeads,
            totalPending: employeeSummary.totalPendingLeads + managerSummary.totalPendingLeads,
            totalDead: employeeSummary.totalDeadLeads + managerSummary.totalDeadLeads,
            totalWon: employeeSummary.totalWonLeads + managerSummary.totalWonLeads,
            overallCompletionRate: ((employeeSummary.totalCompletedLeads + managerSummary.totalCompletedLeads) / 
                (employeeSummary.totalAssignedLeads + managerSummary.totalLeads) * 100).toFixed(1)
        };

        res.json({
            employees: {
                employeeStats,
                summary: employeeSummary
            },
            managers: {
                managerStats,
                summary: managerSummary
            },
            overview
        });
    } catch (err) {
        console.error('User performance overview error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get audio analytics overview
router.get('/analytics/audio-overview', async (req, res) => {
    try {
        const { days = 30, from, to, quality } = req.query;
        
        // Build date filter
        let dateFilter = {};
        if (from && to) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(from),
                    $lte: new Date(to)
                }
            };
        } else {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - parseInt(days));
            dateFilter = { createdAt: { $gte: daysAgo } };
        }

        // Build quality filter
        let qualityFilter = {};
        if (quality && quality !== 'all') {
            qualityFilter = { 'callQuality.audioQuality': quality.replace('_', ' ') };
        }

        // Get call logs with recordings
        const callLogs = await CallLog.find({
            ...dateFilter,
            ...qualityFilter,
            recordingFile: { $exists: true, $ne: null }
        }).populate('lead', 'name phone email')
          .populate('employee', 'name email')
          .sort({ createdAt: -1 });

        // Calculate audio statistics
        const totalRecordings = callLogs.length;
        const totalDuration = callLogs.reduce((sum, log) => sum + (log.recordingDuration || 0), 0);
        const avgCallDuration = totalRecordings > 0 ? totalDuration / totalRecordings : 0;

        // Audio quality distribution
        const qualityDistribution = callLogs.reduce((acc, log) => {
            const quality = log.callQuality?.audioQuality || 'Unknown';
            acc[quality] = (acc[quality] || 0) + 1;
            return acc;
        }, {});

        // Calculate average quality score
        const qualityScores = {
            'Crystal Clear': 10,
            'Clear': 8,
            'Fair': 6,
            'Poor': 3,
            'Unknown': 5
        };
        
        const avgQualityScore = totalRecordings > 0 ? 
            callLogs.reduce((sum, log) => {
                const quality = log.callQuality?.audioQuality || 'Unknown';
                return sum + qualityScores[quality];
            }, 0) / totalRecordings : 0;

        // Calculate duplicate rate (simplified - in real implementation, you'd check file hashes)
        const duplicateRate = 0; // Placeholder - implement actual duplicate detection

        // Generate trends data (last 7 days)
        const trends = [];
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.setHours(0, 0, 0, 0));
            const dayEnd = new Date(date.setHours(23, 59, 59, 999));
            
            const dayLogs = callLogs.filter(log => 
                log.createdAt >= dayStart && log.createdAt <= dayEnd
            );
            
            trends.push({
                date: dayStart.toLocaleDateString(),
                count: dayLogs.length,
                avgDuration: dayLogs.length > 0 ? 
                    dayLogs.reduce((sum, log) => sum + (log.recordingDuration || 0), 0) / dayLogs.length : 0
            });
        }

        // Get recent recordings for the audio tab
        const recentRecordings = callLogs.slice(0, 10).map(log => ({
            _id: log._id,
            lead: log.lead,
            employee: log.employee,
            recordingUrl: log.recordingFile,
            duration: log.recordingDuration || 0,
            audioQuality: log.callQuality?.audioQuality || 'Unknown',
            createdAt: log.createdAt
        }));

        res.json({
            overview: {
                totalRecordings,
                totalDuration,
                avgCallDuration,
                avgQualityScore: Math.round(avgQualityScore * 10) / 10,
                duplicateRate,
                qualityDistribution,
                durationTrends: trends.map(t => ({ date: t.date, avgDuration: t.avgDuration })),
                uploadTrends: trends.map(t => ({ date: t.date, count: t.count }))
            },
            recentRecordings
        });
    } catch (err) {
        console.error('Audio analytics error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== SALES ANALYTICS =====
// Total number of sales (won deals) by region and sector, plus total value by region/sector
router.get('/sales/analytics', async (req, res) => {
  try {
    const leads = await Lead.find({ status: 'Won' }).select('region sector sellingPrice');

    const safeKey = (v, fallback) => (v && typeof v === 'string' ? v : fallback);

    const salesCountByRegion = leads.reduce((acc, l) => {
      const key = safeKey(l.region, 'Unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const salesCountBySector = leads.reduce((acc, l) => {
      const key = safeKey(l.sector, 'Other');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const salesValueByRegion = leads.reduce((acc, l) => {
      const key = safeKey(l.region, 'Unknown');
      const val = Number(l.sellingPrice) || 0;
      acc[key] = (acc[key] || 0) + val;
      return acc;
    }, {});

    const salesValueBySector = leads.reduce((acc, l) => {
      const key = safeKey(l.sector, 'Other');
      const val = Number(l.sellingPrice) || 0;
      acc[key] = (acc[key] || 0) + val;
      return acc;
    }, {});

    res.json({
      salesCountByRegion,
      salesCountBySector,
      salesValueByRegion,
      salesValueBySector,
      totalWonDeals: leads.length,
      totalSalesValue: leads.reduce((s, l) => s + (Number(l.sellingPrice) || 0), 0)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ===== CALL RECORDS MANAGEMENT =====
// Get all call records with employee details
router.get('/call-records', async (req, res) => {
    try {
        const callRecords = await CallLog.find()
            .populate('lead', 'name phone email status sector region')
            .populate('employee', 'name email role')
            .populate('simCard', 'simNumber carrier')
            .sort({ createdAt: -1 });

        res.json(callRecords);
    } catch (err) {
        console.error('Call records error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete a single call record
router.delete('/call-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const record = await CallLog.findById(id);
        if (!record) {
            return res.status(404).json({ error: 'Call record not found' });
        }

        await CallLog.findByIdAndDelete(id);
        return res.json({ message: 'Call record deleted successfully' });
    } catch (err) {
        console.error('Delete call record error:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get call records analytics
router.get('/call-records/analytics', async (req, res) => {
    try {
        const callRecords = await CallLog.find()
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

        // Quality metrics
        const qualityMetrics = {
            excellentSignal: callRecords.filter(r => r.callQuality?.signalStrength === 'Excellent').length,
            goodSignal: callRecords.filter(r => r.callQuality?.signalStrength === 'Good').length,
            crystalClearAudio: callRecords.filter(r => r.callQuality?.audioQuality === 'Crystal Clear').length,
            clearAudio: callRecords.filter(r => r.callQuality?.audioQuality === 'Clear').length
        };

        res.json({
            totalCalls: callRecords.length,
            statusDistribution,
            callsByEmployee,
            callsByHour,
            callsByDay,
            qualityMetrics,
            totalDuration: callRecords.reduce((sum, r) => sum + (r.callDuration || 0), 0),
            avgCallDuration: callRecords.length > 0 ? 
                Math.round(callRecords.reduce((sum, r) => sum + (r.callDuration || 0), 0) / callRecords.length) : 0
        });
    } catch (err) {
        console.error('Call records analytics error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get duplicate files for monitoring
router.get('/duplicate-files', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        // Find files with duplicate hashes
        const duplicateHashes = await CallLog.aggregate([
            {
                $match: {
                    fileHash: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$fileHash',
                    count: { $sum: 1 },
                    callLogs: { $push: '$$ROOT' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
        
        const total = duplicateHashes.length;
        const paginatedResults = duplicateHashes.slice(skip, skip + parseInt(limit));
        
        // Populate details for paginated results
        const populatedResults = await Promise.all(
            paginatedResults.map(async (duplicate) => {
                const populatedCallLogs = await Promise.all(
                    duplicate.callLogs.map(async (callLog) => {
                        return await CallLog.findById(callLog._id)
                            .populate('lead', 'name phone email')
                            .populate('employee', 'name email')
                            .select('_id lead employee callStartTime createdAt fileHash recordingFile');
                    })
                );
                
                return {
                    fileHash: duplicate._id,
                    duplicateCount: duplicate.count,
                    callLogs: populatedCallLogs
                };
            })
        );
        
        res.json({
            duplicateFiles: populatedResults,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get duplicate files error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== EMPLOYEE RECORDS =====
// Get comprehensive employee records with leads and call logs (admin view)
router.get('/employee-records', async (req, res) => {
    try {
        // Get all call logs with populated lead and employee data
        const callLogs = await CallLog.find({})
        .populate('lead', 'name phone email status sector region notes followUpDate')
        .populate('employee', 'name email role manager')
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
        console.error('Admin employee records error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get employee records analytics (admin view)
router.get('/employee-records/analytics', async (req, res) => {
    try {
        // Get all call logs
        const callLogs = await CallLog.find({});
        
        // Get all employees
        const employees = await User.find({ role: { $in: ['employee', 'manager'] } });
        
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
            topPerformers: await getAdminTopPerformers(),
            recentActivity: await getAdminRecentActivity()
        };
        
        res.json(analytics);
    } catch (err) {
        console.error('Admin employee records analytics error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Helper function to get top performing employees (admin view)
async function getAdminTopPerformers() {
    try {
        const pipeline = [
            { $group: {
                _id: '$employee',
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: { $ifNull: ['$callDuration', 0] } },
                completedCalls: { $sum: { $cond: [{ $eq: ['$callStatus', 'completed'] }, 1, 0] } }
            }},
            { $sort: { totalCalls: -1 } },
            { $limit: 10 },
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
                employeeRole: '$employee.role',
                totalCalls: 1,
                totalDuration: 1,
                completedCalls: 1,
                successRate: { $multiply: [{ $divide: ['$completedCalls', '$totalCalls'] }, 100] }
            }}
        ];
        
        return await CallLog.aggregate(pipeline);
    } catch (err) {
        console.error('Admin top performers aggregation error:', err);
        return [];
    }
}

// Helper function to get recent activity (admin view)
async function getAdminRecentActivity() {
    try {
        const recentLogs = await CallLog.find({})
        .populate('employee', 'name role')
        .populate('lead', 'name status')
        .sort({ createdAt: -1 })
        .limit(15);
        
        return recentLogs.map(log => ({
            id: log._id,
            employee: log.employee?.name || 'Unknown',
            employeeRole: log.employee?.role || 'Unknown',
            lead: log.lead?.name || 'Unknown',
            leadStatus: log.lead?.status || 'Unknown',
            callStatus: log.callStatus,
            duration: log.callDuration,
            outcome: log.outcome,
            timestamp: log.createdAt
        }));
    } catch (err) {
        console.error('Admin recent activity error:', err);
        return [];
    }
}

// ===== CAMPAIGN MANAGEMENT =====
// Get all campaigns
router.get('/campaigns', CampaignController.getCampaigns);

// Get single campaign
router.get('/campaigns/:id', CampaignController.getCampaign);

// Create new campaign
router.post('/campaigns', CampaignController.createCampaign);

// Update campaign
router.put('/campaigns/:id', CampaignController.updateCampaign);

// Delete campaign
router.delete('/campaigns/:id', CampaignController.deleteCampaign);

// Get campaign analytics
router.get('/campaigns/:id/analytics', CampaignController.getCampaignAnalytics);

// Get comprehensive campaign analytics for admin
router.get('/campaigns/analytics/admin', CampaignController.getCampaignAnalyticsAdmin);

// Update campaign metrics
router.put('/campaigns/:campaignId/metrics', CampaignController.updateCampaignMetrics);

// Get campaign performance
router.get('/campaigns/performance/summary', CampaignController.getCampaignPerformance);

// Toggle A/B testing
router.put('/campaigns/:campaignId/ab-testing', CampaignController.toggleABTesting);

// Get campaign insights
router.get('/campaigns/insights', CampaignController.getCampaignInsights);

// ===== PIPELINE MANAGEMENT =====
// Get all pipelines
router.get('/pipelines', PipelineController.getPipelines);

// Get single pipeline
router.get('/pipelines/:id', PipelineController.getPipeline);

// Create new pipeline
router.post('/pipelines', PipelineController.createPipeline);

// Update pipeline
router.put('/pipelines/:id', PipelineController.updatePipeline);

// Delete pipeline
router.delete('/pipelines/:id', PipelineController.deletePipeline);

// Add stage to pipeline
router.post('/pipelines/:id/stages', PipelineController.addStage);

// Update stage
router.put('/pipelines/:id/stages/:stageId', PipelineController.updateStage);

// Delete stage
router.delete('/pipelines/:id/stages/:stageId', PipelineController.deleteStage);

// Reorder stages
router.put('/pipelines/:id/stages/reorder', PipelineController.reorderStages);

// Get pipeline analytics
router.get('/pipelines/:id/analytics', PipelineController.getPipelineAnalytics);

// Get comprehensive pipeline analytics for admin
router.get('/pipelines/analytics/admin', PipelineController.getPipelineAnalyticsAdmin);

// Assign leads to pipeline
router.post('/pipelines/:id/assign-leads', PipelineController.assignLeadsToPipeline);

// Get leads in pipeline
router.get('/pipelines/:id/leads', PipelineController.getPipelineLeads);

// Get pipeline insights
router.get('/pipelines/insights', PipelineController.getPipelineInsights);

// ===== CALL LOGS MANAGEMENT =====
// Get all call logs
router.get('/call-logs', async (req, res) => {
    try {
        const callLogs = await CallLog.find({})
            .populate('lead', 'name phone email')
            .populate('employee', 'name email')
            .populate('simCard', 'simNumber carrier')
            .sort({ createdAt: -1 })
            .limit(1000); // Limit to prevent performance issues
        res.json(callLogs);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== SIM MANAGEMENT =====
// Get SIM cards status
router.get('/sims', async (req, res) => {
    try {
        const sims = await SimCard.find()
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(sims);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new SIM card
router.post('/sims', async (req, res) => {
    try {
        const simData = {
            ...req.body,
            createdBy: req.user.id
        };
        
        const sim = new SimCard(simData);
        await sim.save();
        
        const populatedSim = await SimCard.findById(sim._id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');
        
        res.status(201).json({ message: 'SIM card created successfully', sim: populatedSim });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Assign SIM to employee
router.post('/sims/assign', async (req, res) => {
    try {
        const { simId, employeeId } = req.body;
        
        // Verify employee exists
        const employee = await User.findById(employeeId);
        if (!employee || employee.role !== 'employee') {
            return res.status(400).json({ error: 'Invalid employee ID' });
        }
        
        // Update SIM assignment
        const sim = await SimCard.findById(simId);
        if (!sim) {
            return res.status(404).json({ error: 'SIM card not found' });
        }
        
        sim.assignedTo = employeeId;
        sim.assignedAt = new Date();
        sim.lastModifiedBy = req.user.id;
        
        await sim.save();
        
        const populatedSim = await SimCard.findById(simId)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');
        
        res.json({ message: 'SIM assigned successfully', sim: populatedSim });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== CALL ANALYTICS =====
// Get call analytics
router.get('/calls/analytics', async (req, res) => {
    try {
        const callLogs = await CallLog.find()
            .populate('lead', 'name phone email')
            .populate('employee', 'name email')
            .populate('simCard', 'simNumber carrier')
            .sort({ createdAt: -1 });
        
        // Calculate analytics
        const totalCalls = callLogs.length;
        const successfulCalls = callLogs.filter(log => log.callStatus === 'completed').length;
        const missedCalls = callLogs.filter(log => log.callStatus === 'missed').length;
        const rejectedCalls = callLogs.filter(log => log.callStatus === 'declined').length;
        
        // Average call duration
        const totalDuration = callLogs.reduce((sum, log) => sum + (log.callDuration || 0), 0);
        const averageCallDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
        
        // Calls by hour
        const callsByHour = {};
        callLogs.forEach(log => {
            const hour = new Date(log.callStartTime).getHours();
            callsByHour[hour] = (callsByHour[hour] || 0) + 1;
        });
        
        // Calls by day
        const callsByDay = {};
        callLogs.forEach(log => {
            const day = new Date(log.callStartTime).toLocaleDateString('en-US', { weekday: 'long' });
            callsByDay[day] = (callsByDay[day] || 0) + 1;
        });
        
        // Top performers
        const employeeStats = {};
        callLogs.forEach(log => {
            const employeeId = log.employee._id.toString();
            if (!employeeStats[employeeId]) {
                employeeStats[employeeId] = {
                    name: log.employee.name,
                    calls: 0,
                    successfulCalls: 0
                };
            }
            employeeStats[employeeId].calls++;
            if (log.callStatus === 'completed') {
                employeeStats[employeeId].successfulCalls++;
            }
        });
        
        const topPerformers = Object.values(employeeStats)
            .map(emp => ({
                name: emp.name,
                calls: emp.calls,
                successRate: Math.round((emp.successfulCalls / emp.calls) * 100)
            }))
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 5);
        
        res.json({
            totalCalls,
            successfulCalls,
            missedCalls,
            rejectedCalls,
            averageCallDuration,
            callsByHour,
            callsByDay,
            topPerformers
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== PERFORMANCE METRICS =====
// Get overall performance dashboard
router.get('/performance/dashboard', async (req, res) => {
    try {
        const [leads, campaigns, users, sims, callLogs, pipelines] = await Promise.all([
            Lead.find(),
            Campaign.find(),
            User.find(),
            SimCard.find(),
            CallLog.find(),
            SalesPipeline.find()
        ]);
        
        // Calculate key metrics
        const totalUsers = users.length;
        const totalLeads = leads.length;
        const totalCalls = callLogs.length;
        const activeSims = sims.filter(sim => sim.status === 'Active').length;
        const totalPipelines = pipelines.length;
        
        // Lead conversion rate
        const wonLeads = leads.filter(l => l.status === 'Won').length;
        const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;
        
        // Call success rate
        const successfulCalls = callLogs.filter(log => log.callStatus === 'completed').length;
        const callSuccessRate = totalCalls > 0 ? ((successfulCalls / totalCalls) * 100).toFixed(1) : 0;
        
        // Campaign metrics
        const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;
        const totalCampaignBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
        const totalCampaignSpent = campaigns.reduce((sum, c) => sum + (c.metrics.cost || 0), 0);
        
        // Pipeline metrics
        const activePipelines = pipelines.filter(p => p.status === 'Active').length;
        const totalPipelineLeads = pipelines.reduce((sum, p) => sum + p.metrics.totalLeads, 0);
        
        // Monthly growth (mock data for now)
        const monthlyGrowth = 12.5;
        
        res.json({
            totalUsers,
            totalLeads,
            totalCalls,
            activeSims,
            totalPipelines,
            conversionRate: parseFloat(conversionRate),
            callSuccessRate: parseFloat(callSuccessRate),
            activeCampaigns,
            totalCampaignBudget,
            totalCampaignSpent,
            activePipelines,
            totalPipelineLeads,
            monthlyGrowth
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== LEAD SCORING =====
// Get lead scoring analytics
router.get('/leads/scoring', async (req, res) => {
    try {
        const leads = await Lead.find();
        
        // Calculate lead scores based on various factors
        const scoredLeads = leads.map(lead => {
            let score = 0;
            
            // Status-based scoring
            switch (lead.status) {
                case 'Hot': score += 40; break;
                case 'Interested': score += 30; break;
                case 'Follow-up': score += 20; break;
                case 'New': score += 10; break;
                case 'Won': score += 50; break;
                case 'Lost': score += 0; break;
            }
            
            // Sector-based scoring (example: Technology and Finance get higher scores)
            if (lead.sector === 'Technology') score += 15;
            else if (lead.sector === 'Finance') score += 15;
            else if (lead.sector === 'Healthcare') score += 10;
            else score += 5;
            
            // Region-based scoring (example: International gets higher score)
            if (lead.region === 'International') score += 10;
            else score += 5;
            
            // Time-based scoring (newer leads get higher scores)
            const daysSinceCreation = Math.floor((new Date() - new Date(lead.createdAt)) / (1000 * 60 * 60 * 24));
            if (daysSinceCreation <= 7) score += 15;
            else if (daysSinceCreation <= 30) score += 10;
            else if (daysSinceCreation <= 90) score += 5;
            
            return {
                leadId: lead._id,
                name: lead.name,
                status: lead.status,
                sector: lead.sector,
                region: lead.region,
                score: Math.min(100, score),
                createdAt: lead.createdAt
            };
        });
        
        // Sort by score
        scoredLeads.sort((a, b) => b.score - a.score);
        
        // Categorize leads
        const highPriority = scoredLeads.filter(lead => lead.score >= 70).length;
        const mediumPriority = scoredLeads.filter(lead => lead.score >= 40 && lead.score < 70).length;
        const lowPriority = scoredLeads.filter(lead => lead.score < 40).length;
        
        res.json({
            highPriority,
            mediumPriority,
            lowPriority,
            scoredLeads: scoredLeads.slice(0, 20), // Top 20 leads
            averageScore: Math.round(scoredLeads.reduce((sum, lead) => sum + lead.score, 0) / scoredLeads.length)
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== ASSIGNMENT MANAGEMENT =====
router.post('/assign-employee', AdminController.assignEmployee);

// ===== SYSTEM STATISTICS =====
// Get system overview statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const [leads, campaigns, users, sims, callLogs, pipelines] = await Promise.all([
            Lead.find(),
            Campaign.find(),
            User.find(),
            SimCard.find(),
            CallLog.find(),
            SalesPipeline.find()
        ]);
        
        // User statistics
        const userStats = {
            total: users.length,
            admins: users.filter(u => u.role === 'admin').length,
            managers: users.filter(u => u.role === 'manager').length,
            employees: users.filter(u => u.role === 'employee').length
        };
        
        // Lead statistics
        const leadStats = {
            total: leads.length,
            byStatus: leads.reduce((acc, lead) => {
                acc[lead.status] = (acc[lead.status] || 0) + 1;
                return acc;
            }, {}),
            bySector: leads.reduce((acc, lead) => {
                acc[lead.sector] = (acc[lead.sector] || 0) + 1;
                return acc;
            }, {}),
            byRegion: leads.reduce((acc, lead) => {
                acc[lead.region] = (acc[lead.region] || 0) + 1;
                return acc;
            }, {})
        };
        
        // Campaign statistics
        const campaignStats = {
            total: campaigns.length,
            active: campaigns.filter(c => c.status === 'Active').length,
            completed: campaigns.filter(c => c.status === 'Completed').length,
            byType: campaigns.reduce((acc, campaign) => {
                acc[campaign.campaignType] = (acc[campaign.campaignType] || 0) + 1;
                return acc;
            }, {})
        };
        
        // Pipeline statistics
        const pipelineStats = {
            total: pipelines.length,
            active: pipelines.filter(p => p.status === 'Active').length,
            byStatus: pipelines.reduce((acc, pipeline) => {
                acc[pipeline.status] = (acc[pipeline.status] || 0) + 1;
                return acc;
            }, {})
        };
        
        // SIM statistics
        const simStats = {
            total: sims.length,
            active: sims.filter(s => s.status === 'Active').length,
            assigned: sims.filter(s => s.assignedTo).length,
            byCarrier: sims.reduce((acc, sim) => {
                acc[sim.carrier] = (acc[sim.carrier] || 0) + 1;
                return acc;
            }, {})
        };
        
        // Call statistics
        const callStats = {
            total: callLogs.length,
            successful: callLogs.filter(log => log.callStatus === 'completed').length,
            averageDuration: callLogs.length > 0 ? 
                Math.round(callLogs.reduce((sum, log) => sum + (log.callDuration || 0), 0) / callLogs.length) : 0
        };
        
        res.json({
            userStats,
            leadStats,
            campaignStats,
            pipelineStats,
            simStats,
            callStats,
            lastUpdated: new Date()
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
