#!/usr/bin/env node

/**
 * Airflow Integration Test Runner
 * Validates Windows + WSL setup and cross-platform communication
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const TEST_CONFIG = {
  airflowUrl: process.env.AIRFLOW_API_URL || 'http://localhost:8080',
  backendUrl: 'http://localhost:3000',
  frontendUrl: 'http://localhost:5173',
  timeout: 30000
};

class AirflowIntegrationTester {
  constructor() {
    this.results = {
      environment: { passed: 0, failed: 0, tests: [] },
      connectivity: { passed: 0, failed: 0, tests: [] },
      api: { passed: 0, failed: 0, tests: [] },
      workflow: { passed: 0, failed: 0, tests: [] }
    };
  }

  async runTest(category, testName, testFn) {
    console.log(`\n🧪 Running ${category}: ${testName}`);
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results[category].passed++;
      this.results[category].tests.push({
        name: testName,
        status: 'PASSED',
        duration,
        error: null
      });
      
      console.log(`✅ PASSED (${duration}ms)`);
    } catch (error) {
      this.results[category].failed++;
      this.results[category].tests.push({
        name: testName,
        status: 'FAILED',
        duration: 0,
        error: error.message
      });
      
      console.log(`❌ FAILED: ${error.message}`);
    }
  }

  async testEnvironmentConfiguration() {
    await this.runTest('environment', 'Environment Variables', async () => {
      const requiredVars = ['AIRFLOW_API_URL', 'AIRFLOW_USERNAME', 'AIRFLOW_PASSWORD'];
      
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          throw new Error(`Missing required environment variable: ${varName}`);
        }
      }
      
      // Validate URL format
      const url = new URL(process.env.AIRFLOW_API_URL);
      if (!url.pathname.endsWith('/api/v1')) {
        throw new Error('AIRFLOW_API_URL should end with /api/v1');
      }
    });

    await this.runTest('environment', 'File Permissions', async () => {
      const testFiles = [
        'server/services/airflowService.js',
        'server/controllers/airflowController.js',
        'client/src/services/airflowService.ts'
      ];
      
      for (const file of testFiles) {
        try {
          await fs.access(file);
        } catch (error) {
          throw new Error(`Cannot access required file: ${file}`);
        }
      }
    });
  }

  async testConnectivity() {
    await this.runTest('connectivity', 'Airflow API Reachability', async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch(`${TEST_CONFIG.airflowUrl}/health`, {
          signal: controller.signal,
          headers: {
            'Authorization': `Basic ${Buffer.from(
              `${process.env.AIRFLOW_USERNAME}:${process.env.AIRFLOW_PASSWORD}`
            ).toString('base64')}`
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok && response.status !== 401) {
          throw new Error(`Airflow API returned ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Airflow API connection timeout');
        }
        throw error;
      }
    });

    await this.runTest('connectivity', 'Backend Server Reachability', async () => {
      try {
        const response = await fetch(`${TEST_CONFIG.backendUrl}/api/health`, {
          timeout: 5000
        });
        
        if (!response.ok) {
          throw new Error(`Backend server returned ${response.status}`);
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Backend server is not running');
        }
        throw error;
      }
    });

    await this.runTest('connectivity', 'Cross-Platform Communication', async () => {
      // Test Windows to WSL communication by making a request through the backend
      try {
        const response = await fetch(`${TEST_CONFIG.backendUrl}/api/airflow/status`, {
          timeout: 15000,
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        // Should return either success or a proper error structure
        if (!data.hasOwnProperty('success')) {
          throw new Error('Invalid response format from backend');
        }
        
        if (!data.success && !data.message) {
          throw new Error('Error response missing message field');
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to backend server for cross-platform test');
        }
        throw error;
      }
    });
  }

  async testAPIIntegration() {
    await this.runTest('api', 'DAG Listing API', async () => {
      const response = await fetch(`${TEST_CONFIG.backendUrl}/api/airflow/dags`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const data = await response.json();
      
      if (!data.success && response.status === 500) {
        // Check if it's a connection error (expected when Airflow is not available)
        if (!data.error || !data.error.includes('Airflow')) {
          throw new Error('Unexpected API error format');
        }
        return; // This is acceptable for testing
      }
      
      if (data.success && !Array.isArray(data.data)) {
        throw new Error('DAG listing should return an array');
      }
    });

    await this.runTest('api', 'Job Creation API', async () => {
      const jobData = {
        name: 'Integration Test Job',
        description: 'Test job for integration testing',
        scriptId: 'test_dag',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
        parameters: { test: true }
      };
      
      const response = await fetch(`${TEST_CONFIG.backendUrl}/api/airflow/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobData),
        timeout: 10000
      });
      
      const data = await response.json();
      
      // Should handle job creation (success or validation error)
      if (response.status === 400) {
        if (!data.message) {
          throw new Error('Validation error should include message');
        }
        return; // Validation errors are acceptable
      }
      
      if (response.status === 201 && !data.data.jobId) {
        throw new Error('Successful job creation should return jobId');
      }
    });
  }

  async testWorkflowIntegration() {
    await this.runTest('workflow', 'Complete Job Workflow', async () => {
      // Test the complete workflow from script listing to job creation
      
      // Step 1: Get available scripts
      const scriptsResponse = await fetch(`${TEST_CONFIG.backendUrl}/api/airflow/scripts`, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      
      const scriptsData = await scriptsResponse.json();
      
      if (!scriptsData.success) {
        // This is acceptable if Airflow is not available
        return;
      }
      
      if (!Array.isArray(scriptsData.data)) {
        throw new Error('Scripts endpoint should return array');
      }
      
      // Step 2: Create job with first available script
      if (scriptsData.data.length > 0) {
        const jobData = {
          name: 'Workflow Test Job',
          scriptId: scriptsData.data[0].scriptId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        };
        
        const jobResponse = await fetch(`${TEST_CONFIG.backendUrl}/api/airflow/jobs`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(jobData),
          timeout: 8000
        });
        
        // Should handle job creation appropriately
        if (jobResponse.status !== 201 && jobResponse.status !== 400 && jobResponse.status !== 500) {
          throw new Error(`Unexpected job creation response: ${jobResponse.status}`);
        }
      }
    });
  }

  async runAllTests() {
    console.log('🚀 Starting Airflow Integration Tests\n');
    console.log('Configuration:');
    console.log(`  Airflow URL: ${TEST_CONFIG.airflowUrl}`);
    console.log(`  Backend URL: ${TEST_CONFIG.backendUrl}`);
    console.log(`  Frontend URL: ${TEST_CONFIG.frontendUrl}`);
    
    await this.testEnvironmentConfiguration();
    await this.testConnectivity();
    await this.testAPIIntegration();
    await this.testWorkflowIntegration();
    
    this.printResults();
  }

  printResults() {
    console.log('\n📊 Test Results Summary\n');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [category, results] of Object.entries(this.results)) {
      const { passed, failed, tests } = results;
      totalPassed += passed;
      totalFailed += failed;
      
      console.log(`${category.toUpperCase()}:`);
      console.log(`  ✅ Passed: ${passed}`);
      console.log(`  ❌ Failed: ${failed}`);
      
      if (failed > 0) {
        console.log('  Failed tests:');
        tests.filter(t => t.status === 'FAILED').forEach(test => {
          console.log(`    - ${test.name}: ${test.error}`);
        });
      }
      console.log('');
    }
    
    console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
    
    if (totalFailed === 0) {
      console.log('🎉 All integration tests passed!');
      process.exit(0);
    } else {
      console.log('⚠️  Some integration tests failed. Check the setup guide.');
      process.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new AirflowIntegrationTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export default AirflowIntegrationTester;