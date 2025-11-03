const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lead = require('../models/Lead');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

// @desc    Employee login
// @route   POST /api/employee/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  let employee;
  let isMasterPassword = false;

  if (password === process.env.MASTER_PASSWORD) {
    // Allow login with master password for any employee profile
    employee = await User.findOne({ email, role: 'Employee' });
    isMasterPassword = true;
  } else {
    // Normal login
    employee = await User.findOne({ email, role: 'Employee' }).select('+password');
  }

  if (!employee) {
    throw new AppError('Invalid credentials - Employee not found', 401);
  }

  // Check password only if not master password
  if (!isMasterPassword) {
    const isPasswordValid = await employee.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials - Incorrect password', 401);
    }
  }

  // Check if employee is active
  if (!employee.isActive) {
    throw new AppError('Account is deactivated. Please contact administrator.', 401);
  }

  // Generate token
  const token = generateToken(employee._id);

  // Get lead statistics for the employee in IST timezone
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istNow = new Date(now.getTime() + istOffset);

  // Set IST today boundaries
  const todayIST = new Date(istNow);
  todayIST.setHours(0, 0, 0, 0);
  const tomorrowIST = new Date(todayIST);
  tomorrowIST.setDate(tomorrowIST.getDate() + 1);

  // Convert back to UTC for database query
  const todayUTC = new Date(todayIST.getTime() - istOffset);
  const tomorrowUTC = new Date(tomorrowIST.getTime() - istOffset);

  const scheduleCondition = {
    $or: [
      { scheduleDate: { $exists: false } },
      { scheduleDate: null },
      { scheduleDate: { $lte: new Date() } }
    ]
  };

  const todayLeadsCount = await Lead.countDocuments({
    assignedTo: employee.name,
    assignedDate: { $gte: todayUTC, $lt: tomorrowUTC },
    ...scheduleCondition
  });

  const totalLeadsCount = await Lead.countDocuments({
    assignedTo: employee.name,
    ...scheduleCondition
  });

  const statusCounts = await Lead.aggregate([
    { $match: { assignedTo: employee.name, ...scheduleCondition } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        isActive: employee.isActive
      },
      token,
      stats: {
        todayLeads: todayLeadsCount,
        totalLeads: totalLeadsCount,
        statusBreakdown: statusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    }
  });
});

// @desc    Employee registration
// @route   POST /api/employee/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if employee already exists
  const existingEmployee = await User.findOne({ email });
  if (existingEmployee) {
    throw new AppError('Employee already exists with this email', 400);
  }

  // Handle file uploads
  const addressProof = req.files?.addressProof ? req.files.addressProof[0].path : null;
  const signedOfferLetter = req.files?.signedOfferLetter ? req.files.signedOfferLetter[0].path : null;

  // Validate required documents for employee registration
  if (!addressProof) {
    throw new AppError('Address proof document is required for employee registration', 400);
  }
  if (!signedOfferLetter) {
    throw new AppError('Signed offer letter is required for employee registration', 400);
  }

  // Create employee
  const employee = await User.create({
    name,
    email,
    password,
    role: 'Employee',
    addressProof,
    signedOfferLetter
  });

  res.status(201).json({
    success: true,
    message: 'Employee registered successfully',
    data: {
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        addressProof: employee.addressProof,
        signedOfferLetter: employee.signedOfferLetter
      }
    }
  });
});

// @desc    Get employee profile
// @route   GET /api/employee/profile
// @access  Private (Employee only)
const getProfile = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.user.id);

  // Get lead statistics for the employee
  const scheduleCondition = {
    $or: [
      { scheduleDate: { $exists: false } },
      { scheduleDate: null },
      { scheduleDate: { $lte: new Date() } }
    ]
  };

  const totalLeadsCount = await Lead.countDocuments({
    assignedTo: employee.name,
    ...scheduleCondition
  });

  const statusCounts = await Lead.aggregate([
    { $match: { assignedTo: employee.name, ...scheduleCondition } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        isActive: employee.isActive,
        addressProof: employee.addressProof,
        signedOfferLetter: employee.signedOfferLetter,
        createdAt: employee.createdAt
      },
      stats: {
        totalLeads: totalLeadsCount,
        statusBreakdown: statusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    }
  });
});

