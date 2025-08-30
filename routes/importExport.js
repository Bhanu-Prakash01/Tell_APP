const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.csv');
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// All routes require authentication
router.use(auth);

// ===== LEAD IMPORT/EXPORT =====

// Export leads to CSV
router.get('/leads/export', roles(['admin', 'manager']), async (req, res) => {
    try {
        let leads;
        
        if (req.user.role === 'admin') {
            // Admin can export all leads
            leads = await Lead.find()
                .populate('assignedTo', 'name email')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 });
        } else {
            // Manager can only export their team's leads
            const employees = await User.find({ manager: req.user.id }).select('_id');
            const employeeIds = employees.map(emp => emp._id);
            
            leads = await Lead.find({
                $or: [
                    { createdBy: req.user.id },
                    { assignedTo: { $in: employeeIds } }
                ]
            })
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        }

        // Convert to CSV format
        const csvData = [
            ['Name', 'Phone', 'Email', 'Status', 'Sector', 'Region', 'Notes', 'Assigned To', 'Created By', 'Follow Up Date', 'Selling Price', 'Loss Reason', 'Created At']
        ];

        leads.forEach(lead => {
            csvData.push([
                lead.name || '',
                lead.phone || '',
                lead.email || '',
                lead.status || '',
                lead.sector || '',
                lead.region || '',
                lead.notes || '',
                lead.assignedTo?.name || '',
                lead.createdBy?.name || '',
                lead.followUpDate ? new Date(lead.followUpDate).toISOString().split('T')[0] : '',
                lead.sellingPrice || '',
                lead.lossReason || '',
                new Date(lead.createdAt).toISOString()
            ]);
        });

        // Convert to CSV string
        const csvString = csvData.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`);
        
        res.send(csvString);
    } catch (err) {
        res.status(500).json({ error: 'Export failed', details: err.message });
    }
});

// Import leads from CSV
router.post('/leads/import', roles(['admin', 'manager']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const results = [];
        const errors = [];
        let successCount = 0;
        let errorCount = 0;

        // Read CSV file
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', async () => {
                try {
                    // Process each row
                    for (let i = 0; i < results.length; i++) {
                        const row = results[i];
                        try {
                            // Validate required fields
                            if (!row.Name || !row.Phone) {
                                errors.push(`Row ${i + 2}: Name and Phone are required`);
                                errorCount++;
                                continue;
                            }

                            // Check if lead already exists (by phone)
                            const existingLead = await Lead.findOne({ phone: row.Phone });
                            if (existingLead) {
                                errors.push(`Row ${i + 2}: Lead with phone ${row.Phone} already exists`);
                                errorCount++;
                                continue;
                            }

                            // Create new lead
                            const leadData = {
                                name: row.Name,
                                phone: row.Phone,
                                email: row.Email || '',
                                status: row.Status || 'New',
                                sector: row.Sector || 'Other',
                                region: row.Region || 'Central',
                                notes: row.Notes || '',
                                createdBy: req.user.id
                            };

                            // Handle follow-up date
                            if (row['Follow Up Date']) {
                                const followUpDate = new Date(row['Follow Up Date']);
                                if (!isNaN(followUpDate.getTime())) {
                                    leadData.followUpDate = followUpDate;
                                }
                            }

                            // Handle selling price
                            if (row['Selling Price']) {
                                const sellingPrice = parseFloat(row['Selling Price']);
                                if (!isNaN(sellingPrice)) {
                                    leadData.sellingPrice = sellingPrice;
                                }
                            }

                            // Handle loss reason
                            if (row['Loss Reason']) {
                                leadData.lossReason = row['Loss Reason'];
                            }

                            // Handle assignment (if manager)
                            if (req.user.role === 'manager' && row['Assigned To']) {
                                const employee = await User.findOne({ 
                                    name: row['Assigned To'], 
                                    manager: req.user.id 
                                });
                                if (employee) {
                                    leadData.assignedTo = employee._id;
                                }
                            }

                            const lead = new Lead(leadData);
                            await lead.save();
                            successCount++;

                        } catch (rowError) {
                            errors.push(`Row ${i + 2}: ${rowError.message}`);
                            errorCount++;
                        }
                    }

                    // Clean up uploaded file
                    fs.unlinkSync(req.file.path);

                    res.json({
                        message: 'Import completed',
                        successCount,
                        errorCount,
                        errors: errors.slice(0, 10) // Limit error messages
                    });

                } catch (processError) {
                    // Clean up uploaded file
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    res.status(500).json({ error: 'Import processing failed', details: processError.message });
                }
            })
            .on('error', (error) => {
                // Clean up uploaded file
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                res.status(500).json({ error: 'CSV parsing failed', details: error.message });
            });

    } catch (err) {
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Import failed', details: err.message });
    }
});

// ===== CAMPAIGN IMPORT/EXPORT =====

// Export campaigns to CSV
router.get('/campaigns/export', roles(['admin', 'manager']), async (req, res) => {
    try {
        let campaigns;
        
        if (req.user.role === 'admin') {
            // Admin can export all campaigns
            campaigns = await Campaign.find()
                .populate('createdBy', 'name email')
                .populate('assignedTo', 'name email')
                .sort({ createdAt: -1 });
        } else {
            // Manager can only export their campaigns
            campaigns = await Campaign.find({ createdBy: req.user.id })
                .populate('createdBy', 'name email')
                .populate('assignedTo', 'name email')
                .sort({ createdAt: -1 });
        }

        // Convert to CSV format
        const csvData = [
            ['Name', 'Description', 'Start Date', 'End Date', 'Target Audience', 'Campaign Type', 'Status', 'Budget', 'Created By', 'Created At']
        ];

        campaigns.forEach(campaign => {
            csvData.push([
                campaign.name || '',
                campaign.description || '',
                campaign.startDate ? new Date(campaign.startDate).toISOString().split('T')[0] : '',
                campaign.endDate ? new Date(campaign.endDate).toISOString().split('T')[0] : '',
                campaign.targetAudience || '',
                campaign.campaignType || '',
                campaign.status || '',
                campaign.budget || '',
                campaign.createdBy?.name || '',
                new Date(campaign.createdAt).toISOString()
            ]);
        });

        // Convert to CSV string
        const csvString = csvData.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="campaigns-export-${new Date().toISOString().split('T')[0]}.csv"`);
        
        res.send(csvString);
    } catch (err) {
        res.status(500).json({ error: 'Export failed', details: err.message });
    }
});

