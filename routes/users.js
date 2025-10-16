const express = require('express');
const router = express.Router();

// Import controllers (will be created in next step)
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getUserStats,
  seedAdmin
} = require('../controllers/userController');

// Import middleware
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Admin only routes
router.get('/', requireAdmin, getAllUsers);
router.post('/', requireAdmin, createUser);
router.get('/stats', requireAdmin, getUserStats);
router.post('/seed-admin', requireAdmin, seedAdmin);

// Admin and Employee routes (for viewing/updating own profile)
router.get('/:id', requireAnyRole, getUserById);
router.put('/:id', requireAnyRole, updateUser);
router.delete('/:id', requireAdmin, deleteUser);
router.patch('/:id/toggle-status', requireAdmin, toggleUserStatus);

module.exports = router;