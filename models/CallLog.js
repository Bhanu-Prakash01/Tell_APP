const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema({
    // Basic call information
    lead: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Lead', 
        required: true 
    },
    
    employee: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    
    // SIM card used for the call
    simCard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SimCard',
        required: false,
        default: null
    },
    
    // Call details
    callStatus: { 
        type: String, 
        enum: ['completed', 'missed', 'declined', 'not_lifted', 'wrong_number', 'busy', 'unreachable', 'voicemail'], 
        required: true 
    },
    
    // Call duration and timing
    callDuration: {
        type: Number, // in seconds
        default: 0,
        min: 0
    },
    
    callStartTime: {
        type: Date,
        required: true
    },
    
    callEndTime: {
        type: Date
    },
    
    // Call quality metrics
    callQuality: {
        signalStrength: {
            type: String,
            enum: ['Excellent', 'Good', 'Fair', 'Poor'],
            default: 'Good'
        },
        networkType: {
            type: String,
            enum: ['2G', '3G', '4G', '5G'],
            default: '4G'
        },
        audioQuality: {
            type: String,
            enum: ['Crystal Clear', 'Clear', 'Fair', 'Poor', 'Unusable'],
            default: 'Clear'
        }
    },
    
    // Call outcome and notes
    outcome: {
        type: String,
        enum: ['Positive', 'Neutral', 'Negative', 'Follow-up Required', 'Not Interested', 'Interested', 'Hot Lead', 'Converted', 'Wrong Number', 'Switched Off'],
        default: 'Neutral'
    },
    
    notes: {
        type: String,
        maxlength: 1000
    },
    
    // Follow-up information
    followUpRequired: {
        type: Boolean,
        default: false
    },
    
    followUpDate: {
        type: Date
    },
    
    followUpNotes: {
        type: String,
        maxlength: 500
    },
    
    // Lead status after call
    leadStatusAfterCall: {
        type: String,
        enum: ['New', 'Interested', 'Hot', 'Follow-up', 'Won', 'Lost', 'No Change'],
        default: 'No Change'
    },
    
    // Call recording
    recordingFile: {
        type: String, // File path or URL
        required: false
    },
    
    recordingUrl: {
        type: String
    },
    
    recordingDuration: {
        type: Number, // in seconds
        default: 0
    },
    
    // File hash for duplicate detection
    fileHash: {
        type: String,
        required: false,
        index: true // Add index for faster duplicate checking
    },
    
    // Cost tracking
    callCost: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Location tracking
    callLocation: {
        city: String,
        state: String,
        country: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    
    // Call tags for categorization
    tags: [{
        type: String,
        enum: ['Sales Call', 'Support Call', 'Follow-up', 'Cold Call', 'Warm Call', 'Hot Lead', 'Demo Call', 'Survey Call']
    }],
    
    // Call script used
    scriptUsed: {
        type: String,
        enum: ['Sales Pitch', 'Support Script', 'Follow-up Script', 'Survey Script', 'Custom Script', 'No Script'],
        default: 'No Script'
    },
    
    // Call effectiveness metrics
    effectiveness: {
        engagement: {
            type: Number,
            min: 1,
            max: 10,
            default: 5
        },
        interest: {
            type: Number,
            min: 1,
            max: 10,
            default: 5
        },
        conversion: {
            type: Number,
            min: 1,
            max: 10,
            default: 5
        }
    },
    
    // Call result details
    resultDetails: {
        productInterest: [String],
        objections: [String],
        nextSteps: String,
        decisionMaker: {
            type: String,
            enum: ['Yes', 'No', 'Maybe', 'Not Discussed'],
            default: 'Not Discussed'
        },
        budget: {
            type: String,
            enum: ['Confirmed', 'Discussed', 'Not Discussed', 'No Budget'],
            default: 'Not Discussed'
        },
        timeline: {
            type: String,
            enum: ['Immediate', 'This Month', 'Next Month', 'Next Quarter', 'Not Discussed'],
            default: 'Not Discussed'
        }
    },
    
    // Call scheduling
    scheduledCall: {
        isScheduled: {
            type: Boolean,
            default: false
        },
        scheduledTime: Date,
        reminderSent: {
            type: Boolean,
            default: false
        }
    },
    
    // Integration with CRM
    crmIntegration: {
        leadUpdated: {
            type: Boolean,
            default: false
        },
        taskCreated: {
            type: Boolean,
            default: false
        },
        followUpScheduled: {
            type: Boolean,
            default: false
        }
    },
    
    // Audit trail
    uploadedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { 
    timestamps: true 
});

