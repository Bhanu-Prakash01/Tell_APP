const mongoose = require('mongoose');

const SalesPipelineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    
    description: {
        type: String,
        trim: true
    },
    
    stages: [{
        name: {
            type: String,
            required: true
        },
        order: {
            type: Number,
            required: true
        },
        probability: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        color: {
            type: String,
            default: '#6366f1'
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // Pipeline settings
    settings: {
        autoAssign: {
            type: Boolean,
            default: false
        },
        defaultStage: {
            type: String,
            default: 'New Lead'
        },
        requireNotes: {
            type: Boolean,
            default: true
        },
        allowStageSkip: {
            type: Boolean,
            default: false
        },
        maxLeadsPerStage: {
            type: Number,
            default: 0 // 0 means unlimited
        }
    },
    
    // Pipeline metrics
    metrics: {
        totalLeads: {
            type: Number,
            default: 0
        },
        conversionRate: {
            type: Number,
            default: 0
        },
        averageTimeInPipeline: {
            type: Number,
            default: 0 // in days
        },
        totalValue: {
            type: Number,
            default: 0
        }
    },
    
    // Pipeline rules and automation
    automation: {
        rules: [{
            name: String,
            condition: {
                field: String,
                operator: {
                    type: String,
                    enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
                },
                value: mongoose.Schema.Types.Mixed
            },
            action: {
                type: {
                    type: String,
                    enum: ['move_to_stage', 'assign_to_user', 'send_notification', 'update_field']
                },
                value: mongoose.Schema.Types.Mixed
            },
            isActive: {
                type: Boolean,
                default: true
            }
        }],
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            },
            inApp: {
                type: Boolean,
                default: true
            }
        }
    },
    
    // Pipeline access control
    access: {
        managers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        employees: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        isPublic: {
            type: Boolean,
            default: false
        }
    },
    
    // Pipeline status
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Archived'],
        default: 'Active'
    },
    
    // Created by admin
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Last modified
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes for better performance
SalesPipelineSchema.index({ status: 1, createdBy: 1 });
SalesPipelineSchema.index({ 'access.managers': 1 });
SalesPipelineSchema.index({ 'access.employees': 1 });

// Virtual for pipeline efficiency
SalesPipelineSchema.virtual('efficiency').get(function() {
    if (this.metrics.totalLeads === 0) return 0;
    
    const wonLeads = this.stages.find(stage => 
        stage.name.toLowerCase().includes('won') || 
        stage.name.toLowerCase().includes('closed')
    );
    
    if (!wonLeads) return 0;
    
    return Math.round((wonLeads.probability / 100) * this.metrics.conversionRate);
});

// Method to calculate pipeline metrics
SalesPipelineSchema.methods.calculateMetrics = async function() {
    const Lead = mongoose.model('Lead');
    
    // Get all leads in this pipeline
    const leads = await Lead.find({ 
        pipeline: this._id,
        status: { $ne: 'Deleted' }
    });
    
    // Calculate metrics
    this.metrics.totalLeads = leads.length;
    
    const wonLeads = leads.filter(lead => 
        lead.status === 'Won' || 
        lead.status === 'Closed'
    );
    
    this.metrics.conversionRate = leads.length > 0 ? 
        Math.round((wonLeads.length / leads.length) * 100) : 0;
    
    // Calculate total value
    this.metrics.totalValue = wonLeads.reduce((sum, lead) => 
        sum + (lead.sellingPrice || 0), 0
    );
    
    // Calculate average time in pipeline
    const leadTimes = leads.map(lead => {
        const created = new Date(lead.createdAt);
        const updated = new Date(lead.updatedAt);
        return Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
    });
    
    this.metrics.averageTimeInPipeline = leadTimes.length > 0 ? 
        Math.round(leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length) : 0;
    
    return this.metrics;
};

// Method to add stage to pipeline
SalesPipelineSchema.methods.addStage = function(stageData) {
    const maxOrder = Math.max(...this.stages.map(s => s.order), 0);
    const newStage = {
        ...stageData,
        order: maxOrder + 1
    };
    
    this.stages.push(newStage);
    return this.save();
};

// Method to reorder stages
SalesPipelineSchema.methods.reorderStages = function(stageIds) {
    stageIds.forEach((stageId, index) => {
        const stage = this.stages.id(stageId);
        if (stage) {
            stage.order = index + 1;
        }
    });
    
    return this.save();
};

// Pre-save middleware
SalesPipelineSchema.pre('save', function(next) {
    // Sort stages by order
    this.stages.sort((a, b) => a.order - b.order);
    
    // Set last modified
    this.lastModifiedBy = this.createdBy;
    
    next();
});

module.exports = mongoose.model('SalesPipeline', SalesPipelineSchema);
