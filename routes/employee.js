// routes/employee.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const employeeCtrl = require('../controllers/employeeController');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const crypto = require('crypto');
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');
const User = require('../models/User');

// Cloudinary config
cloudinary.config({
    cloud_name: 'ddnyldpoj',
    api_key: '516339393367269',
    api_secret: 'MezENQ5tR6yt-cENGki5ILQyp7w',
});

// Multer setup for file handling in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// All routes require authentication and employee role
router.use(auth);
router.use(roles(['employee']));

/**
 * @swagger
 * components:
 *   schemas:
 *     Lead:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Lead ID
 *         name:
 *           type: string
 *           description: Lead name
 *         phone:
 *           type: string
 *           description: Lead phone number
 *         email:
 *           type: string
 *           description: Lead email
 *         status:
 *           type: string
 *           enum: [New, Interested, Hot, Follow-up, Won, Lost]
 *           description: Lead status
 *         notes:
 *           type: string
 *           description: Lead notes
 *         followUpDate:
 *           type: string
 *           format: date
 *           description: Follow-up date
 *         sector:
 *           type: string
 *           description: Lead sector
 *         region:
 *           type: string
 *           description: Lead region
 *         assignedTo:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         createdBy:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date
 *           description: Creation date
 *     
 *     CallLog:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Call log ID
 *         lead:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             phone:
 *               type: string
 *             email:
 *               type: string
 *         callStatus:
 *           type: string
 *           enum: [completed, missed, declined, not_lifted, wrong_number, busy, unreachable, voicemail]
 *           description: Call status
 *         callDuration:
 *           type: number
 *           description: Call duration in seconds
 *         notes:
 *           type: string
 *           description: Call notes
 *         outcome:
 *           type: string
 *           enum: [Positive, Neutral, Negative, Follow-up Required, Not Interested, Interested, Hot Lead, Converted]
 *           description: Call outcome
 *         followUpRequired:
 *           type: boolean
 *           description: Whether follow-up is required
 *         followUpDate:
 *           type: string
 *           format: date
 *           description: Follow-up date
 *         recordingUrl:
 *           type: string
 *           description: Recording URL
 *         createdAt:
 *           type: string
 *           format: date
 *           description: Creation date
 *     
 *     Employee:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Employee ID
 *         name:
 *           type: string
 *           description: Employee name
 *         email:
 *           type: string
 *           description: Employee email
 *         role:
 *           type: string
 *           enum: [employee]
 *           description: User role
 *         manager:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             email:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date
 *           description: Creation date
 *     
 *     Performance:
 *       type: object
 *       properties:
 *         totalLeads:
 *           type: number
 *           description: Total leads assigned
 *         leadsByStatus:
 *           type: object
 *           description: Leads grouped by status
 *         totalCalls:
 *           type: number
 *           description: Total calls made
 *         callSuccessRate:
 *           type: number
 *           description: Call success rate percentage
 *         averageCallDuration:
 *           type: number
 *           description: Average call duration in seconds
 *         conversionRate:
 *           type: number
 *           description: Lead conversion rate percentage
 *         monthlyGrowth:
 *           type: number
 *           description: Monthly performance growth
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *         details:
 *           type: string
 *           description: Detailed error information
 *     
 *     Success:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 *         data:
 *           type: object
 *           description: Response data
 */

