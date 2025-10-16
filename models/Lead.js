const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: ''
  },

  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },

  website: {
     type: String,
     trim: true,
     lowercase: true
   },

   description: {
     type: String,
     trim: true
   },

   location: {
     type: String,
     trim: true
   },

  sector: {
    type: String,
    trim: true
  },

  status: {
    type: String,
    enum: ["New", "Interested", "Not Interested", "Hot", "Pending", "Completed"],
    default: 'New',
    trim: true
  },

  notes: {
    type: String
  },

  assignedTo: {
    type: String,
    default: 'Unassigned',
    trim: true
  },

  assignedDate: {
    type: Date,
    default: null
  },

  callTime: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Validate call time format: "HH:MM" or duration like "5m 30s"
        if (!v) return true; // Optional field
        const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const durationFormat = /^(\d+h\s*)?(\d+m\s*)?(\d+s\s*)*$/;
        return timeFormat.test(v) || durationFormat.test(v);
      },
      message: 'Call time must be in format "HH:MM" or duration like "5m 30s"'
    }
  },

  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
leadSchema.index({ phone: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });

// Virtual for lead summary
leadSchema.virtual('summary').get(function() {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    status: this.status,
    assignedTo: this.assignedTo,
    createdAt: this.createdAt
  };
});

// Static method to find leads by status
leadSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Static method to find leads by assigned user
leadSchema.statics.findByAssignedTo = function(assignedTo) {
  return this.find({ assignedTo });
};

// Static method to find unassigned leads
leadSchema.statics.findUnassigned = function() {
  return this.find({ assignedTo: 'Unassigned' });
};

// Instance method to assign lead to user
leadSchema.methods.assignTo = function(userName) {
  this.assignedTo = userName;
  this.assignedDate = new Date();
  return this.save();
};

// Instance method to update lead status
leadSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.lastUpdatedAt = new Date();
  return this.save();
};

// Instance method to add notes
leadSchema.methods.addNotes = function(notes) {
  const currentNotes = this.notes || '';
  this.notes = currentNotes + '\n\n' + new Date().toISOString() + ': ' + notes;
  this.lastUpdatedAt = new Date();
  return this.save();
};

// Instance method to update lead with call time
leadSchema.methods.updateWithCall = function(status, notes, callTime) {
  if (status) this.status = status;
  if (notes && notes.trim()) {
    const currentNotes = this.notes || '';
    const timestamp = new Date().toISOString();
    this.notes = currentNotes + `\n\n[${timestamp}] ${this.assignedTo}: ${notes.trim()}`;
  }
  if (callTime) this.callTime = callTime;
  this.lastUpdatedAt = new Date();
  return this.save();
};

// Static method to get call time statistics for employees
leadSchema.statics.getCallTimeStats = function() {
  return this.aggregate([
    {
      $match: {
        callTime: { $exists: true, $ne: null, $ne: '' },
        assignedTo: { $ne: 'Unassigned' }
      }
    },
    {
      $group: {
        _id: '$assignedTo',
        totalLeads: { $sum: 1 },
        totalCallTime: { $sum: { $cond: ['$callTime', 1, 0] } },
        completedLeads: {
          $sum: { $cond: ['$status', { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }, 0] }
        },
        avgCallTime: { $avg: { $cond: ['$callTime', 1, 0] } }
      }
    },
    {
      $sort: { totalLeads: -1 }
    }
  ]);
};

// Static method to find leads by call status
leadSchema.statics.findByCallStatus = function(hasCallTime) {
  const condition = hasCallTime ? { $exists: true, $ne: null, $ne: '' } : { $in: [null, ''] };
  return this.find({ callTime: condition });
};

module.exports = mongoose.model('Lead', leadSchema);