const SalesPipeline = require('../models/SalesPipeline');
const Lead = require('../models/Lead');
const User = require('../models/User');

// Get all pipelines for admin
const getPipelines = async (req, res) => {
  try {
    const pipelines = await SalesPipeline.find()
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('access.managers', 'name email')
      .populate('access.employees', 'name email')
      .sort({ createdAt: -1 });

    res.json(pipelines);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pipelines', error: error.message });
  }
};

// Get single pipeline by ID
const getPipeline = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .populate('access.managers', 'name email')
      .populate('access.employees', 'name email');

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    // Calculate metrics
    await pipeline.calculateMetrics();

    res.json(pipeline);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pipeline', error: error.message });
  }
};

// Create new pipeline
const createPipeline = async (req, res) => {
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
      return res.status(400).json({ message: 'Pipeline name is required' });
    }

    // Check if pipeline with same name exists
    const existingPipeline = await SalesPipeline.findOne({ name });
    if (existingPipeline) {
      return res.status(400).json({ message: 'Pipeline with this name already exists' });
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
  } catch (error) {
    res.status(500).json({ message: 'Error creating pipeline', error: error.message });
  }
};

// Update pipeline
const updatePipeline = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id);

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
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
  } catch (error) {
    res.status(500).json({ message: 'Error updating pipeline', error: error.message });
  }
};

// Delete pipeline
const deletePipeline = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id);

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    // Check if pipeline has leads
    const leadsInPipeline = await Lead.find({ pipeline: pipeline._id });
    if (leadsInPipeline.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete pipeline with active leads. Please reassign leads first.' 
      });
    }

    await SalesPipeline.findByIdAndDelete(req.params.id);
    res.json({ message: 'Pipeline deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting pipeline', error: error.message });
  }
};

// Add stage to pipeline
const addStage = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id);

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const { name, probability, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Stage name is required' });
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
  } catch (error) {
    res.status(500).json({ message: 'Error adding stage', error: error.message });
  }
};

// Update stage
const updateStage = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id);

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const stage = pipeline.stages.id(req.params.stageId);
    if (!stage) {
      return res.status(404).json({ message: 'Stage not found' });
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
  } catch (error) {
    res.status(500).json({ message: 'Error updating stage', error: error.message });
  }
};

// Delete stage
const deleteStage = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id);

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const stage = pipeline.stages.id(req.params.stageId);
    if (!stage) {
      return res.status(404).json({ message: 'Stage not found' });
    }

    // Check if stage has leads
    const leadsInStage = await Lead.find({ 
      pipeline: pipeline._id,
      status: stage.name
    });
    
    if (leadsInStage.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete stage with active leads. Please reassign leads first.' 
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
  } catch (error) {
    res.status(500).json({ message: 'Error deleting stage', error: error.message });
  }
};

