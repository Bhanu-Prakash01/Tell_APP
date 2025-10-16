require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function fixPassword() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Hash the correct password
    const plainPassword = 'admin123';
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    console.log('Generated new hash for admin123:', hashedPassword.substring(0, 20) + '...');

    // Update the admin user with the correct hash and activate the account
    const result = await User.updateOne(
      { email: 'admin@outreachq.com' },
      {
        $set: {
          password: hashedPassword,
          isActive: true
        }
      }
    );

    console.log('Update result:', result);

    if (result.modifiedCount > 0) {
      console.log('✅ Admin password updated successfully!');

      // Verify the fix
      const user = await User.findOne({ email: 'admin@outreachq.com' }).select('+password');
      const isValid = await bcrypt.compare(plainPassword, user.password);
      console.log('Password verification after fix:', isValid);
    } else {
      console.log('❌ No user was updated');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixPassword();