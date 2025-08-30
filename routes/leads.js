const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');

// POST /leads - Add new lead
router.post('/', async (req, res) => {
    const { name, phone, email, notes, assignedTo, createdBy, sector, region } = req.body;

    try {
        const lead = new Lead({
            name,
            phone,
            email,
            notes,
            assignedTo,
            createdBy,
            sector: sector || 'Other',
            region: region || 'Central'
        });

        await lead.save();
        res.json({ message: 'Lead added successfully', lead });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /leads - Get all leads
router.get('/', async (req, res) => {
    try {
        const leads = await Lead.find()
            .populate('assignedTo createdBy', 'name email role');
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/leads/:id  -> Fetch a single lead by ID




// POST /leads/assign - Assign multiple leads to a user
router.post('/assign', async (req, res) => {
    try {
        const { userId, leadIds } = req.body;

        if (!userId || !leadIds || !Array.isArray(leadIds)) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: { assignedTo: userId } }
        );

        res.json({ message: 'Leads assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to assign leads' });
    }
});


router.get('/unassigned', async (req, res) => {
    console.log("Basha bhai hear ****")
    try {
        const leads = await Lead.find({ assignedTo: null });
        res.json(leads);
    } catch (err) {
        console.error('Error fetching unassigned leads:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ✅ Route for assignments
router.get('/assignments', async (req, res) => {
    console.log("Basha bhai hear ****")
    try {
        const leads = await Lead.find()
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');
        res.json(leads);
    } catch (err) {
        console.error('Error fetching assignments:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


// GET /users - Fetch all users (name, email only)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({'role':'employee'}, 'name email');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const leadId = req.params.id;

        // Find the lead by ID and populate assignedTo & createdBy
        const lead = await Lead.findById(leadId)
            .populate('assignedTo createdBy', 'name email role');

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(lead);
    } catch (err) {
        console.error('Error fetching lead by ID:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


module.exports = router;
