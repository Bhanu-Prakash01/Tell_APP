// controllers/userController.js
const User = require('../models/User');

exports.assignEmployee = async (req, res) => {
    try {
        const { employeeId, managerId } = req.body;

        // Find employee
        const employee = await User.findById(employeeId);
        if (!employee || employee.role !== 'employee') {
            return res.status(404).json({ message: "Employee not found" });
        }

        // Check if already assigned
        if (employee.manager) {
            return res.status(400).json({ message: "Employee already assigned to a manager" });
        }

        // Validate manager
        const manager = await User.findById(managerId);
        if (!manager || manager.role !== 'manager') {
            return res.status(404).json({ message: "Manager not found" });
        }

        // Assign employee to manager
        employee.manager = managerId;
        await employee.save();

        res.json({ message: "Employee assigned successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