// Reorder stages
const reorderStages = async (req, res) => {
  try {
    const { stageIds } = req.body;
    
    if (!stageIds || !Array.isArray(stageIds)) {
      return res.status(400).json({ message: 'Stage IDs array is required' });
    }

    const pipeline = await SalesPipeline.findById(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
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
  } catch (error) {
    res.status(500).json({ message: 'Error reordering stages', error: error.message });
  }
};

// Get pipeline analytics
const getPipelineAnalytics = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
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
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

// Get comprehensive pipeline analytics for admin
const getPipelineAnalyticsAdmin = async (req, res) => {
  try {
    const pipelines = await SalesPipeline.find()
      .populate('createdBy', 'name email');

    // Pipeline status distribution
    const statusDistribution = pipelines.reduce((acc, pipeline) => {
      acc[pipeline.status] = (acc[pipeline.status] || 0) + 1;
      return acc;
    }, {});

    // Pipeline performance metrics
    const performanceMetrics = await Promise.all(pipelines.map(async (pipeline) => {
      await pipeline.calculateMetrics();
      return {
        id: pipeline._id,
        name: pipeline.name,
        status: pipeline.status,
        totalLeads: pipeline.metrics.totalLeads,
        conversionRate: pipeline.metrics.conversionRate,
        averageTimeInPipeline: pipeline.metrics.averageTimeInPipeline,
        totalValue: pipeline.metrics.totalValue,
        efficiency: pipeline.efficiency,
        stages: pipeline.stages.length
      };
    }));

    // Top performing pipelines
    const topPipelines = performanceMetrics
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5);

    // Pipeline efficiency analysis
    const efficiencyAnalysis = performanceMetrics
      .filter(p => p.totalLeads > 0)
      .sort((a, b) => b.efficiency - a.efficiency);

    // Monthly pipeline creation trend
    const monthlyTrend = pipelines.reduce((acc, pipeline) => {
      const month = new Date(pipeline.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    res.json({
      statusDistribution,
      performanceMetrics,
      topPipelines,
      efficiencyAnalysis,
      monthlyTrend,
      totalPipelines: pipelines.length,
      activePipelines: pipelines.filter(p => p.status === 'Active').length,
      totalLeads: performanceMetrics.reduce((sum, p) => sum + p.totalLeads, 0),
      averageConversionRate: performanceMetrics.length > 0 ? 
        performanceMetrics.reduce((sum, p) => sum + p.conversionRate, 0) / performanceMetrics.length : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

// Assign leads to pipeline
const assignLeadsToPipeline = async (req, res) => {
  try {
    const { leadIds, stage } = req.body;
    
    if (!leadIds || !Array.isArray(leadIds)) {
      return res.status(400).json({ message: 'Lead IDs array is required' });
    }

    const pipeline = await SalesPipeline.findById(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    // Validate stage if provided
    if (stage) {
      const validStage = pipeline.stages.find(s => s.name === stage);
      if (!validStage) {
        return res.status(400).json({ message: 'Invalid stage name' });
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
  } catch (error) {
    res.status(500).json({ message: 'Error assigning leads', error: error.message });
  }
};

// Get leads in pipeline
const getPipelineLeads = async (req, res) => {
  try {
    const pipeline = await SalesPipeline.findById(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const leads = await Lead.find({ pipeline: pipeline._id })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

// Get pipeline insights and recommendations
const getPipelineInsights = async (req, res) => {
  try {
    const pipelines = await SalesPipeline.find();
    
    const insights = {
      topPerformingPipelines: pipelines
        .filter(p => p.metrics.conversionRate > 0)
        .sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate)
        .slice(0, 3)
        .map(p => ({
          name: p.name,
          conversionRate: p.metrics.conversionRate,
          totalLeads: p.metrics.totalLeads,
          efficiency: p.efficiency
        })),

      underperformingPipelines: pipelines
        .filter(p => p.metrics.conversionRate < 10 && p.status === 'Active')
        .map(p => ({
          name: p.name,
          conversionRate: p.metrics.conversionRate,
          recommendations: [
            'Review pipeline stages and flow',
            'Analyze lead quality and targeting',
            'Consider stage optimization'
          ]
        })),

      stageInsights: pipelines.reduce((acc, pipeline) => {
        pipeline.stages.forEach(stage => {
          if (!acc[stage.name]) {
            acc[stage.name] = { count: 0, probability: stage.probability };
          }
          acc[stage.name].count++;
        });
        return acc;
      }, {}),

      recommendations: [
        'Focus on pipelines with conversion rates > 20%',
        'Optimize stages with low conversion rates',
        'Consider lead scoring for better qualification'
      ]
    };

    res.json(insights);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching insights', error: error.message });
  }
};

module.exports = {
  getPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  addStage,
  updateStage,
  deleteStage,
  reorderStages,
  getPipelineAnalytics,
  getPipelineAnalyticsAdmin,
  assignLeadsToPipeline,
  getPipelineLeads,
  getPipelineInsights
};
