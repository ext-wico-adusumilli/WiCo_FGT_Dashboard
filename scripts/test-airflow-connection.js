#!/usr/bin/env node

/**
 * Quick Airflow Connection Test
 * Tests if Airflow is running and accessible
 */

import fetch from 'node-fetch';

const AIRFLOW_URL = 'http://localhost:8080/api/v1';
const AUTH = Buffer.from('airflow:airflow').toString('base64');

async function testAirflowConnection() {
  console.log('🧪 Testing Airflow Connection...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Airflow Health...');
    const healthResponse = await fetch(`${AIRFLOW_URL}/health`, {
      headers: {
        'Authorization': `Basic ${AUTH}`
      },
      timeout: 5000
    });

    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Airflow is healthy');
      console.log(`   Version: ${health.version || 'Unknown'}`);
    } else {
      console.log(`❌ Health check failed: ${healthResponse.status}`);
      return;
    }

    // Test 2: List DAGs
    console.log('\n2. Testing DAG API...');
    const dagsResponse = await fetch(`${AIRFLOW_URL}/dags`, {
      headers: {
        'Authorization': `Basic ${AUTH}`
      },
      timeout: 5000
    });

    if (dagsResponse.ok) {
      const dags = await dagsResponse.json();
      console.log(`✅ Found ${dags.dags?.length || 0} DAGs`);
      
      if (dags.dags?.length > 0) {
        console.log('   Available DAGs:');
        dags.dags.forEach(dag => {
          console.log(`   - ${dag.dag_id} (${dag.is_paused ? 'Paused' : 'Active'})`);
        });
      }
    } else {
      console.log(`❌ DAG API failed: ${dagsResponse.status}`);
    }

    // Test 3: Test Backend Integration
    console.log('\n3. Testing Backend Integration...');
    const backendResponse = await fetch('http://localhost:3000/api/airflow/status', {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (backendResponse.ok) {
      const status = await backendResponse.json();
      console.log('✅ Backend integration working');
      console.log(`   Connection Status: ${status.data?.isConnected ? 'Connected' : 'Disconnected'}`);
    } else {
      console.log(`❌ Backend integration failed: ${backendResponse.status}`);
    }

    console.log('\n🎉 All tests completed!');
    console.log('\nNext steps:');
    console.log('1. Open http://localhost:8080 for Airflow UI');
    console.log('2. Open http://localhost:5173/analysis-manager for the Analysis Manager');

  } catch (error) {
    console.log(`❌ Connection test failed: ${error.message}`);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure Airflow webserver is running in WSL');
    console.log('2. Make sure Airflow scheduler is running in WSL');
    console.log('3. Check if port 8080 is accessible from Windows');
    console.log('4. Verify WSL networking is working');
  }
}

testAirflowConnection();