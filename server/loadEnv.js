/**
 * Load environment variables before any other module imports
 * This must be imported first in server.js
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('✅ Environment variables loaded');
console.log('📍 AIRFLOW_API_URL:', process.env.AIRFLOW_API_URL || 'NOT SET');
console.log('📍 AIRFLOW_USERNAME:', process.env.AIRFLOW_USERNAME || 'NOT SET');
console.log('📍 AIRFLOW_PASSWORD:', process.env.AIRFLOW_PASSWORD ? '***' : 'NOT SET');
