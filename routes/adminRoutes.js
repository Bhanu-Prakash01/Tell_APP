const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');

// Assign employee to manager
router.post('/assign-employee', AdminController.assignEmployee);

module.exports = router;
