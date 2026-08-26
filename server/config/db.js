import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    // Cosmos DB compatible connection options
    const options = {
      retryWrites: false, // Cosmos DB doesn't support retryWrites in some configurations
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    console.log(`Database Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    process.exit(1);
  }
};
