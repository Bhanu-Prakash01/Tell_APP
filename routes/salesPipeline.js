const express = require('express');
const router = express.Router();
const SalesPipeline = require('../models/SalesPipeline');
const Lead = require('../models/Lead');
const User = require('../models/User');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// All routes require admin role
router.use(auth);
router.use(roles(['admin']));

// ===== PIPELINE MANAGEMENT =====

// Get all sales pipelines
router.get('/', async (req, res) => {
    try {
        const pipelines = await SalesPipeline.find()
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email')
            .sort({ createdAt: -1 });
        
        res.json(pipelines);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get single pipeline by ID
router.get('/:id', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email');
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }
        
        // Calculate metrics
        await pipeline.calculateMetrics();
        
        res.json(pipeline);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Create new pipeline
router.post('/', async (req, res) => {
    try {
        const {
            name,
            description,
            stages,
            settings,
            automation,
            access
        } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Pipeline name is required' });
        }

        // Check if pipeline with same name exists
        const existingPipeline = await SalesPipeline.findOne({ name });
        if (existingPipeline) {
            return res.status(400).json({ error: 'Pipeline with this name already exists' });
        }

        // Create default stages if not provided
        const defaultStages = stages || [
            { name: 'New Lead', order: 1, probability: 10, color: '#6366f1' },
            { name: 'Qualified', order: 2, probability: 25, color: '#10b981' },
            { name: 'Proposal', order: 3, probability: 50, color: '#f59e0b' },
            { name: 'Negotiation', order: 4, probability: 75, color: '#ef4444' },
            { name: 'Closed Won', order: 5, probability: 100, color: '#8b5cf6' },
            { name: 'Closed Lost', order: 6, probability: 0, color: '#64748b' }
        ];

        const pipeline = new SalesPipeline({
            name,
            description,
            stages: defaultStages,
            settings: settings || {},
            automation: automation || {},
            access: access || {},
            createdBy: req.user.id
        });

        await pipeline.save();

        const populatedPipeline = await SalesPipeline.findById(pipeline._id)
            .populate('createdBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email');

        res.status(201).json(populatedPipeline);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update pipeline
router.put('/:id', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        const {
            name,
            description,
            stages,
            settings,
            automation,
            access,
            status
        } = req.body;

        // Update fields
        if (name) pipeline.name = name;
        if (description !== undefined) pipeline.description = description;
        if (stages) pipeline.stages = stages;
        if (settings) pipeline.settings = settings;
        if (automation) pipeline.automation = automation;
        if (access) pipeline.access = access;
        if (status) pipeline.status = status;

        pipeline.lastModifiedBy = req.user.id;

        await pipeline.save();

        const updatedPipeline = await SalesPipeline.findById(pipeline._id)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email');

        res.json(updatedPipeline);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete pipeline
router.delete('/:id', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        // Check if pipeline has leads
        const leadsInPipeline = await Lead.find({ pipeline: pipeline._id });
        if (leadsInPipeline.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete pipeline with active leads. Please reassign leads first.' 
            });
        }

        await SalesPipeline.findByIdAndDelete(req.params.id);
        res.json({ message: 'Pipeline deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== STAGE MANAGEMENT =====

// Add stage to pipeline
router.post('/:id/stages', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        const { name, probability, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Stage name is required' });
        }

        await pipeline.addStage({
            name,
            probability: probability || 0,
            color: color || '#6366f1'
        });

        const updatedPipeline = await SalesPipeline.findById(pipeline._id)
            .populate('createdBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email');

        res.json(updatedPipeline);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Update stage
router.put('/:id/stages/:stageId', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        const stage = pipeline.stages.id(req.params.stageId);
        if (!stage) {
            return res.status(404).json({ error: 'Stage not found' });
        }

        const { name, probability, color, isActive } = req.body;

        if (name) stage.name = name;
        if (probability !== undefined) stage.probability = probability;
        if (color) stage.color = color;
        if (isActive !== undefined) stage.isActive = isActive;

        pipeline.lastModifiedBy = req.user.id;
        await pipeline.save();

        const updatedPipeline = await SalesPipeline.findById(pipeline._id)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email');

        res.json(updatedPipeline);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Delete stage
router.delete('/:id/stages/:stageId', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        const stage = pipeline.stages.id(req.params.stageId);
        if (!stage) {
            return res.status(404).json({ error: 'Stage not found' });
        }

        // Check if stage has leads
        const leadsInStage = await Lead.find({ 
            pipeline: pipeline._id,
            status: stage.name
        });
        
        if (leadsInStage.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete stage with active leads. Please reassign leads first.' 
            });
        }

        stage.remove();
        pipeline.lastModifiedBy = req.user.id;
        await pipeline.save();

        const updatedPipeline = await SalesPipeline.findById(pipeline._id)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email');

        res.json(updatedPipeline);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Reorder stages
router.put('/:id/stages/reorder', async (req, res) => {
    try {
        const { stageIds } = req.body;
        
        if (!stageIds || !Array.isArray(stageIds)) {
            return res.status(400).json({ error: 'Stage IDs array is required' });
        }

        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        await pipeline.reorderStages(stageIds);
        pipeline.lastModifiedBy = req.user.id;
        await pipeline.save();

        const updatedPipeline = await SalesPipeline.findById(pipeline._id)
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .populate('access.managers', 'name email')
            .populate('access.employees', 'name email');

        res.json(updatedPipeline);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== PIPELINE ANALYTICS =====

// Get pipeline analytics
router.get('/:id/analytics', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        // Get leads in this pipeline
        const leads = await Lead.find({ 
            pipeline: pipeline._id,
            status: { $ne: 'Deleted' }
        }).populate('assignedTo', 'name email');

        // Calculate stage distribution
        const stageDistribution = {};
        pipeline.stages.forEach(stage => {
            stageDistribution[stage.name] = leads.filter(lead => lead.status === stage.name).length;
        });

        // Calculate conversion rates
        const conversionRates = {};
        pipeline.stages.forEach(stage => {
            const stageLeads = leads.filter(lead => lead.status === stage.name);
            const totalLeads = leads.length;
            conversionRates[stage.name] = totalLeads > 0 ? 
                Math.round((stageLeads.length / totalLeads) * 100) : 0;
        });

        // Calculate average time in each stage
        const stageTimes = {};
        pipeline.stages.forEach(stage => {
            const stageLeads = leads.filter(lead => lead.status === stage.name);
            const times = stageLeads.map(lead => {
                const created = new Date(lead.createdAt);
                const updated = new Date(lead.updatedAt);
                return Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
            });
            
            stageTimes[stage.name] = times.length > 0 ? 
                Math.round(times.reduce((sum, time) => sum + time, 0) / times.length) : 0;
        });

        // Calculate pipeline velocity
        const wonLeads = leads.filter(lead => 
            lead.status === 'Closed Won' || lead.status === 'Won'
        );
        
        const totalValue = wonLeads.reduce((sum, lead) => 
            sum + (lead.sellingPrice || 0), 0
        );

        const analytics = {
            pipeline: {
                id: pipeline._id,
                name: pipeline.name,
                totalStages: pipeline.stages.length,
                activeStages: pipeline.stages.filter(s => s.isActive).length
            },
            leads: {
                total: leads.length,
                byStage: stageDistribution,
                conversionRates,
                averageTimeInStage: stageTimes
            },
            performance: {
                totalValue,
                wonLeads: wonLeads.length,
                conversionRate: leads.length > 0 ? 
                    Math.round((wonLeads.length / leads.length) * 100) : 0,
                averageDealValue: wonLeads.length > 0 ? 
                    Math.round(totalValue / wonLeads.length) : 0
            },
            velocity: {
                averageTimeInPipeline: pipeline.metrics.averageTimeInPipeline,
                leadsPerDay: leads.length > 0 ? 
                    Math.round(leads.length / Math.max(pipeline.metrics.averageTimeInPipeline, 1)) : 0
            }
        };

        res.json(analytics);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ===== PIPELINE ASSIGNMENT =====

// Assign leads to pipeline
router.post('/:id/assign-leads', async (req, res) => {
    try {
        const { leadIds, stage } = req.body;
        
        if (!leadIds || !Array.isArray(leadIds)) {
            return res.status(400).json({ error: 'Lead IDs array is required' });
        }

        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        // Validate stage if provided
        if (stage) {
            const validStage = pipeline.stages.find(s => s.name === stage);
            if (!validStage) {
                return res.status(400).json({ error: 'Invalid stage name' });
            }
        }

        // Update leads
        const updateData = { pipeline: pipeline._id };
        if (stage) {
            updateData.status = stage;
        }

        await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: updateData }
        );

        // Recalculate pipeline metrics
        await pipeline.calculateMetrics();

        res.json({ 
            message: `${leadIds.length} leads assigned to pipeline`,
            updatedLeads: leadIds.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get leads in pipeline
router.get('/:id/leads', async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id);
        
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        const leads = await Lead.find({ pipeline: pipeline._id })
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
