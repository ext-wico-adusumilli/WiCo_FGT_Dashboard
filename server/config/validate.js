// Configuration validator for deployment
export const validateConfig = () => {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these variables in your .env file or Azure App Settings');
    process.exit(1);
  }

  // Warnings for production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
      console.warn('⚠️  WARNING: Using default JWT_SECRET in production!');
    }

    if (!process.env.ALLOWED_ORIGINS) {
      console.warn('⚠️  WARNING: ALLOWED_ORIGINS not set, CORS may not work correctly');
    }
  }

  console.log('✅ Configuration validated successfully');
};