// Indexes for better query performance
CallLogSchema.index({ lead: 1, createdAt: -1 });
CallLogSchema.index({ employee: 1, createdAt: -1 });
CallLogSchema.index({ simCard: 1, createdAt: -1 }); // This will include null values
CallLogSchema.index({ callStatus: 1 });
CallLogSchema.index({ outcome: 1 });
CallLogSchema.index({ callStartTime: 1 });
CallLogSchema.index({ followUpRequired: 1, followUpDate: 1 });

// Virtual for call efficiency score
CallLogSchema.virtual('efficiencyScore').get(function() {
    if (this.callDuration === 0) return 0;
    
    const baseScore = 50;
    const durationScore = Math.min(20, this.callDuration / 60); // Max 20 points for duration
    const qualityScore = this.callQuality.audioQuality === 'Crystal Clear' ? 15 : 
                        this.callQuality.audioQuality === 'Clear' ? 10 : 5;
    const outcomeScore = this.outcome === 'Converted' ? 15 : 
                        this.outcome === 'Hot Lead' ? 10 : 
                        this.outcome === 'Interested' ? 5 : 0;
    
    return Math.min(100, baseScore + durationScore + qualityScore + outcomeScore);
});

// Virtual for call success rate
CallLogSchema.virtual('isSuccessful').get(function() {
    return ['completed', 'voicemail'].includes(this.callStatus) && 
           ['Positive', 'Interested', 'Hot Lead', 'Converted'].includes(this.outcome);
});

// Method to calculate call cost based on duration and plan
CallLogSchema.methods.calculateCallCost = function() {
    // Mock calculation - in real implementation, this would use actual plan rates
    const baseRate = 0.5; // Rs per minute
    const durationMinutes = this.callDuration / 60;
    this.callCost = Math.round(durationMinutes * baseRate * 100) / 100;
    return this.callCost;
};

// Method to update lead status based on call outcome
CallLogSchema.methods.updateLeadStatus = async function() {
    if (this.leadStatusAfterCall !== 'No Change') {
        const Lead = mongoose.model('Lead');
        await Lead.findByIdAndUpdate(this.lead, {
            status: this.leadStatusAfterCall,
            notes: this.notes,
            followUpDate: this.followUpDate
        });
    }
};

// Pre-save middleware
CallLogSchema.pre('save', function(next) {
    // Calculate call duration if start and end times are provided
    if (this.callStartTime && this.callEndTime) {
        this.callDuration = Math.round((this.callEndTime - this.callStartTime) / 1000);
    }
    
    // Calculate call cost
    if (this.callDuration > 0) {
        this.calculateCallCost();
    }
    
    // Set default values
    if (!this.uploadedBy) {
        this.uploadedBy = this.employee;
    }
    
    next();
});

// Post-save middleware
CallLogSchema.post('save', async function() {
    // Update SIM card call summary if simCard exists
    if (this.simCard) {
        const SimCard = mongoose.model('SimCard');
        await SimCard.findByIdAndUpdate(this.simCard, {
            $inc: { totalCalls: 1, totalMinutes: this.callDuration },
            lastUsed: new Date()
        });
    }
    
    // Update lead status if specified
    if (this.leadStatusAfterCall !== 'No Change') {
        await this.updateLeadStatus();
    }
    
    // Check if lead should be marked as dead
    try {
        const Lead = mongoose.model('Lead');
        const lead = await Lead.findById(this.lead);
        if (lead) {
            // Update last call attempt and increment attempts
            lead.lastCallAttempt = new Date();
            lead.callAttempts = (lead.callAttempts || 0) + 1;
            
            // Check if lead should be marked as dead
            let shouldMarkAsDead = false;
            let deadReason = '';
            
            // Check for wrong number or switched off
            if (this.outcome === 'Wrong Number' || this.outcome === 'Switched Off') {
                shouldMarkAsDead = true;
                deadReason = this.outcome;
            }
            
            // Check if switched off for more than 3 days (3 attempts)
            if (this.outcome === 'Switched Off') {
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                
                // Count switched off attempts in last 3 days
                const switchedOffAttempts = await mongoose.model('CallLog').countDocuments({
                    lead: this.lead,
                    outcome: 'Switched Off',
                    createdAt: { $gte: threeDaysAgo }
                });
                
                if (switchedOffAttempts >= 3) {
                    shouldMarkAsDead = true;
                    deadReason = 'Switched Off';
                }
            }
            
            if (shouldMarkAsDead) {
                lead.status = 'Dead';
                lead.deadLeadReason = deadReason;
                lead.deadLeadDate = new Date();
                lead.assignedTo = null; // Remove assignment
                console.log(`Lead ${lead._id} marked as dead due to: ${deadReason}`);
            }
            
            await lead.save();
        }
    } catch (error) {
        console.error('Error checking lead for dead status:', error);
    }
});

module.exports = mongoose.model('CallLog', CallLogSchema);
