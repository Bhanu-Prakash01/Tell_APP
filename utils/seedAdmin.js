require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { logger } = require('./logger');

const seedAdmin = async () => {
  try {
    // Admin user details
    const adminData = {
      name: 'System Administrator',
      email: 'admin@outreachq.com',
      password: 'admin123',
      role: 'Admin'
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      logger.info('Admin seeding skipped - user already exists', {
        email: adminData.email,
        existingUserId: existingAdmin._id
      });
      return existingAdmin;
    }

    // Hash password before creating user
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);

    // Create admin user
    const adminUser = await User.create({
      ...adminData,
      password: hashedPassword
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminUser.email);
    console.log('👤 Name:', adminUser.name);
    console.log('🔐 Role:', adminUser.role);
    console.log('🆔 User ID:', adminUser._id);

    logger.info('Admin user seeded successfully', {
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      userId: adminUser._id
    });

    return adminUser;

  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
    logger.error('Admin seeding failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Function to connect to database
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/telcalling_db';
    const conn = await mongoose.connect(mongoUri);

    console.log(`📊 MongoDB Connected: ${conn.connection.host}`);
    console.log(`🗄️ Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    throw error;
  }
};

// Main execution function
const runSeeding = async () => {
  try {
    // Check if we're in development environment
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      console.log('⚠️ Warning: Seeding should only be run in development environment');
      console.log('Current environment:', process.env.NODE_ENV || 'development');
    }

    // Connect to database
    await connectDB();

    // Seed admin user
    await seedAdmin();

    console.log('🎉 Admin seeding completed successfully!');

  } catch (error) {
    console.error('💥 Seeding failed:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Export functions for use in other modules
module.exports = {
  seedAdmin,
  connectDB,
  runSeeding
};

// Run seeding if this file is executed directly
if (require.main === module) {
  runSeeding();
}