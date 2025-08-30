const mongoose = require('mongoose');

const SimCardSchema = new mongoose.Schema({
    // Basic SIM information
    simNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    
    // Carrier information
    carrier: {
        type: String,
        required: true,
        enum: ['Airtel', 'Jio', 'Vodafone', 'BSNL', 'MTNL', 'Other'],
        default: 'Other'
    },
    
    // SIM status
    status: {
        type: String,
        required: true,
        enum: ['Active', 'Inactive', 'Suspended', 'Blocked', 'Recharge Required'],
        default: 'Active'
    },
    
    // Balance and usage
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    
    dataBalance: {
        type: Number,
        default: 0, // MB
        min: 0
    },
    
    validity: {
        type: Date,
        required: true
    },
    
    // Assignment
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    
    assignedAt: {
        type: Date,
        default: null
    },
    
    // Usage tracking
    totalCalls: {
        type: Number,
        default: 0
    },
    
    totalMinutes: {
        type: Number,
        default: 0
    },
    
    lastUsed: {
        type: Date,
        default: null
    },
    
    // Call restrictions
    callRestrictions: {
        international: {
            type: Boolean,
            default: false
        },
        premium: {
            type: Boolean,
            default: false
        },
        roaming: {
            type: Boolean,
            default: false
        }
    },
    
    // Plan details
    plan: {
        name: String,
        monthlyRental: Number,
        freeMinutes: Number,
        freeData: Number, // MB
        validityDays: Number
    },
    
    // Location tracking
    currentLocation: {
        city: String,
        state: String,
        country: String,
        lastUpdated: Date
    },
    
    // Network information
    network: {
        signalStrength: {
            type: String,
            enum: ['Excellent', 'Good', 'Fair', 'Poor', 'No Signal'],
            default: 'Good'
        },
        networkType: {
            type: String,
            enum: ['2G', '3G', '4G', '5G'],
            default: '4G'
        }
    },
    
    // Recharge history
    rechargeHistory: [{
        amount: Number,
        date: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['Top-up', 'Plan Recharge', 'Data Recharge', 'Validity Extension'],
            default: 'Top-up'
        },
        description: String
    }],
    
    // Call logs summary
    callSummary: {
        today: {
            calls: { type: Number, default: 0 },
            minutes: { type: Number, default: 0 }
        },
        thisWeek: {
            calls: { type: Number, default: 0 },
            minutes: { type: Number, default: 0 }
        },
        thisMonth: {
            calls: { type: Number, default: 0 },
            minutes: { type: Number, default: 0 }
        }
    },
    
    // Settings
    settings: {
        autoRecharge: {
            enabled: { type: Boolean, default: false },
            threshold: { type: Number, default: 10 }, // Recharge when balance falls below this
            amount: { type: Number, default: 100 }
        },
        notifications: {
            lowBalance: { type: Boolean, default: true },
            validityExpiry: { type: Boolean, default: true },
            usageAlerts: { type: Boolean, default: true }
        }
    },
    
    // Notes and tags
    notes: String,
    tags: [String],
    
    // Audit trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes for better query performance
SimCardSchema.index({ simNumber: 1 });
SimCardSchema.index({ assignedTo: 1 });
SimCardSchema.index({ status: 1 });
SimCardSchema.index({ carrier: 1 });
SimCardSchema.index({ validity: 1 });

// Virtual for days until expiry
SimCardSchema.virtual('daysUntilExpiry').get(function() {
    if (!this.validity) return null;
    const now = new Date();
    const diffTime = this.validity.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
});

// Virtual for SIM health status
SimCardSchema.virtual('healthStatus').get(function() {
    if (this.status !== 'Active') return this.status;
    
    const daysUntilExpiry = this.daysUntilExpiry;
    if (daysUntilExpiry <= 0) return 'Expired';
    if (daysUntilExpiry <= 7) return 'Expiring Soon';
    if (this.balance < 10) return 'Low Balance';
    if (this.balance < 50) return 'Balance Warning';
    
    return 'Healthy';
});

// Method to check if SIM can make calls
SimCardSchema.methods.canMakeCall = function() {
    return this.status === 'Active' && 
           this.balance > 0 && 
           this.validity > new Date() &&
           this.assignedTo !== null;
};

// Method to update call summary
SimCardSchema.methods.updateCallSummary = function(callDuration) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Update today's summary
    if (this.callSummary.today.date && 
        this.callSummary.today.date.getTime() === today.getTime()) {
        this.callSummary.today.calls += 1;
        this.callSummary.today.minutes += callDuration;
    } else {
        this.callSummary.today = {
            date: today,
            calls: 1,
            minutes: callDuration
        };
    }
    
    // Update this week's summary
    if (now >= weekStart && now < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        this.callSummary.thisWeek.calls += 1;
        this.callSummary.thisWeek.minutes += callDuration;
    }
    
    // Update this month's summary
    if (now >= monthStart && now < new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)) {
        this.callSummary.thisMonth.calls += 1;
        this.callSummary.thisMonth.minutes += callDuration;
    }
    
    this.totalCalls += 1;
    this.totalMinutes += callDuration;
    this.lastUsed = now;
};

// Pre-save middleware to update lastModifiedBy
SimCardSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.lastModifiedBy = this.assignedTo;
    }
    next();
});

module.exports = mongoose.model('SimCard', SimCardSchema);
