const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    status: { type: String, default: 'New' }, // New, Interested, Hot, Follow-up, Won, Lost, Dead
    callStatus: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Not Required'], default: 'Pending' }, // Call status for allocated leads
    notes: { type: String },
    recordingUrl: { type: String }, // URL of uploaded audio
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // employee assigned
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // manager/admin who created
    followUpDate: { type: Date }, // Date for follow-up when status is "Follow-up"
    // New fields for manager functionality
    sellingPrice: { type: Number }, // Price when lead is won
    lossReason: { type: String }, // Reason when lead is lost
    reassignmentDate: { type: Date }, // Date when lead should be reassigned (for lost leads)
    // Dead lead tracking
    deadLeadReason: { type: String, enum: ['Wrong Number', 'Switched Off', 'Not Interested', 'Other'] },
    deadLeadDate: { type: Date },
    lastCallAttempt: { type: Date },
    callAttempts: { type: Number, default: 0 },
    // New fields for analytics
    sector: { type: String, enum: ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Real Estate', 'Other'], default: 'Other' },
    region: { type: String, enum: [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 
        'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
        'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
        'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 
        'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 
        'Ladakh', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 
        'Lakshadweep', 'Puducherry', 'Andaman and Nicobar Islands'
    ], default: 'Maharashtra' },
    previousAssignments: [{ 
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        assignedAt: { type: Date, default: Date.now },
        status: { type: String }
    }],
    pipeline: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesPipeline' },
    createdAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
leadSchema.index({ assignedTo: 1, callStatus: 1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ callStatus: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, createdAt: -1 });

// Pre-save middleware to set callStatus to "Pending" when lead is allocated
leadSchema.pre('save', function(next) {
    // If lead is being assigned to an employee and callStatus is still default, set it to "Pending"
    if (this.assignedTo && this.callStatus === 'Pending') {
        // callStatus is already "Pending" by default, which is what we want
        // This ensures that whenever a lead is allocated, it starts with "Pending" status
    }
    next();
});

// Method to allocate lead to employee
leadSchema.methods.allocateToEmployee = function(employeeId) {
    // Track previous assignment for historical data
    if (this.assignedTo && String(this.assignedTo) !== String(employeeId)) {
        if (!this.previousAssignments) this.previousAssignments = [];
        this.previousAssignments.push({
            employee: this.assignedTo,
            assignedAt: new Date(),
            status: this.status
        });
    }

    this.assignedTo = employeeId;
    this.callStatus = 'Pending'; // Automatically set to Pending when allocated
    return this.save();
};

// Method to reassign lead with proper status transition and historical tracking
leadSchema.methods.reassignToEmployee = function(employeeId, reassignedBy) {
    // Track previous assignment for historical data
    if (this.assignedTo && String(this.assignedTo) !== String(employeeId)) {
        if (!this.previousAssignments) this.previousAssignments = [];
        this.previousAssignments.push({
            employee: this.assignedTo,
            assignedAt: new Date(),
            status: this.status,
            reassignedBy: reassignedBy
        });
    }

    this.assignedTo = employeeId;
    this.callStatus = 'Pending'; // Transition from completed to pending
    return this.save();
};

// Method to get assignment history
leadSchema.methods.getAssignmentHistory = function() {
    if (!this.previousAssignments || this.previousAssignments.length === 0) {
        return [];
    }

    return [
        {
            employee: this.assignedTo,
            assignedAt: this.updatedAt || this.createdAt,
            status: this.status,
            isCurrent: true
        },
        ...this.previousAssignments.map(assignment => ({
            ...assignment,
            isCurrent: false
        }))
    ].sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));
};

// Method to update call status
leadSchema.methods.updateCallStatus = function(newStatus) {
    if (['Pending', 'In Progress', 'Completed', 'Not Required'].includes(newStatus)) {
        this.callStatus = newStatus;
        return this.save();
    }
    throw new Error('Invalid call status');
};

module.exports = mongoose.model('Lead', leadSchema);
