const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Campaign name is required'],
    trim: true,
    maxlength: [100, 'Campaign name cannot exceed 100 characters']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Campaign details
  type: {
    type: String,
    enum: {
      values: ['sales', 'support', 'survey', 'promotional', 'retention', 'lead_generation', 'other'],
      message: 'Invalid campaign type'
    },
    required: [true, 'Campaign type is required']
  },

  status: {
    type: String,
    enum: {
      values: ['planning', 'active', 'paused', 'completed', 'cancelled'],
      message: 'Invalid campaign status'
    },
    default: 'planning'
  },

  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'critical'],
      message: 'Priority must be low, medium, high, or critical'
    },
    default: 'medium'
  },

  // Timeline
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },

  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },

  // Target and scope
  targetAudience: {
    type: String,
    trim: true,
    maxlength: [200, 'Target audience description cannot exceed 200 characters']
  },

  targetCount: {
    type: Number,
    min: [0, 'Target count cannot be negative'],
    default: 0
  },

  // Assignment and management
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Campaign manager is required']
  },

  assignedAgents: [{
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    targetLeads: {
      type: Number,
      min: [0, 'Target leads cannot be negative'],
      default: 0
    },
    completedLeads: {
      type: Number,
      default: 0,
      min: [0, 'Completed leads cannot be negative']
    }
  }],

  // Customer targeting criteria
  customerCriteria: {
    categories: [{
      type: String,
      enum: ['vip', 'premium', 'regular', 'new', 'inactive']
    }],
    locations: [String],
    ageRange: {
      min: {
        type: Number,
        min: [0, 'Minimum age cannot be negative']
      },
      max: {
        type: Number,
        min: [0, 'Maximum age cannot be negative']
      }
    },
    leadScore: {
      min: {
        type: Number,
        min: [0, 'Minimum lead score cannot be negative'],
        max: [100, 'Minimum lead score cannot exceed 100']
      },
      max: {
        type: Number,
        min: [0, 'Maximum lead score cannot be negative'],
        max: [100, 'Maximum lead score cannot exceed 100']
      }
    },
    tags: [String],
    excludeRecentContacts: {
      type: Boolean,
      default: false
    },
    daysSinceLastContact: {
      type: Number,
      min: [0, 'Days since last contact cannot be negative']
    }
  },

  // Campaign goals and KPIs
  goals: {
    totalCalls: {
      type: Number,
      min: [0, 'Total calls goal cannot be negative'],
      default: 0
    },
    successfulCalls: {
      type: Number,
      min: [0, 'Successful calls goal cannot be negative'],
      default: 0
    },
    conversionRate: {
      type: Number,
      min: [0, 'Conversion rate cannot be negative'],
      max: [100, 'Conversion rate cannot exceed 100'],
      default: 0
    },
    revenueTarget: {
      type: Number,
      min: [0, 'Revenue target cannot be negative'],
      default: 0
    }
  },

  // Progress tracking
  progress: {
    totalCustomers: {
      type: Number,
      default: 0,
      min: [0, 'Total customers cannot be negative']
    },
    contactedCustomers: {
      type: Number,
      default: 0,
      min: [0, 'Contacted customers cannot be negative']
    },
    convertedCustomers: {
      type: Number,
      default: 0,
      min: [0, 'Converted customers cannot be negative']
    },
    totalCalls: {
      type: Number,
      default: 0,
      min: [0, 'Total calls cannot be negative']
    },
    successfulCalls: {
      type: Number,
      default: 0,
      min: [0, 'Successful calls cannot be negative']
    }
  },

  // Budget and costs
  budget: {
    allocated: {
      type: Number,
      min: [0, 'Allocated budget cannot be negative'],
      default: 0
    },
    spent: {
      type: Number,
      min: [0, 'Spent budget cannot be negative'],
      default: 0
    },
    currency: {
      type: String,
      default: 'INR',
      maxlength: [3, 'Currency code cannot exceed 3 characters']
    }
  },

  // Script and messaging
  callScript: {
    type: String,
    maxlength: [2000, 'Call script cannot exceed 2000 characters']
  },

  objectionHandling: {
    type: String,
    maxlength: [1000, 'Objection handling notes cannot exceed 1000 characters']
  },

  // Communication settings
  communicationSettings: {
    maxCallsPerDay: {
      type: Number,
      min: [1, 'Maximum calls per day must be at least 1'],
      default: 50
    },
    callingHours: {
      start: {
        type: String,
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      end: {
        type: String,
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      }
    },
    daysOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    timeZone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },

  // Results and analytics
  results: {
    totalRevenue: {
      type: Number,
      min: [0, 'Total revenue cannot be negative'],
      default: 0
    },
    conversionRate: {
      type: Number,
      min: [0, 'Conversion rate cannot be negative'],
      max: [100, 'Conversion rate cannot exceed 100'],
      default: 0
    },
    avgCallDuration: {
      type: Number,
      min: [0, 'Average call duration cannot be negative'],
      default: 0
    },
    customerSatisfaction: {
      type: Number,
      min: [0, 'Customer satisfaction cannot be negative'],
      max: [5, 'Customer satisfaction cannot exceed 5'],
      default: 0
    }
  },

  // Tags and notes
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],

  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },

  // Metadata
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign'
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
campaignSchema.index({ name: 'text', description: 'text' });
campaignSchema.index({ status: 1 });
campaignSchema.index({ type: 1 });
campaignSchema.index({ priority: 1 });
campaignSchema.index({ startDate: 1 });
campaignSchema.index({ endDate: 1 });
campaignSchema.index({ manager: 1 });
campaignSchema.index({ 'assignedAgents.agent': 1 });

// Virtual for campaign duration in days
campaignSchema.virtual('durationDays').get(function() {
  if (!this.startDate || !this.endDate) return 0;
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for campaign progress percentage
campaignSchema.virtual('progressPercentage').get(function() {
  if (this.targetCount === 0) return 0;
  return Math.round((this.progress.contactedCustomers / this.targetCount) * 100);
});

// Virtual for campaign effectiveness
campaignSchema.virtual('effectiveness').get(function() {
  if (this.progress.totalCalls === 0) return 0;
  return Math.round((this.progress.successfulCalls / this.progress.totalCalls) * 100);
});

// Static method to find active campaigns
campaignSchema.statics.findActive = function() {
  return this.find({
    status: 'active',
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  });
};

// Static method to find campaigns by manager
campaignSchema.statics.findByManager = function(managerId) {
  return this.find({ manager: managerId });
};

// Static method to get campaign statistics
campaignSchema.statics.getCampaignStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProgress: { $avg: '$progressPercentage' }
      }
    }
  ]);
};

// Instance method to add agent to campaign
campaignSchema.methods.addAgent = function(agentId, targetLeads = 0) {
  const existingAgent = this.assignedAgents.find(
    assignment => assignment.agent.toString() === agentId.toString()
  );

  if (!existingAgent) {
    this.assignedAgents.push({
      agent: agentId,
      targetLeads,
      assignedAt: new Date()
    });
    return this.save();
  }

  return this;
};

// Instance method to update progress
campaignSchema.methods.updateProgress = function(callResult) {
  this.progress.totalCalls += 1;

  if (callResult === 'successful' || callResult === 'converted') {
    this.progress.successfulCalls += 1;
  }

  this.progress.contactedCustomers += 1;

  if (callResult === 'converted') {
    this.progress.convertedCustomers += 1;
  }

  return this.save();
};

// Instance method to check if campaign is active
campaignSchema.methods.isActive = function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.startDate <= now &&
    this.endDate >= now
  );
};

module.exports = mongoose.model('Campaign', campaignSchema);