const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// ========================
// REGISTER  
// ========================
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        // Create new user (password will be hashed by pre-save hook)
        const newUser = new User({
            name,
            email,
            password, // Will be hashed by pre-save hook
            role // 'admin', 'manager', or 'employee'
        });

        await newUser.save();

        res.json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================
// LOGIN
// ========================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'User not found' });

        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, role: user.role });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================
// GET CURRENT USER
// ========================
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error('Get current user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
