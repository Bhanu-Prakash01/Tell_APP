/**
 * Call Time Utilities
 * Helper functions for call time formatting, validation, and calculations
 */

// Validate call time format
const validateCallTime = (callTime) => {
  if (!callTime) return true; // Optional field

  const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const durationFormat = /^(\d+h\s*)?(\d+m\s*)?(\d+s\s*)*$/;

  return timeFormat.test(callTime) || durationFormat.test(callTime);
};

// Convert duration format to seconds
const durationToSeconds = (duration) => {
  if (!duration) return 0;

  const hours = duration.match(/(\d+)h/);
  const minutes = duration.match(/(\d+)m/);
  const seconds = duration.match(/(\d+)s/);

  let totalSeconds = 0;

  if (hours) totalSeconds += parseInt(hours[1]) * 3600;
  if (minutes) totalSeconds += parseInt(minutes[1]) * 60;
  if (seconds) totalSeconds += parseInt(seconds[1]);

  return totalSeconds;
};

// Convert seconds to duration format
const secondsToDuration = (seconds) => {
  if (seconds === 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let duration = '';
  if (hours > 0) duration += `${hours}h `;
  if (minutes > 0) duration += `${minutes}m `;
  if (secs > 0 || duration === '') duration += `${secs}s`;

  return duration.trim();
};

// Format call time for display
const formatCallTime = (callTime) => {
  if (!callTime) return 'Not recorded';

  // If it's already in time format (HH:MM), return as is
  if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(callTime)) {
    return callTime;
  }

  // If it's in duration format, convert to readable format
  const seconds = durationToSeconds(callTime);
  return secondsToDuration(seconds);
};

// Calculate total call time for multiple leads
const calculateTotalCallTime = (leads) => {
  let totalSeconds = 0;

  leads.forEach(lead => {
    if (lead.callTime) {
      totalSeconds += durationToSeconds(lead.callTime);
    }
  });

  return {
    totalSeconds,
    formatted: secondsToDuration(totalSeconds),
    averageSeconds: leads.length > 0 ? Math.round(totalSeconds / leads.length) : 0,
    averageFormatted: leads.length > 0 ? secondsToDuration(Math.round(totalSeconds / leads.length)) : '0s'
  };
};

// Get call time statistics for dashboard
const getCallTimeStats = async (Lead) => {
  try {
    // Get leads with call time data
    const leadsWithCallTime = await Lead.find({
      callTime: { $exists: true, $ne: null, $ne: '' },
      assignedTo: { $ne: 'Unassigned' }
    }, 'assignedTo callTime status').lean();

    // Process call time data in JavaScript
    const statsMap = {};

    leadsWithCallTime.forEach(lead => {
      const employee = lead.assignedTo;
      if (!statsMap[employee]) {
        statsMap[employee] = {
          totalLeads: 0,
          totalCallTimeSeconds: 0,
          completedLeads: 0
        };
      }

      statsMap[employee].totalLeads++;
      statsMap[employee].totalCallTimeSeconds += durationToSeconds(lead.callTime);

      if (lead.status === 'Completed') {
        statsMap[employee].completedLeads++;
      }
    });

    // Convert to array format
    const stats = Object.entries(statsMap).map(([employee, data]) => ({
      _id: employee,
      totalLeads: data.totalLeads,
      totalCallTimeSeconds: data.totalCallTimeSeconds,
      completedLeads: data.completedLeads
    }));

    // Sort by total leads
    stats.sort((a, b) => b.totalLeads - a.totalLeads);

    return stats.map(stat => ({
      employee: stat._id,
      totalLeads: stat.totalLeads,
      completedLeads: stat.completedLeads,
      totalCallTime: secondsToDuration(stat.totalCallTimeSeconds),
      averageCallTime: stat.totalLeads > 0 ? secondsToDuration(Math.round(stat.totalCallTimeSeconds / stat.totalLeads)) : '0s'
    }));
  } catch (error) {
    console.error('Error calculating call time stats:', error);
    return [];
  }
};

module.exports = {
  validateCallTime,
  durationToSeconds,
  secondsToDuration,
  formatCallTime,
  calculateTotalCallTime,
  getCallTimeStats
};