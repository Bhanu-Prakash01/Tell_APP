// controllers/employeeController.js
const Lead = require('../models/Lead');
const CallLog = require('../models/CallLog');

// GET /api/employee/leads
// returns the leads assigned to the logged-in employee
exports.getMyLeads = async (req, res) => {
  try {
    // req.user is the full user doc from auth middleware
    const userId = req.user._id;
    const leads = await Lead.find({ assignedTo: userId })
      .select('name email phone status callStatus notes followUpDate createdAt createdBy previousAssignments')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Add assignment history for each lead
    const leadsWithHistory = leads.map(lead => {
      const leadObj = lead.toObject();
      leadObj.assignmentHistory = lead.getAssignmentHistory();
      return leadObj;
    });

    res.json(leadsWithHistory);
  } catch (err) {
    console.error('getMyLeads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads', details: err.message });
  }
};

// PUT /api/employee/update-lead
// body: { leadId, note, status, followUpDate }
// only allowed if lead.assignedTo === req.user._id
exports.updateLeadNotes = async (req, res) => {
  try {
    const { leadId, note, status, followUpDate } = req.body;
    
    // Handle empty string followUpDate
    const cleanFollowUpDate = followUpDate && followUpDate.trim() !== '' ? followUpDate : undefined;
    
    console.log('Updating lead:', { leadId, note: note ? 'provided' : 'not provided', status, followUpDate: cleanFollowUpDate });
    
    if (!leadId) return res.status(400).json({ error: 'leadId required' });

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // ensure this lead is assigned to this employee
    if (!lead.assignedTo || String(lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not allowed to update this lead' });
    }

    // push a note if provided
    if (note) {
      // Since notes is a string field, we'll append the new note with a separator
      if (lead.notes) {
        lead.notes = lead.notes + '\n\n' + note;
      } else {
        lead.notes = note;
      }
    }

    // Handle status change and follow-up date logic
    if (status) {
      // Track previous assignment before changing status
      if (lead.assignedTo && String(lead.assignedTo) !== String(req.user._id)) {
        if (!lead.previousAssignments) lead.previousAssignments = [];
        lead.previousAssignments.push({
          employee: lead.assignedTo,
          assignedAt: new Date(),
          status: lead.status
        });
      }
      
      lead.status = status;
      
      // If status is changing to "Follow-up", require followUpDate
      if (status === 'Follow-up') {
        if (!cleanFollowUpDate) {
          return res.status(400).json({ error: 'Follow-up date is required when status is set to Follow-up' });
        }
        
        // Validate that follow-up date is not in the past
        const selectedDate = new Date(cleanFollowUpDate);
        if (isNaN(selectedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid follow-up date format' });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
          return res.status(400).json({ error: 'Follow-up date cannot be in the past' });
        }
        
        lead.followUpDate = new Date(cleanFollowUpDate);
      } else if (status === 'Hot') {
        // When status changes to Hot, clear follow-up date and set reassignment date to 2 weeks from now
        lead.followUpDate = undefined;
        lead.reassignmentDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
      } else {
        // If status is changing to something other than "Follow-up" or "Hot", clear the followUpDate
        lead.followUpDate = undefined;
        lead.reassignmentDate = undefined;
      }
    } else if (cleanFollowUpDate) {
      // If only followUpDate is provided (without status change), 
      // only allow it if the current status is "Follow-up"
      if (lead.status === 'Follow-up') {
        // Validate that follow-up date is not in the past
        const selectedDate = new Date(cleanFollowUpDate);
        if (isNaN(selectedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid follow-up date format' });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
          return res.status(400).json({ error: 'Follow-up date cannot be in the past' });
        }
        
        lead.followUpDate = new Date(cleanFollowUpDate);
      } else {
        return res.status(400).json({ error: 'Can only set follow-up date when status is Follow-up' });
      }
    }

    await lead.save();
    // Return the updated lead (selecting important fields)
    const updated = await Lead.findById(leadId).select('name phone email status notes followUpDate createdAt').populate('createdBy', 'name');
    console.log('Lead updated successfully:', { id: updated._id, status: updated.status, followUpDate: updated.followUpDate });
    res.json({ message: 'Lead updated', lead: updated });
  } catch (err) {
    console.error('updateLeadNotes error:', err);
    res.status(500).json({ error: 'Failed to update lead', details: err.message });
  }
};

// POST /api/employee/call-log
// body: { leadId, callStatus, notes, callDuration, outcome, followUpRequired, followUpDate, callQuality, simCardId, recordingFile }
exports.addCallLog = async (req, res) => {
  try {
    const { 
      leadId, 
      callStatus, 
      notes, 
      callDuration, 
      outcome, 
      followUpRequired, 
      followUpDate,
      callQuality,
      simCardId,
      recordingFile
    } = req.body;
    
    if (!leadId || !callStatus) return res.status(400).json({ error: 'leadId and callStatus required' });

    // ensure lead exists and is assigned to this employee
    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.assignedTo || String(lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Not allowed to log call for this lead' });
    }

    // Validate and fix enum values to match schema
    let validatedCallQuality = callQuality;
    if (callQuality) {
      // Fix enum values to match schema
      if (callQuality.audioQuality === 'Good') {
        validatedCallQuality.audioQuality = 'Clear';
      }
      if (callQuality.signalStrength === 'Good') {
        validatedCallQuality.signalStrength = 'Good'; // This is valid
      }
    }

    // Validate and fix outcome enum values
    let validatedOutcome = outcome;
    if (outcome) {
      // Map invalid outcome values to valid ones
      const outcomeMapping = {
        'Follow-up': 'Follow-up Required',
        'Follow up': 'Follow-up Required',
        'Followup': 'Follow-up Required',
        'Not Interested': 'Not Interested',
        'Interested': 'Interested',
        'Hot Lead': 'Hot Lead',
        'Converted': 'Converted',
        'Positive': 'Positive',
        'Neutral': 'Neutral',
        'Negative': 'Negative',
        'Wrong Number': 'Wrong Number',
        'Switched Off': 'Switched Off'
      };
      
      validatedOutcome = outcomeMapping[outcome] || 'Neutral';
    }

    // Create call log with required fields
    const logData = {
      lead: leadId,
      employee: req.user._id,
      callStatus,
      callStartTime: new Date(), // Set current time as call start
      notes,
      uploadedBy: req.user._id
    };

    // Add SIM card if provided
    if (simCardId) {
      logData.simCard = simCardId;
    }

    // Add recording file if provided
    if (recordingFile) {
      logData.recordingFile = recordingFile;
      // If recording file is provided, set recording duration if available
      if (callDuration) {
        logData.recordingDuration = callDuration;
      }
    }

    // Add optional fields if provided
    if (callDuration !== undefined) logData.callDuration = callDuration;
    if (validatedOutcome) logData.outcome = validatedOutcome;
    if (followUpRequired !== undefined) logData.followUpRequired = followUpRequired;
    if (followUpDate) logData.followUpDate = followUpDate;
    if (validatedCallQuality) logData.callQuality = validatedCallQuality;

    // Log the data being sent for debugging
    console.log('Creating call log with data:', JSON.stringify(logData, null, 2));

    const log = await CallLog.create(logData);

    // Populate the response
    const populatedLog = await CallLog.findById(log._id)
      .populate('lead', 'name phone email status sector region')
      .populate('employee', 'name email');

    res.status(201).json({ message: 'Call log saved', log: populatedLog });
  } catch (err) {
    console.error('addCallLog error:', err);
    res.status(500).json({ error: 'Failed to save call log', details: err.message });
  }
};

// GET /api/employee/my-call-logs
exports.getMyCallLogs = async (req, res) => {
  try {
    const logs = await CallLog.find({ employee: req.user._id })
      .populate('lead', 'name phone email')
      .select('lead callStatus notes createdAt');

    res.json(logs);
  } catch (err) {
    console.error('getMyCallLogs error:', err);
    res.status(500).json({ error: 'Failed to fetch call logs', details: err.message });
  }
};

// GET /api/employee/lead-status/:leadId
// Check if a lead is still assigned to the employee and get current status
exports.checkLeadAssignment = async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user._id;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Check if lead is still assigned to this employee
    if (!lead.assignedTo || String(lead.assignedTo) !== String(userId)) {
      return res.json({
        assigned: false,
        message: 'This lead has been reassigned to another employee',
        currentAssignee: lead.assignedTo,
        callStatus: lead.callStatus,
        status: lead.status
      });
    }

    res.json({
      assigned: true,
      callStatus: lead.callStatus,
      status: lead.status,
      message: 'Lead is still assigned to you'
    });
  } catch (err) {
    console.error('checkLeadAssignment error:', err);
    res.status(500).json({ error: 'Failed to check lead assignment', details: err.message });
  }
};

// GET /api/employee/todays-calls
// Get all calls made by the employee on the current date
exports.getTodaysCalls = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get today's call logs for this employee
    const todaysCalls = await CallLog.find({
      employee: userId,
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    })
    .populate('lead', 'name phone email status sector region')
    .select('lead callStatus notes callDuration outcome followUpRequired followUpDate recordingUrl callStartTime callEndTime createdAt')
    .sort({ createdAt: -1 });

    // Calculate summary statistics
    const totalCalls = todaysCalls.length;
    const completedCalls = todaysCalls.filter(call => call.callStatus === 'completed').length;
    const totalDuration = todaysCalls.reduce((sum, call) => sum + (call.callDuration || 0), 0);
    const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    // Group calls by status for summary
    const callsByStatus = todaysCalls.reduce((acc, call) => {
      acc[call.callStatus] = (acc[call.callStatus] || 0) + 1;
      return acc;
    }, {});

    // Group calls by outcome for summary
    const callsByOutcome = todaysCalls.reduce((acc, call) => {
      if (call.outcome) {
        acc[call.outcome] = (acc[call.outcome] || 0) + 1;
      }
      return acc;
    }, {});

    res.json({
      calls: todaysCalls,
      summary: {
        totalCalls,
        completedCalls,
        totalDuration,
        averageDuration,
        callsByStatus,
        callsByOutcome,
        date: today.toISOString().split('T')[0] // YYYY-MM-DD format
      }
    });
  } catch (err) {
    console.error('getTodaysCalls error:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s calls', details: err.message });
  }
};

