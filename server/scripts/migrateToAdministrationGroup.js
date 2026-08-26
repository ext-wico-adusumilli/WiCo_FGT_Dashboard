import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function migratePrivileges() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to migrate`);

    let migratedCount = 0;

    for (const user of users) {
      let needsUpdate = false;
      const updates = {};

      // Check if user has old userManagement privilege structure
      if (user.privileges && typeof user.privileges.userManagement === 'boolean') {
        needsUpdate = true;
        
        // Create new administration group
        updates['privileges.administration'] = {
          userManagement: user.privileges.userManagement,
          privilegeManagement: false // Default to false for existing users
        };
        
        // Remove old userManagement field
        updates.$unset = { 'privileges.userManagement': '' };
      }

      if (needsUpdate) {
        await User.updateOne({ _id: user._id }, updates);
        migratedCount++;
        console.log(`✅ Migrated user: ${user.email}`);
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`📊 Migrated ${migratedCount} users`);
    console.log(`📊 ${users.length - migratedCount} users already up to date`);

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

migratePrivileges();
