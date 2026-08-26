// API configuration
// In production, use empty string for relative URLs (same server)
// In development, use localhost
export const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : 'http://localhost:3000';

