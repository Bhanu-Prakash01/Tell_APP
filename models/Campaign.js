const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  targetAudience: {
    type: String,
    required: true,
    enum: ['all', 'new', 'hot', 'follow-up', 'custom']
  },
  customFilters: {
    status: [String],
    dateRange: {
      start: Date,
      end: Date
    },
    assignedEmployee: String
  },
  campaignType: {
    type: String,
    required: true,
    enum: ['email', 'sms', 'social', 'phone', 'multi']
  },
  budget: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    default: 'Draft',
    enum: ['Draft', 'Active', 'Paused', 'Completed', 'Cancelled']
  },
  abTesting: {
    enabled: {
      type: Boolean,
      default: false
    },
    variantAName: String,
    variantBName: String,
    testDuration: {
      type: Number,
      min: 1,
      max: 30,
      default: 7
    },
    startDate: Date,
    endDate: Date,
    results: {
      variantA: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        ctr: { type: Number, default: 0 },
        conversionRate: { type: Number, default: 0 }
      },
      variantB: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        ctr: { type: Number, default: 0 },
        conversionRate: { type: Number, default: 0 }
      },
      winner: String
    }
  },
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    }
  },
  metrics: {
    reach: {
      type: Number,
      default: 0
    },
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    engagementRate: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    ctr: {
      type: Number,
      default: 0
    },
    roi: {
      type: Number,
      default: 0
    },
    cost: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  },
  performance: {
    dailyStats: [{
      date: Date,
      impressions: Number,
      clicks: Number,
      conversions: Number,
      cost: Number
    }],
    audienceInsights: {
      demographics: {
        ageGroups: Map,
        locations: Map,
        interests: [String]
      },
      behavior: {
        engagementTime: Number,
        bounceRate: Number,
        returnRate: Number
      }
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  leads: [{
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead'
    },
    status: {
      type: String,
      enum: ['targeted', 'contacted', 'responded', 'converted', 'unsubscribed'],
      default: 'targeted'
    },
    variant: String,
    contactDate: Date,
    responseDate: Date,
    notes: String
  }],
  tags: [String],
  settings: {
    autoOptimize: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    maxContacts: Number
  }
}, {
  timestamps: true
});

// Indexes for better query performance
campaignSchema.index({ status: 1, startDate: 1, endDate: 1 });
campaignSchema.index({ createdBy: 1, status: 1 });
campaignSchema.index({ 'abTesting.enabled': 1 });

// Virtual for campaign duration
campaignSchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for campaign progress
campaignSchema.virtual('progress').get(function() {
  if (this.startDate && this.endDate) {
    const now = new Date();
    const total = this.endDate - this.startDate;
    const elapsed = now - this.startDate;
    
    if (elapsed <= 0) return 0;
    if (elapsed >= total) return 100;
    
    return Math.round((elapsed / total) * 100);
  }
  return 0;
});

// Method to calculate performance metrics
campaignSchema.methods.calculateMetrics = function() {
  if (this.performance.dailyStats.length === 0) return;
  
  const totalImpressions = this.performance.dailyStats.reduce((sum, stat) => sum + stat.impressions, 0);
  const totalClicks = this.performance.dailyStats.reduce((sum, stat) => sum + stat.clicks, 0);
  const totalConversions = this.performance.dailyStats.reduce((sum, stat) => sum + stat.conversions, 0);
  const totalCost = this.performance.dailyStats.reduce((sum, stat) => sum + stat.cost, 0);
  
  this.metrics.impressions = totalImpressions;
  this.metrics.clicks = totalClicks;
  this.metrics.conversions = totalConversions;
  this.metrics.cost = totalCost;
  
  if (totalImpressions > 0) {
    this.metrics.ctr = Math.round((totalClicks / totalImpressions) * 100 * 100) / 100;
  }
  
  if (totalClicks > 0) {
    this.metrics.engagementRate = Math.round((totalConversions / totalClicks) * 100 * 100) / 100;
  }
  
  if (totalCost > 0 && this.metrics.revenue > 0) {
    this.metrics.roi = Math.round(((this.metrics.revenue - totalCost) / totalCost) * 100 * 100) / 100;
  }
};

// Method to update A/B testing results
campaignSchema.methods.updateABTestResults = function() {
  if (!this.abTesting.enabled) return;
  
  const variantA = this.abTesting.results.variantA;
  const variantB = this.abTesting.results.variantB;
  
  if (variantA.impressions > 0) {
    variantA.ctr = Math.round((variantA.clicks / variantA.impressions) * 100 * 100) / 100;
  }
  if (variantA.clicks > 0) {
    variantA.conversionRate = Math.round((variantA.conversions / variantA.clicks) * 100 * 100) / 100;
  }
  
  if (variantB.impressions > 0) {
    variantB.ctr = Math.round((variantB.clicks / variantB.impressions) * 100 * 100) / 100;
  }
  if (variantB.clicks > 0) {
    variantB.conversionRate = Math.round((variantB.conversions / variantB.clicks) * 100 * 100) / 100;
  }
  
  // Determine winner based on conversion rate
  if (variantA.conversionRate > variantB.conversionRate) {
    this.abTesting.results.winner = 'A';
  } else if (variantB.conversionRate > variantA.conversionRate) {
    this.abTesting.results.winner = 'B';
  } else {
    this.abTesting.results.winner = 'Tie';
  }
};

// Pre-save middleware to calculate metrics
campaignSchema.pre('save', function(next) {
  this.calculateMetrics();
  this.updateABTestResults();
  next();
});

module.exports = mongoose.model('Campaign', campaignSchema);