/**
 * @swagger
 * /api/employee/profile:
 *   get:
 *     summary: Get employee profile information
 *     tags: [Employee Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Employee'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', async (req, res) => {
    try {
        const employee = await User.findById(req.user.id)
            .select('name email role manager createdAt')
            .populate('manager', 'name email');
        
        res.json(employee);
    } catch (err) {
        console.error('Error fetching employee profile:', err);
        res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
    }
});

/**
 * @swagger
 * /api/employee/leads:
 *   get:
 *     summary: Get leads assigned to the logged-in employee
 *     tags: [Lead Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [New, Interested, Hot, Follow-up, Won, Lost]
 *         description: Filter leads by status
 *       - in: query
 *         name: sector
 *         schema:
 *           type: string
 *         description: Filter leads by sector
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter leads by region
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of leads per page
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leads:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lead'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/leads', async (req, res) => {
    try {
        const { status, sector, region, page = 1, limit = 20 } = req.query;
        const userId = req.user._id;
        
        // Build query
        let query = { assignedTo: userId };
        if (status) query.status = status;
        if (sector) query.sector = sector;
        if (region) query.region = region;
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count
        const total = await Lead.countDocuments(query);
        
        // Get leads with pagination
        const leads = await Lead.find(query)
            .select('name email phone status notes followUpDate createdAt sector region assignedTo createdBy')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const pages = Math.ceil(total / parseInt(limit));
        
        res.json({
            leads,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages
            }
        });
    } catch (err) {
        console.error('getMyLeads error:', err);
        res.status(500).json({ error: 'Failed to fetch leads', details: err.message });
    }
});

/**
 * @swagger
 * /api/employee/leads/{leadId}:
 *   get:
 *     summary: Get specific lead details
 *     tags: [Lead Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     responses:
 *       200:
 *         description: Lead details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lead'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Lead not assigned to employee
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
router.get('/leads/:leadId', async (req, res) => {
    try {
        const { leadId } = req.params;
        const userId = req.user._id;
        
        const lead = await Lead.findById(leadId)
            .populate('createdBy', 'name email')
            .populate('assignedTo', 'name email');
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        // Ensure this lead is assigned to this employee
        if (!lead.assignedTo || String(lead.assignedTo._id) !== String(userId)) {
            return res.status(403).json({ error: 'Not allowed to access this lead' });
        }
        
        res.json(lead);
    } catch (err) {
        console.error('Error fetching lead:', err);
        res.status(500).json({ error: 'Failed to fetch lead', details: err.message });
    }
});

/**
 * @swagger
 * /api/employee/update-lead:
 *   put:
 *     summary: Update lead notes, status, and follow-up date
 *     tags: [Lead Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leadId:
 *                 type: string
 *                 description: Lead ID
 *               note:
 *                 type: string
 *                 description: Additional note to add
 *               status:
 *                 type: string
 *                 enum: [New, Interested, Hot, Follow-up, Won, Lost]
 *                 description: New lead status
 *               followUpDate:
 *                 type: string
 *                 format: date
 *                 description: Follow-up date (required when status is Follow-up)
 *     responses:
 *       200:
 *         description: Lead updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 lead:
 *                   $ref: '#/components/schemas/Lead'
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Lead not assigned to employee
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
router.put('/update-lead', employeeCtrl.updateLeadNotes);

/**
 * @swagger
 * /api/employee/call-log:
 *   post:
 *     summary: Add a new call log entry
 *     tags: [Call Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *         schema:
 *           type: object
 *           required:
 *             - leadId
 *             - callStatus
 *           properties:
 *             leadId:
 *               type: string
 *               description: Lead ID
 *             callStatus:
 *               type: string
 *               enum: [completed, missed, declined, not_lifted, wrong_number, busy, unreachable, voicemail]
 *               description: Call status
 *             notes:
 *               type: string
 *               description: Call notes
 *             callDuration:
 *               type: number
 *               description: Call duration in seconds
 *             outcome:
 *               type: string
 *               enum: [Positive, Neutral, Negative, Follow-up Required, Not Interested, Interested, Hot Lead, Converted]
 *               description: Call outcome
 *             followUpRequired:
 *               type: boolean
 *               description: Whether follow-up is required
 *             followUpDate:
 *               type: string
 *               format: date
 *               description: Follow-up date
 *     responses:
 *       201:
 *         description: Call log created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 log:
 *                   $ref: '#/components/schemas/CallLog'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Lead not assigned to employee
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
router.post('/call-log', employeeCtrl.addCallLog);

/**
 * @swagger
 * /api/employee/my-call-logs:
 *   get:
 *     summary: Get call logs for the logged-in employee
 *     tags: [Call Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: leadId
 *         schema:
 *           type: string
 *         description: Filter by specific lead ID
 *       - in: query
 *         name: callStatus
 *         schema:
 *           type: string
 *           enum: [completed, missed, declined, not_lifted, wrong_number, busy, unreachable, voicemail]
 *         description: Filter by call status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter calls from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter calls until this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of logs per page
 *     responses:
 *       200:
 *         description: Call logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CallLog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/my-call-logs', async (req, res) => {
    try {
        const { leadId, callStatus, startDate, endDate, page = 1, limit = 20 } = req.query;
        const userId = req.user._id;
        
        // Build query
        let query = { employee: userId };
        if (leadId) query.lead = leadId;
        if (callStatus) query.callStatus = callStatus;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count
        const total = await CallLog.countDocuments(query);
        
        // Get logs with pagination
        const logs = await CallLog.find(query)
            .populate('lead', 'name phone email status')
            .populate('simCard', 'simNumber carrier')
            .select('lead callStatus notes callDuration outcome followUpRequired followUpDate recordingUrl createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const pages = Math.ceil(total / parseInt(limit));
        
        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages
            }
        });
    } catch (err) {
        console.error('getMyCallLogs error:', err);
        res.status(500).json({ error: 'Failed to fetch call logs', details: err.message });
    }
});

/**
 * @swagger
 * /api/employee/upload-call-log:
 *   post:
 *     summary: Upload call recording (audio file) and link to lead
 *     tags: [Call Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - recording
 *               - leadId
 *             properties:
 *               recording:
 *                 type: string
 *                 format: binary
 *                 description: Audio recording file (MP3, WAV, etc.)
 *               leadId:
 *                 type: string
 *                 description: Lead ID to link the recording to
 *     responses:
 *       200:
 *         description: Recording uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 url:
 *                   type: string
 *                   description: URL of uploaded recording
 *       400:
 *         description: Bad request - missing file or lead ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Lead not assigned to employee
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
router.post(
    '/upload-call-log',
    upload.single('recording'),
    async (req, res) => {
        try {
            const { leadId } = req.body;
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }
            if (!leadId) {
                return res.status(400).json({ message: 'Lead ID is required' });
            }

            // Verify lead is assigned to this employee
            const lead = await Lead.findById(leadId);
            if (!lead) {
                return res.status(404).json({ message: 'Lead not found' });
            }
            if (!lead.assignedTo || String(lead.assignedTo) !== String(req.user._id)) {
                return res.status(403).json({ message: 'Not allowed to upload for this lead' });
            }

            const uploadStream = cloudinary.uploader.upload_stream(
                { resource_type: 'video', folder: 'lead-call-logs' },
                async (error, result) => {
                    if (error) {
                        console.error(error);
                        return res.status(500).json({ message: 'Cloudinary upload failed', error });
                    }

                    await Lead.findByIdAndUpdate(leadId, { recordingUrl: result.secure_url });

                    res.json({
                        message: 'Call log uploaded successfully',
                        url: result.secure_url
                    });
                }
            );

            streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

/**
 * @swagger
 * /api/employee/lead/{leadId}/call-logs:
 *   get:
 *     summary: Get all call logs for a specific lead (timeline)
 *     tags: [Call Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Lead ID
 *     responses:
 *       200:
 *         description: Call logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CallLog'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Lead not assigned to employee
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
router.get('/lead/:leadId/call-logs', async (req, res) => {
    try {
        const { leadId } = req.params;
        const userId = req.user._id;

        // Verify lead is assigned to this employee
        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        if (!lead.assignedTo || String(lead.assignedTo) !== String(userId)) {
            return res.status(403).json({ message: 'Not allowed to access this lead' });
        }

        const logs = await CallLog.find({ lead: leadId, employee: userId })
            .populate('employee', 'name email')
            .populate('simCard', 'simNumber carrier')
            .select('callStatus notes callDuration outcome followUpRequired followUpDate recordingUrl createdAt')
            .sort({ createdAt: -1 });

        res.json(logs);
    } catch (err) {
        console.error('Error fetching lead call logs:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/employee/performance:
 *   get:
 *     summary: Get employee performance metrics
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Performance period
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Performance'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/performance', async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const userId = req.user._id;
        
        // Calculate date range based on period
        const now = new Date();
        let startDate;
        switch (period) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        // Get leads assigned to employee in period
        const leads = await Lead.find({
            assignedTo: userId,
            createdAt: { $gte: startDate }
        });
        
        // Get call logs in period
        const callLogs = await CallLog.find({
            employee: userId,
            createdAt: { $gte: startDate }
        });
        
        // Calculate metrics
        const totalLeads = leads.length;
        const leadsByStatus = leads.reduce((acc, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1;
            return acc;
        }, {});
        
        const totalCalls = callLogs.length;
        const successfulCalls = callLogs.filter(log => log.callStatus === 'completed').length;
        const callSuccessRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
        
        const totalDuration = callLogs.reduce((sum, log) => sum + (log.callDuration || 0), 0);
        const averageCallDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
        
        const wonLeads = leads.filter(lead => lead.status === 'Won').length;
        const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
        
        // Calculate monthly growth (mock data for now)
        const monthlyGrowth = 8.5;
        
        res.json({
            totalLeads,
            leadsByStatus,
            totalCalls,
            callSuccessRate,
            averageCallDuration,
            conversionRate,
            monthlyGrowth,
            period,
            startDate,
            endDate: now
        });
    } catch (err) {
        console.error('Error fetching performance:', err);
        res.status(500).json({ error: 'Failed to fetch performance', details: err.message });
    }
});

/**
 * @swagger
 * /api/employee/dashboard:
 *   get:
 *     summary: Get employee dashboard summary
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalLeads:
 *                       type: number
 *                     newLeads:
 *                       type: number
 *                     hotLeads:
 *                       type: number
 *                     followUpLeads:
 *                       type: number
 *                     overdueFollowUps:
 *                       type: number
 *                 recentActivity:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [lead_assigned, status_updated, call_logged]
 *                       description:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date
 *                 upcomingTasks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       leadId:
 *                         type: string
 *                       leadName:
 *                         type: string
 *                       taskType:
 *                         type: string
 *                       dueDate:
 *                         type: string
 *                         format: date
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get leads assigned to employee
        const leads = await Lead.find({ assignedTo: userId })
            .select('name status followUpDate createdAt')
            .sort({ createdAt: -1 });
        
        // Get recent call logs
        const recentCalls = await CallLog.find({ employee: userId })
            .populate('lead', 'name')
            .select('lead callStatus createdAt')
            .sort({ createdAt: -1 })
            .limit(5);
        
        // Calculate statistics
        const stats = {
            totalLeads: leads.length,
            newLeads: leads.filter(l => l.status === 'New').length,
            hotLeads: leads.filter(l => l.status === 'Hot').length,
            followUpLeads: leads.filter(l => l.status === 'Follow-up').length,
            overdueFollowUps: leads.filter(l => 
                l.status === 'Follow-up' && 
                l.followUpDate && 
                new Date() > new Date(l.followUpDate)
            ).length
        };
        
        // Generate recent activity
        const recentActivity = [];
        
        // Add recent leads
        leads.slice(0, 3).forEach(lead => {
            recentActivity.push({
                type: 'lead_assigned',
                description: `New lead assigned: ${lead.name}`,
                timestamp: lead.createdAt
            });
        });
        
        // Add recent calls
        recentCalls.forEach(call => {
            recentActivity.push({
                type: 'call_logged',
                description: `Call logged for ${call.lead.name}: ${call.callStatus}`,
                timestamp: call.createdAt
            });
        });
        
        // Sort by timestamp
        recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Generate upcoming tasks
        const upcomingTasks = leads
            .filter(lead => lead.followUpDate && new Date(lead.followUpDate) >= new Date())
            .map(lead => ({
                leadId: lead._id,
                leadName: lead.name,
                taskType: 'Follow-up Call',
                dueDate: lead.followUpDate
            }))
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 5);
        
        res.json({
            stats,
            recentActivity: recentActivity.slice(0, 10),
            upcomingTasks
        });
    } catch (err) {
        console.error('Error fetching dashboard:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard', details: err.message });
    }
});

/**
 * @swagger
 * /api/employee/leads/search:
 *   get:
 *     summary: Search leads by various criteria
 *     tags: [Lead Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (name, phone, email)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [New, Interested, Hot, Follow-up, Won, Lost]
 *         description: Filter by status
 *       - in: query
 *         name: sector
 *         schema:
 *           type: string
 *         description: Filter by sector
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by region
 *       - in: query
 *         name: hasFollowUp
 *         schema:
 *           type: boolean
 *         description: Filter leads with/without follow-up dates
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leads:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lead'
 *                 total:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/leads/search', async (req, res) => {
    try {
        const { q, status, sector, region, hasFollowUp } = req.query;
        const userId = req.user._id;
        
        // Build search query
        let query = { assignedTo: userId };
        
        // Text search
        if (q) {
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ];
        }
        
        // Filters
        if (status) query.status = status;
        if (sector) query.sector = sector;
        if (region) query.region = region;
        if (hasFollowUp !== undefined) {
            if (hasFollowUp === 'true') {
                query.followUpDate = { $exists: true, $ne: null };
            } else {
                query.$or = [
                    { followUpDate: { $exists: false } },
                    { followUpDate: null }
                ];
            }
        }
        
        const leads = await Lead.find(query)
            .select('name email phone status notes followUpDate createdAt sector region')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({
            leads,
            total: leads.length
        });
    } catch (err) {
        console.error('Error searching leads:', err);
        res.status(500).json({ error: 'Failed to search leads', details: err.message });
    }
});

// POST /api/employee/call-log-with-recording
// Upload call log with audio recording file (supports both multipart and JSON)
router.post('/call-log-with-recording', upload.single('recording'), async (req, res) => {
    try {
        const {
            leadId,
            callStatus,
            notes,
            callDuration,
            outcome,
            followUpRequired,
            followUpDate,
            callQuality,
            simCardId,
            // Mobile app support - base64 encoded audio
            audioData,
            audioFormat,
            fileName
        } = req.body;

        if (!leadId || !callStatus) {
            return res.status(400).json({ error: 'leadId and callStatus required' });
        }

        // Ensure lead exists and is assigned to this employee
        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        if (!lead.assignedTo || String(lead.assignedTo) !== String(req.user._id)) {
            return res.status(403).json({ error: 'Not allowed to log call for this lead' });
        }

        let recordingFile = null;
        let recordingUrl = null;
        let fileHash = null;

        // Handle file upload - support both multipart and base64
        if (req.file || audioData) {
            try {
                let fileBuffer;
                let fileFormat;

                if (req.file) {
                    // Multipart file upload (web)
                    fileBuffer = req.file.buffer;
                    fileFormat = req.file.mimetype || 'audio/mpeg';
                    console.log('Processing multipart file upload');
                } else if (audioData) {
                    // Base64 audio data (mobile app)
                    fileBuffer = Buffer.from(audioData, 'base64');
                    fileFormat = audioFormat || 'audio/mpeg';
                    console.log('Processing base64 audio data, size:', fileBuffer.length, 'bytes');
                }

                // Calculate file hash for duplicate detection
                fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                console.log('File hash calculated:', fileHash);

                // Check for duplicate file
                const existingCallLog = await CallLog.findOne({ 
                    fileHash: fileHash,
                    employee: req.user._id 
                });

                if (existingCallLog) {
                    return res.status(400).json({ 
                        error: 'Duplicate file detected', 
                        details: 'This audio file has already been uploaded. Please use a different file.',
                        existingCallLogId: existingCallLog._id,
                        uploadedAt: existingCallLog.createdAt
                    });
                }

                // Check for duplicate file across all users (optional - remove if you only want per-user duplicates)
                const globalDuplicate = await CallLog.findOne({ fileHash: fileHash });
                if (globalDuplicate) {
                    return res.status(400).json({ 
                        error: 'Duplicate file detected globally', 
                        details: 'This audio file has already been uploaded by another user. Please use a different file.',
                        uploadedBy: globalDuplicate.employee,
                        uploadedAt: globalDuplicate.createdAt
                    });
                }

                // Upload to Cloudinary
                const uploadPromise = new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            resource_type: 'video',
                            folder: 'call-recordings',
                            format: fileFormat.includes('mp3') ? 'mp3' : 'mp4',
                            public_id: `call_${leadId}_${Date.now()}_${fileHash.substring(0, 8)}`
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );

                    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
                });

                const cloudinaryResult = await uploadPromise;
                recordingFile = cloudinaryResult.secure_url;
                recordingUrl = cloudinaryResult.secure_url;
                
                console.log('Recording uploaded to Cloudinary:', recordingFile);
            } catch (uploadError) {
                console.error('File upload error:', uploadError);
                return res.status(500).json({ error: 'Failed to upload recording file' });
            }
        }

        // Validate and fix enum values
        let validatedCallQuality = callQuality;
        if (callQuality) {
            if (callQuality.audioQuality === 'Good') {
                validatedCallQuality.audioQuality = 'Clear';
            }
        }

        let validatedOutcome = outcome;
        if (outcome) {
            const outcomeMapping = {
                'Follow-up': 'Follow-up Required',
                'Follow up': 'Follow-up Required',
                'Followup': 'Follow-up Required',
                'Not Interested': 'Not Interested',
                'Interested': 'Interested',
                'Hot Lead': 'Hot Lead',
                'Converted': 'Converted',
                'Positive': 'Positive',
                'Neutral': 'Neutral',
                'Negative': 'Negative'
            };
            validatedOutcome = outcomeMapping[outcome] || 'Neutral';
        }

        // Create call log data
        const logData = {
            lead: leadId,
            employee: req.user._id,
            callStatus,
            callStartTime: new Date(),
            notes,
            uploadedBy: req.user._id
        };

        // Add optional fields
        if (simCardId) logData.simCard = simCardId;
        if (callDuration !== undefined) logData.callDuration = callDuration;
        if (validatedOutcome) logData.outcome = validatedOutcome;
        if (followUpRequired !== undefined) logData.followUpRequired = followUpRequired;
        if (followUpDate) logData.followUpDate = followUpDate;
        if (validatedCallQuality) logData.callQuality = validatedCallQuality;
        if (recordingFile) {
            logData.recordingFile = recordingFile;
            logData.recordingUrl = recordingUrl;
            if (callDuration) logData.recordingDuration = callDuration;
            if (fileHash) logData.fileHash = fileHash;
        }

        console.log('Creating call log with recording:', JSON.stringify(logData, null, 2));

        const log = await CallLog.create(logData);

        // Populate response
        const populatedLog = await CallLog.findById(log._id)
            .populate('lead', 'name phone email status sector region')
            .populate('employee', 'name email');

        if (log.simCard) {
            await populatedLog.populate('simCard', 'simNumber carrier');
        }

        res.status(201).json({
            message: 'Call log with recording saved successfully',
            log: populatedLog,
            recordingUrl: recordingUrl
        });

    } catch (err) {
        console.error('addCallLogWithRecording error:', err);
        res.status(500).json({ error: 'Failed to save call log with recording', details: err.message });
    }
});

// GET /api/employee/check-file-duplicate
// Check if a file is duplicate before uploading
router.post('/check-file-duplicate', upload.single('recording'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Calculate file hash
        const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
        
        // Check for duplicates
        const existingCallLog = await CallLog.findOne({ fileHash: fileHash });
        
        if (existingCallLog) {
            return res.json({
                isDuplicate: true,
                fileHash: fileHash,
                existingCallLog: {
                    id: existingCallLog._id,
                    uploadedBy: existingCallLog.employee,
                    uploadedAt: existingCallLog.createdAt,
                    lead: existingCallLog.lead
                },
                message: 'This file has already been uploaded'
            });
        }

        res.json({
            isDuplicate: false,
            fileHash: fileHash,
            message: 'File is unique and can be uploaded'
        });

    } catch (err) {
        console.error('File duplicate check error:', err);
        res.status(500).json({ error: 'Failed to check file duplicate', details: err.message });
    }
});

// POST /api/employee/call-log-mobile
// Mobile-optimized endpoint for call log with audio (JSON only, no multipart)
router.post('/call-log-mobile', async (req, res) => {
    try {
        const {
            leadId,
            callStatus,
            notes,
            callDuration,
            outcome,
            followUpRequired,
            followUpDate,
            callQuality,
            simCardId,
            audioData,
            audioFormat,
            fileName
        } = req.body;

        if (!leadId || !callStatus) {
            return res.status(400).json({ error: 'leadId and callStatus required' });
        }

        // Ensure lead exists and is assigned to this employee
        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        if (!lead.assignedTo || String(lead.assignedTo) !== String(req.user._id)) {
            return res.status(403).json({ error: 'Not allowed to log call for this lead' });
        }

        let recordingFile = null;
        let recordingUrl = null;
        let fileHash = null;

        // Handle base64 audio data
        if (audioData) {
            try {
                const fileBuffer = Buffer.from(audioData, 'base64');
                const fileFormat = audioFormat || 'audio/mpeg';
                
                console.log('Processing mobile audio data, size:', fileBuffer.length, 'bytes');

                // Calculate file hash for duplicate detection
                fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                console.log('File hash calculated:', fileHash);

                // Check for duplicate file
                const existingCallLog = await CallLog.findOne({ 
                    fileHash: fileHash,
                    employee: req.user._id 
                });

                if (existingCallLog) {
                    return res.status(400).json({ 
                        error: 'Duplicate file detected', 
                        details: 'This audio file has already been uploaded. Please use a different file.',
                        existingCallLogId: existingCallLog._id,
                        uploadedAt: existingCallLog.createdAt
                    });
                }

                // Check for duplicate file across all users
                const globalDuplicate = await CallLog.findOne({ fileHash: fileHash });
                if (globalDuplicate) {
                    return res.status(400).json({ 
                        error: 'Duplicate file detected globally', 
                        details: 'This audio file has already been uploaded by another user. Please use a different file.',
                        uploadedBy: globalDuplicate.employee,
                        uploadedAt: globalDuplicate.createdAt
                    });
                }

                // Upload to Cloudinary
                const uploadPromise = new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            resource_type: 'video',
                            folder: 'call-recordings',
                            format: fileFormat.includes('mp3') ? 'mp3' : 'mp4',
                            public_id: `mobile_call_${leadId}_${Date.now()}_${fileHash.substring(0, 8)}`
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );

                    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
                });

                const cloudinaryResult = await uploadPromise;
                recordingFile = cloudinaryResult.secure_url;
                recordingUrl = cloudinaryResult.secure_url;
                
                console.log('Mobile recording uploaded to Cloudinary:', recordingFile);
            } catch (uploadError) {
                console.error('Mobile file upload error:', uploadError);
                return res.status(500).json({ error: 'Failed to upload recording file' });
            }
        }

        // Validate and fix enum values
        let validatedCallQuality = callQuality;
        if (callQuality) {
            if (callQuality.audioQuality === 'Good') {
                validatedCallQuality.audioQuality = 'Clear';
            }
        }

        let validatedOutcome = outcome;
        if (outcome) {
            const outcomeMapping = {
                'Follow-up': 'Follow-up Required',
                'Follow up': 'Follow-up Required',
                'Followup': 'Follow-up Required',
                'Not Interested': 'Not Interested',
                'Interested': 'Interested',
                'Hot Lead': 'Hot Lead',
                'Converted': 'Converted',
                'Positive': 'Positive',
                'Neutral': 'Neutral',
                'Negative': 'Negative'
            };
            validatedOutcome = outcomeMapping[outcome] || 'Neutral';
        }

        // Create call log data
        const logData = {
            lead: leadId,
            employee: req.user._id,
            callStatus,
            callStartTime: new Date(),
            notes,
            uploadedBy: req.user._id
        };

        // Add optional fields
        if (simCardId) logData.simCard = simCardId;
        if (callDuration !== undefined) logData.callDuration = callDuration;
        if (validatedOutcome) logData.outcome = validatedOutcome;
        if (followUpRequired !== undefined) logData.followUpRequired = followUpRequired;
        if (followUpDate) logData.followUpDate = followUpDate;
        if (validatedCallQuality) logData.callQuality = validatedCallQuality;
        if (recordingFile) {
            logData.recordingFile = recordingFile;
            logData.recordingUrl = recordingUrl;
            if (callDuration) logData.recordingDuration = callDuration;
            if (fileHash) logData.fileHash = fileHash;
        }

        console.log('Creating mobile call log with recording:', JSON.stringify(logData, null, 2));

        const log = await CallLog.create(logData);

        // Populate response
        const populatedLog = await CallLog.findById(log._id)
            .populate('lead', 'name phone email status sector region')
            .populate('employee', 'name email');

        if (log.simCard) {
            await populatedLog.populate('simCard', 'simNumber carrier');
        }

        res.status(201).json({
            message: 'Mobile call log with recording saved successfully',
            log: populatedLog,
            recordingUrl: recordingUrl
        });

    } catch (err) {
        console.error('Mobile addCallLog error:', err);
        res.status(500).json({ error: 'Failed to save mobile call log with recording', details: err.message });
    }
});

// POST /api/employee/lead-management
// Comprehensive lead management endpoint - update status, notes, follow-ups, upload audio, create call logs
router.post('/lead-management', upload.single('recording'), async (req, res) => {
    try {
        const {
            leadId,
            action, // 'update_lead', 'add_call_log', 'upload_audio', 'update_followup'
            
            // Lead update fields
            status,
            notes,
            followUpDate,
            
            // Call log fields
            callStatus,
            callDuration,
            outcome,
            followUpRequired,
            callQuality,
            simCardId,
            
            // Audio fields
            audioData,
            audioFormat,
            fileName
        } = req.body;

        if (!leadId || !action) {
            return res.status(400).json({ error: 'leadId and action required' });
        }

        // Ensure lead exists and is assigned to this employee
        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        if (!lead.assignedTo || String(lead.assignedTo) !== String(req.user._id)) {
            return res.status(403).json({ error: 'Not allowed to manage this lead' });
        }

        const results = {};

        // 1. UPDATE LEAD STATUS AND NOTES
        if (action === 'update_lead' || action === 'all') {
            if (status || notes || followUpDate) {
                const updateData = {};
                if (status) updateData.status = status;
                if (notes) updateData.notes = notes;
                if (followUpDate) updateData.followUpDate = followUpDate;

                const updatedLead = await Lead.findByIdAndUpdate(
                    leadId,
                    updateData,
                    { new: true, runValidators: true }
                );

                results.leadUpdate = {
                    message: 'Lead updated successfully',
                    lead: updatedLead
                };
            }
        }

        // 2. UPLOAD AUDIO FILE
        let recordingFile = null;
        let recordingUrl = null;
        let fileHash = null;

        if (action === 'upload_audio' || action === 'all') {
            if (req.file || audioData) {
                try {
                    let fileBuffer;
                    let fileFormat;

                    if (req.file) {
                        // Multipart file upload (web)
                        fileBuffer = req.file.buffer;
                        fileFormat = req.file.mimetype || 'audio/mpeg';
                        console.log('Processing multipart file upload');
                    } else if (audioData) {
                        // Base64 audio data (mobile app)
                        fileBuffer = Buffer.from(audioData, 'base64');
                        fileFormat = audioFormat || 'audio/mpeg';
                        console.log('Processing base64 audio data, size:', fileBuffer.length, 'bytes');
                    }

                    // Calculate file hash for duplicate detection
                    fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                    console.log('File hash calculated:', fileHash);

                    // Check for duplicate file
                    const existingCallLog = await CallLog.findOne({ 
                        fileHash: fileHash,
                        employee: req.user._id 
                    });

                    if (existingCallLog) {
                        return res.status(400).json({ 
                            error: 'Duplicate file detected', 
                            details: 'This audio file has already been uploaded. Please use a different file.',
                            existingCallLogId: existingCallLog._id,
                            uploadedAt: existingCallLog.createdAt
                        });
                    }

                    // Check for duplicate file across all users
                    const globalDuplicate = await CallLog.findOne({ fileHash: fileHash });
                    if (globalDuplicate) {
                        return res.status(400).json({ 
                            error: 'Duplicate file detected globally', 
                            details: 'This audio file has already been uploaded by another user. Please use a different file.',
                            uploadedBy: globalDuplicate.employee,
                            uploadedAt: globalDuplicate.createdAt
                        });
                    }

                    // Upload to Cloudinary
                    const uploadPromise = new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'video',
                                folder: 'call-recordings',
                                format: fileFormat.includes('mp3') ? 'mp3' : 'mp4',
                                public_id: `lead_mgmt_${leadId}_${Date.now()}_${fileHash.substring(0, 8)}`
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );

                        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
                    });

                    const cloudinaryResult = await uploadPromise;
                    recordingFile = cloudinaryResult.secure_url;
                    recordingUrl = cloudinaryResult.secure_url;
                    
                    console.log('Audio uploaded to Cloudinary:', recordingFile);

                    results.audioUpload = {
                        message: 'Audio file uploaded successfully',
                        recordingUrl: recordingUrl,
                        fileHash: fileHash
                    };
                } catch (uploadError) {
                    console.error('Audio upload error:', uploadError);
                    return res.status(500).json({ error: 'Failed to upload audio file' });
                }
            }
        }

        // 3. CREATE CALL LOG
        if (action === 'add_call_log' || action === 'all') {
            if (callStatus) {
                // Validate and fix enum values
                let validatedCallQuality = callQuality;
                if (callQuality) {
                    if (callQuality.audioQuality === 'Good') {
                        validatedCallQuality.audioQuality = 'Clear';
                    }
                }

                let validatedOutcome = outcome;
                if (outcome) {
                    const outcomeMapping = {
                        'Follow-up': 'Follow-up Required',
                        'Follow up': 'Follow-up Required',
                        'Followup': 'Follow-up Required',
                        'Not Interested': 'Not Interested',
                        'Interested': 'Interested',
                        'Hot Lead': 'Hot Lead',
                        'Converted': 'Converted',
                        'Positive': 'Positive',
                        'Neutral': 'Neutral',
                        'Negative': 'Negative'
                    };
                    validatedOutcome = outcomeMapping[outcome] || 'Neutral';
                }

                // Create call log data
                const logData = {
                    lead: leadId,
                    employee: req.user._id,
                    callStatus,
                    callStartTime: new Date(),
                    notes: notes || 'Call log created via lead management',
                    uploadedBy: req.user._id
                };

                // Add optional fields
                if (simCardId) logData.simCard = simCardId;
                if (callDuration !== undefined) logData.callDuration = callDuration;
                if (validatedOutcome) logData.outcome = validatedOutcome;
                if (followUpRequired !== undefined) logData.followUpRequired = followUpRequired;
                if (followUpDate) logData.followUpDate = followUpDate;
                if (validatedCallQuality) logData.callQuality = validatedCallQuality;
                if (recordingFile) {
                    logData.recordingFile = recordingFile;
                    logData.recordingUrl = recordingUrl;
                    if (callDuration) logData.recordingDuration = callDuration;
                    if (fileHash) logData.fileHash = fileHash;
                }

                console.log('Creating call log via lead management:', JSON.stringify(logData, null, 2));

                const log = await CallLog.create(logData);

                // Populate response
                const populatedLog = await CallLog.findById(log._id)
                    .populate('lead', 'name phone email status sector region')
                    .populate('employee', 'name email');

                if (log.simCard) {
                    await populatedLog.populate('simCard', 'simNumber carrier');
                }

                results.callLog = {
                    message: 'Call log created successfully',
                    log: populatedLog
                };
            }
        }

        // 4. UPDATE FOLLOW-UP
        if (action === 'update_followup' || action === 'all') {
            if (followUpDate) {
                const updatedLead = await Lead.findByIdAndUpdate(
                    leadId,
                    { followUpDate: followUpDate },
                    { new: true, runValidators: true }
                );

                results.followUpUpdate = {
                    message: 'Follow-up date updated successfully',
                    followUpDate: followUpDate
                };
            }
        }

        // Return comprehensive results
        res.status(200).json({
            message: 'Lead management operations completed successfully',
            leadId: leadId,
            action: action,
            results: results
        });

    } catch (err) {
        console.error('Lead management error:', err);
        res.status(500).json({ error: 'Failed to complete lead management operations', details: err.message });
    }
});

module.exports = router;




