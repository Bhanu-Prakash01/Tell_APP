const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function debugAuth() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/telecrm', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Find the user
        const user = await User.findOne({ email: 'manager3@test.com' });
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log('👤 User found:', user.name, user.email);
        console.log('🔐 Stored password hash:', user.password);
        console.log('🔐 Password length:', user.password.length);

        // Test password comparison
        const testPassword = 'password123';
        const isMatch = await user.matchPassword(testPassword);
        console.log('🔍 Password match result:', isMatch);

        // Test direct bcrypt comparison
        const directMatch = await bcrypt.compare(testPassword, user.password);
        console.log('🔍 Direct bcrypt match result:', directMatch);

        // Test with a new hash
        const newHash = await bcrypt.hash(testPassword, 10);
        const newMatch = await bcrypt.compare(testPassword, newHash);
        console.log('🔍 New hash match result:', newMatch);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

debugAuth();

