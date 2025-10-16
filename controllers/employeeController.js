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

  // Check if employee exists
  const employee = await User.findOne({ email, role: 'Employee' }).select('+password');
  if (!employee) {
    throw new AppError('Invalid credentials - Employee not found', 401);
  }

  // Check if password matches
  const isPasswordValid = await employee.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials - Incorrect password', 401);
  }

  // Check if employee is active
  if (!employee.isActive) {
    throw new AppError('Account is deactivated. Please contact administrator.', 401);
  }

  // Generate token
  const token = generateToken(employee._id);

  // Get lead statistics for the employee
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayLeadsCount = await Lead.countDocuments({
    assignedTo: employee.name,
    assignedDate: { $gte: today, $lt: tomorrow }
  });

  const totalLeadsCount = await Lead.countDocuments({
    assignedTo: employee.name
  });

  const statusCounts = await Lead.aggregate([
    { $match: { assignedTo: employee.name } },
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
  const totalLeadsCount = await Lead.countDocuments({
    assignedTo: employee.name
  });

  const statusCounts = await Lead.aggregate([
    { $match: { assignedTo: employee.name } },
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

  // Get current date boundaries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find leads assigned to this employee for today
  const leads = await Lead.find({
    assignedTo: employee.name,
    assignedDate: { $gte: today, $lt: tomorrow }
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

// @desc    Update lead status, notes, and call time
// @route   PUT /api/employee/leads/update/:id
// @access  Private (Employee only)
const updateLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes, callTime } = req.body;
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
  if (status && !['New', 'Interested', 'Not Interested', 'Hot', 'Pending', 'Completed'].includes(status)) {
    throw new AppError('Invalid status value', 400);
  }

  // Validate call time format if provided
  if (callTime) {
    const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const durationFormat = /^(\d+h\s*)?(\d+m\s*)?(\d+s\s*)*$/;
    if (!timeFormat.test(callTime) && !durationFormat.test(callTime)) {
      throw new AppError('Call time must be in format "HH:MM" or duration like "5m 30s"', 400);
    }
  }

  // Update lead with new data
  await lead.updateWithCall(status, notes, callTime);

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
        assignedTo: lead.assignedTo,
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
  updateLead
};