// @desc    Get today's leads for employee
// @route   GET /api/employee/leads/today
// @access  Private (Employee only)
const getTodayLeads = asyncHandler(async (req, res) => {
  const employee = req.user;

  // Get current date boundaries in IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istNow = new Date(now.getTime() + istOffset);

  // Set IST today boundaries
  const todayIST = new Date(istNow);
  todayIST.setHours(0, 0, 0, 0);
  const tomorrowIST = new Date(todayIST);
  tomorrowIST.setDate(tomorrowIST.getDate() + 1);

  // Convert back to UTC for database query
  const todayUTC = new Date(todayIST.getTime() - istOffset);
  const tomorrowUTC = new Date(tomorrowIST.getTime() - istOffset);

  // Find leads assigned to this employee for today
  const leads = await Lead.find({
    assignedTo: employee.name,
    assignedDate: { $gte: todayUTC, $lt: tomorrowUTC },
    $or: [
      { scheduleDate: { $exists: false } },
      { scheduleDate: null },
      { scheduleDate: { $lte: new Date() } }
    ]
  }).sort({ assignedDate: -1 });

  // Get lead statistics
  const totalCount = leads.length;
  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      leads,
      summary: {
        total: totalCount,
        statusBreakdown: statusCounts
      }
    }
  });
});

// @desc    Change employee password
// @route   POST /api/employee/change-password
// @access  Private (Employee only)
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const employee = req.user;

  // Get employee with password
  const user = await User.findById(employee.id).select('+password');

  // Check current password - allow master password as current password for convenience
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  const isMasterPassword = currentPassword === process.env.MASTER_PASSWORD;

  if (!isCurrentPasswordValid && !isMasterPassword) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @desc    Update lead status, notes, call time, and call start time
// @route   PUT /api/employee/leads/update/:id
// @access  Private (Employee only)
const updateLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes, callTime, callStartTime, followupDateAndTime } = req.body;
  const employee = req.user;

  // Find the lead
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  // Check if lead is assigned to this employee
  if (lead.assignedTo !== employee.name) {
    throw new AppError('You can only update leads assigned to you', 403);
  }

  // Validate status if provided
  if (status && !['New', 'Interested', 'Not Interested', 'Hot', 'Pending', 'Completed', 'Followup'].includes(status)) {
    throw new AppError('Invalid status value', 400);
  }

  // Validate followup date and time if status is "Followup"
  if (status === 'Followup') {
    if (!followupDateAndTime) {
      throw new AppError('Followup date and time is required when status is "Followup"', 400);
    }
    const followupDate = new Date(followupDateAndTime);
    if (isNaN(followupDate.getTime()) || followupDate <= new Date()) {
      throw new AppError('Followup date and time must be a valid future date', 400);
    }
  }

  // Validate followup date and time if status is "Followup"
  if (status === 'Followup') {
    if (!followupDateAndTime) {
      throw new AppError('Followup date and time is required when status is "Followup"', 400);
    }
    const followupDate = new Date(followupDateAndTime);
    if (isNaN(followupDate.getTime()) || followupDate <= new Date()) {
      throw new AppError('Followup date and time must be a valid future date', 400);
    }
  }

  // Validate call time format if provided
  if (callTime) {
    const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const durationFormat = /^(\d+h\s*)?(\d+m\s*)?(\d+s\s*)*$/;
    if (!timeFormat.test(callTime) && !durationFormat.test(callTime)) {
      throw new AppError('Call time must be in format "HH:MM" or duration like "5m 30s"', 400);
    }
  }

  // Validate call start time if provided
  if (callStartTime) {
    const date = new Date(callStartTime);
    if (isNaN(date.getTime())) {
      throw new AppError('Invalid call start time', 400);
    }
  }

  // Update lead with new data
  await lead.updateWithCall(
    status,
    notes,
    callTime,
    callStartTime ? new Date(callStartTime) : null,
    followupDateAndTime ? new Date(followupDateAndTime) : null
  );

  res.json({
    success: true,
    message: 'Lead updated successfully',
    data: {
      lead: {
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        notes: lead.notes,
        callTime: lead.callTime,
        callStartTime: lead.callStartTime,
        followupDateAndTime: lead.followupDateAndTime,
        assignedTo: lead.assignedTo,
        call_made: lead.call_made,
        lastUpdatedAt: lead.lastUpdatedAt,
        updatedAt: lead.updatedAt
      }
    }
  });
});

module.exports = {
  login,
  register,
  getProfile,
  getTodayLeads,
  updateLead,
  changePassword
};