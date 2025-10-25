const Lead = require('../models/Lead');
const User = require('../models/User');

/**
 * Followup Scheduler Utility
 * Handles automatic allocation of followup leads to employees
 */
class FollowupScheduler {
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

      if (dueFollowups.length === 0) {
        return;
      }

      console.log(`Found ${dueFollowups.length} followup leads due for allocation`);

      // Get available employees
      const availableEmployees = await User.find({
        role: 'Employee',
        isActive: true
      }).select('name email');

      if (availableEmployees.length === 0) {
        console.log('No available employees for followup allocation');
        return;
      }

      // Allocate leads to employees using round-robin
      for (let i = 0; i < dueFollowups.length; i++) {
        const lead = dueFollowups[i];
        const employeeIndex = i % availableEmployees.length;
        const assignedEmployee = availableEmployees[employeeIndex];

        try {
          await lead.updateOne({
            assignedTo: assignedEmployee.name,
            assignedDate: new Date(),
            status: 'Followup', // Keep status as Followup
            lastUpdatedAt: new Date()
          });

          console.log(`Allocated followup lead ${lead._id} (${lead.name}) to ${assignedEmployee.name}`);

          // Log the allocation
          console.log(`Followup lead allocated: ${lead.name} (${lead.phone}) -> ${assignedEmployee.name} at ${new Date().toISOString()}`);

        } catch (error) {
          console.error(`Error allocating followup lead ${lead._id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error in followup allocation check:', error);
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
   * Get followup allocation statistics
   */
  async getAllocationStats() {
    try {
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

      const stats = await Lead.aggregate([
        {
          $match: {
            status: 'Followup'
          }
        },
        {
          $group: {
            _id: {
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
        assigned: 0,
        unassigned: 0,
        due: 0,
        pending: 0
      };

      stats.forEach(stat => {
        if (stat._id.assigned) {
          result.assigned += stat.count;
        } else {
          result.unassigned += stat.count;
        }

        if (stat._id.due === 'due') {
          result.due += stat.count;
        } else {
          result.pending += stat.count;
        }
      });

      return result;

    } catch (error) {
      console.error('Error getting followup allocation stats:', error);
      return null;
    }
  }
}

module.exports = new FollowupScheduler();