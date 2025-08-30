const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    status: { type: String, default: 'New' }, // New, Interested, Hot, Follow-up, Won, Lost, Dead
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

module.exports = mongoose.model('Lead', leadSchema);
