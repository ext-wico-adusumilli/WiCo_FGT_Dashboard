#!/usr/bin/env node

/**
 * Debug Airflow DAGs Fetching
 * This script tests the complete flow from client to server to Airflow API
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';

// Load environment variables
config({ path: 'server/.env' });

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${COLORS.reset} ${message}`);
}

function success(message) {
  log(COLORS.green, '✅', message);
}

function error(message) {
  log(COLORS.red, '❌', message);
}

function info(message) {
  log(COLORS.blue, 'ℹ️ ', message);
}

function warning(message) {
  log(COLORS.yellow, '⚠️ ', message);
}

function debug(message) {
  log(COLORS.cyan, '🔍', message);
}

async function testDirectAirflowConnection() {
  info('Testing direct Airflow API connection...');
  
  const airflowConfig = {
    apiUrl: process.env.AIRFLOW_API_URL || 'http://localhost:8080/api/v2',
    username: process.env.AIRFLOW_USERNAME || 'airflow',
    password: process.env.AIRFLOW_PASSWORD || 'airflow',
    timeout: parseInt(process.env.AIRFLOW_API_TIMEOUT) || 30000
  };

  debug(`Airflow API URL: ${airflowConfig.apiUrl}`);
  debug(`Username: ${airflowConfig.username}`);
  debug(`Timeout: ${airflowConfig.timeout}ms`);

  const authHeader = 'Basic ' + Buffer.from(
    `${airflowConfig.username}:${airflowConfig.password}`
  ).toString('base64');

  const testEndpoints = [
    '/monitor/health',
    '/dags',
    '/dags?limit=5'
  ];

  for (const endpoint of testEndpoints) {
    const url = `${airflowConfig.apiUrl}${endpoint}`;
    info(`Testing endpoint: ${endpoint}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        warning(`Request timeout after ${airflowConfig.timeout}ms`);
        controller.abort();
      }, airflowConfig.timeout);

      debug(`Making request to: ${url}`);
      const startTime = Date.now();

      // Try with authentication first
      let response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        signal: controller.signal
      });

      let authMethod = 'with auth';

      // If auth fails, try without
      if (!response.ok && response.status === 401) {
        warning('Authentication failed, trying without auth...');
        
        response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        authMethod = 'without auth';
      }

      clearTimeout(timeoutId);
      const endTime = Date.now();

      if (response.ok) {
        success(`${endpoint} - Status: ${response.status} (${authMethod}) - ${endTime - startTime}ms`);
        
        try {
          const data = await response.json();
          if (endpoint.includes('/dags')) {
            debug(`Response contains ${data.dags?.length || 0} DAGs`);
            if (data.dags?.length > 0) {
              debug(`First DAG: ${data.dags[0].dag_id}`);
            }
          } else if (endpoint.includes('/health')) {
            debug(`Health status: ${JSON.stringify(data, null, 2)}`);
          }
        } catch (jsonError) {
          warning(`Could not parse JSON response: ${jsonError.message}`);
        }
      } else {
        const errorText = await response.text();
        error(`${endpoint} - Status: ${response.status} ${response.statusText}`);
        error(`Error: ${errorText}`);
      }

    } catch (fetchError) {
      error(`${endpoint} - Network error: ${fetchError.message}`);
      if (fetchError.name === 'AbortError') {
        error('Request was aborted due to timeout');
      }
    }
  }
}

async function testBackendAPI() {
  info('Testing backend API endpoints...');
  
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const testEndpoints = [
    '/api/airflow/status',
    '/api/airflow/health',
    '/api/airflow/dags'
  ];

  for (const endpoint of testEndpoints) {
    const url = `${backendUrl}${endpoint}`;
    info(`Testing backend endpoint: ${endpoint}`);
    
    try {
      debug(`Making request to: ${url}`);
      const startTime = Date.now();
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const endTime = Date.now();

      if (response.ok) {
        success(`${endpoint} - Status: ${response.status} - ${endTime - startTime}ms`);
        
        try {
          const data = await response.json();
          if (data.success) {
            success(`Response indicates success: true`);
            if (endpoint.includes('/dags')) {
              debug(`Response contains ${data.data?.length || 0} DAGs`);
            }
          } else {
            warning(`Response indicates failure: ${data.message || 'Unknown error'}`);
          }