// GET /api/employee/todays-completed-calls
// Get only completed calls made by the employee on the current date
exports.getTodaysCompletedCalls = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get today's completed call logs for this employee only
    const completedCalls = await CallLog.find({
      employee: userId,
      callStatus: 'completed',
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    })
    .populate('lead', 'name phone email status sector region')
    .select('lead callStatus notes callDuration outcome followUpRequired followUpDate recordingUrl callStartTime callEndTime createdAt')
    .sort({ createdAt: -1 });

    // Calculate summary statistics for completed calls only
    const totalCompletedCalls = completedCalls.length;
    const totalDuration = completedCalls.reduce((sum, call) => sum + (call.callDuration || 0), 0);
    const averageDuration = totalCompletedCalls > 0 ? Math.round(totalDuration / totalCompletedCalls) : 0;

    // Group completed calls by outcome for summary
    const callsByOutcome = completedCalls.reduce((acc, call) => {
      if (call.outcome) {
        acc[call.outcome] = (acc[call.outcome] || 0) + 1;
      }
      return acc;
    }, {});

    // Calculate success metrics
    const successfulOutcomes = ['Positive', 'Interested', 'Hot Lead', 'Converted'];
    const successfulCalls = completedCalls.filter(call =>
      successfulOutcomes.includes(call.outcome)
    ).length;
    const successRate = totalCompletedCalls > 0 ? Math.round((successfulCalls / totalCompletedCalls) * 100) : 0;

    res.json({
      calls: completedCalls,
      summary: {
        totalCompletedCalls,
        totalDuration,
        averageDuration,
        callsByOutcome,
        successfulCalls,
        successRate,
        date: today.toISOString().split('T')[0] // YYYY-MM-DD format
      }
    });
  } catch (err) {
    console.error('getTodaysCompletedCalls error:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s completed calls', details: err.message });
  }
};
