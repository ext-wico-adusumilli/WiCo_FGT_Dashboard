import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function addNameToExistingUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users without a name field
    const usersWithoutName = await User.find({ 
      $or: [
        { name: { $exists: false } },
        { name: null },
        { name: '' }
      ]
    });

    console.log(`Found ${usersWithoutName.length} users without names`);

    // Update each user
    for (const user of usersWithoutName) {
      // Extract name from email (before @)
      const nameFromEmail = user.email.split('@')[0];
      const capitalizedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
      
      user.name = capitalizedName;
      await user.save();
      console.log(`Updated user ${user.email} with name: ${capitalizedName}`);
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

addNameToExistingUsers();