// Import campaigns from CSV
router.post('/campaigns/import', roles(['admin', 'manager']), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const results = [];
        const errors = [];
        let successCount = 0;
        let errorCount = 0;

        // Read CSV file
        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', async () => {
                try {
                    // Process each row
                    for (let i = 0; i < results.length; i++) {
                        const row = results[i];
                        try {
                            // Validate required fields
                            if (!row.Name) {
                                errors.push(`Row ${i + 2}: Name is required`);
                                errorCount++;
                                continue;
                            }

                            // Check if campaign already exists
                            const existingCampaign = await Campaign.findOne({ 
                                name: row.Name, 
                                createdBy: req.user.id 
                            });
                            if (existingCampaign) {
                                errors.push(`Row ${i + 2}: Campaign "${row.Name}" already exists`);
                                errorCount++;
                                continue;
                            }

                            // Validate dates
                            const startDate = row['Start Date'] ? new Date(row['Start Date']) : new Date();
                            const endDate = row['End Date'] ? new Date(row['End Date']) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                                errors.push(`Row ${i + 2}: Invalid date format`);
                                errorCount++;
                                continue;
                            }

                            if (startDate >= endDate) {
                                errors.push(`Row ${i + 2}: End date must be after start date`);
                                errorCount++;
                                continue;
                            }

                            // Create new campaign
                            const campaignData = {
                                name: row.Name,
                                description: row.Description || '',
                                startDate: startDate,
                                endDate: endDate,
                                targetAudience: row['Target Audience'] || 'all',
                                campaignType: row['Campaign Type'] || 'phone',
                                status: row.Status || 'Draft',
                                budget: row.Budget ? parseFloat(row.Budget) : 0,
                                createdBy: req.user.id
                            };

                            const campaign = new Campaign(campaignData);
                            await campaign.save();
                            successCount++;

                        } catch (rowError) {
                            errors.push(`Row ${i + 2}: ${rowError.message}`);
                            errorCount++;
                        }
                    }

                    // Clean up uploaded file
                    fs.unlinkSync(req.file.path);

                    res.json({
                        message: 'Import completed',
                        successCount,
                        errorCount,
                        errors: errors.slice(0, 10) // Limit error messages
                    });

                } catch (processError) {
                    // Clean up uploaded file
                    if (fs.existsSync(req.file.path)) {
                        fs.unlinkSync(req.file.path);
                    }
                    res.status(500).json({ error: 'Import processing failed', details: processError.message });
                }
            })
            .on('error', (error) => {
                // Clean up uploaded file
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                res.status(500).json({ error: 'CSV parsing failed', details: error.message });
            });

    } catch (err) {
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Import failed', details: err.message });
    }
});

// Get import/export templates
router.get('/templates/:type', roles(['admin', 'manager']), (req, res) => {
    const { type } = req.params;
    
    let csvData = '';
    let filename = '';

    if (type === 'leads') {
        csvData = 'Name,Phone,Email,Status,Sector,Region,Notes,Assigned To,Follow Up Date,Selling Price,Loss Reason\n';
        csvData += 'John Doe,+91-9876543210,john@example.com,New,Technology,North,Interested in our services,Employee Name,2024-02-15,50000,Not provided\n';
        filename = 'leads-template.csv';
    } else if (type === 'campaigns') {
        csvData = 'Name,Description,Start Date,End Date,Target Audience,Campaign Type,Status,Budget\n';
        csvData += 'Q1 Sales Campaign,First quarter sales push,2024-01-01,2024-03-31,hot,phone,Active,50000\n';
        filename = 'campaigns-template.csv';
    } else {
        return res.status(400).json({ error: 'Invalid template type' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
});

module.exports = router;
