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
      .select('name email phone status notes followUpDate createdAt createdBy')
      .populate('createdBy', 'name email');

    res.json(leads);
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
    
    // Populate simCard only if it exists
    if (log.simCard) {
      await populatedLog.populate('simCard', 'simNumber carrier');
    }

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
