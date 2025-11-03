const Lead = require('../models/Lead');
const User = require('../models/User');

/**
 * Lead Scheduler Utility
 * Handles automatic allocation of followup leads and new leads to employees
 */
class LeadScheduler {
  constructor() {
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.isRunning = false;
  }

  /**
   * Start the followup scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('Followup scheduler is already running');
      return;
    }

    console.log('Starting followup scheduler...');
    this.isRunning = true;

    // Check immediately
    this.checkAndAllocateFollowups();

    // Set up interval checking
    this.intervalId = setInterval(() => {
      this.checkAndAllocateFollowups();
    }, this.checkInterval);
  }

  /**
   * Stop the followup scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Followup scheduler stopped');
  }

  /**
   * Check for followup leads that need to be allocated
   */
  async checkAndAllocateFollowups() {
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      // Find followup leads that are due for allocation (within next 5 minutes)
      const dueFollowups = await Lead.find({
        status: 'Followup',
        followupDateAndTime: {
          $gte: now,
          $lte: fiveMinutesFromNow
        },
        assignedTo: 'Unassigned'
      });

      // Also find new leads that are unassigned and need automatic assignment
      const newLeads = await Lead.find({
        status: 'New',
        assignedTo: 'Unassigned',
        createdAt: { $lt: now } // Only leads created before now
      });

      const allLeadsToAllocate = [...dueFollowups, ...newLeads];

      if (allLeadsToAllocate.length === 0) {
        return;
      }

      console.log(`Found ${dueFollowups.length} followup leads and ${newLeads.length} new leads due for allocation`);

      // Get available employees
      const availableEmployees = await User.find({
        role: 'Employee',
        isActive: true
      }).select('name email');

      if (availableEmployees.length === 0) {
        console.log('No available employees for lead allocation');
        return;
      }

      // Allocate leads to employees using round-robin
      for (let i = 0; i < allLeadsToAllocate.length; i++) {
        const lead = allLeadsToAllocate[i];
        const employeeIndex = i % availableEmployees.length;
        const assignedEmployee = availableEmployees[employeeIndex];

        try {
          await lead.updateOne({
            assignedTo: assignedEmployee.name,
            assignedDate: new Date(),
            lastUpdatedAt: new Date()
            // Keep original status (Followup or New)
          });

          console.log(`Allocated ${lead.status} lead ${lead._id} (${lead.name}) to ${assignedEmployee.name}`);

          // Log the allocation
          console.log(`${lead.status} lead allocated: ${lead.name} (${lead.phone}) -> ${assignedEmployee.name} at ${new Date().toISOString()}`);

        } catch (error) {
          console.error(`Error allocating lead ${lead._id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error in lead allocation check:', error);
    }
  }

  /**
   * Manually trigger followup allocation check
   */
  async triggerAllocation() {
    console.log('Manually triggering followup allocation...');
    await this.checkAndAllocateFollowups();
  }

  /**
   * Get lead allocation statistics
   */
  async getAllocationStats() {
    try {
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

      const stats = await Lead.aggregate([
        {
          $match: {
            $or: [
              { status: 'Followup' },
              { status: 'New', assignedTo: 'Unassigned' }
            ]
          }
        },
        {
          $group: {
            _id: {
              status: '$status',
              assigned: { $ne: ['$assignedTo', 'Unassigned'] },
              due: {
                $cond: [
                  { $and: ['$followupDateAndTime', { $lte: ['$followupDateAndTime', nextHour] }] },
                  'due',
                  'pending'
                ]
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        followup: {
          assigned: 0,
          unassigned: 0,
          due: 0,
          pending: 0
        },
        new: {
          assigned: 0,
          unassigned: 0
        },
        total: {
          assigned: 0,
          unassigned: 0
        }
      };

      stats.forEach(stat => {
        const status = stat._id.status;
        const assigned = stat._id.assigned;
        const due = stat._id.due;

        if (status === 'Followup') {
          if (assigned) {
            result.followup.assigned += stat.count;
          } else {
            result.followup.unassigned += stat.count;
          }

          if (due === 'due') {
            result.followup.due += stat.count;
          } else {
            result.followup.pending += stat.count;
          }
        } else if (status === 'New') {
          if (assigned) {
            result.new.assigned += stat.count;
          } else {
            result.new.unassigned += stat.count;
          }
        }

        // Update totals
        if (assigned) {
          result.total.assigned += stat.count;
        } else {
          result.total.unassigned += stat.count;
        }
      });

      return result;

    } catch (error) {
      console.error('Error getting lead allocation stats:', error);
      return null;
    }
  }
}

module.exports = new LeadScheduler();