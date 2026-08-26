import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixSpecificUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'sreeraj.manepalli@ielektron.com';
    const name = 'Sreeraj Manepalli';

    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: email },
      { $set: { name: name } }
    );

    if (result.matchedCount > 0) {
      console.log(`✅ Successfully updated user: ${email}`);
      console.log(`   Name set to: ${name}`);
    } else {
      console.log(`❌ User not found: ${email}`);
    }

    // Verify the update
    const user = await mongoose.connection.db.collection('users').findOne({ email: email });
    console.log('\nUpdated user data:', {
      email: user.email,
      name: user.name,
      hasName: !!user.name
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSpecificUser();
