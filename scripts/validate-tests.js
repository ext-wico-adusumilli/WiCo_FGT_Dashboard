#!/usr/bin/env node

/**
 * Test Validation Script
 * Validates that all test files are properly structured
 */

import { promises as fs } from 'fs';
import path from 'path';

const testFiles = [
  'client/src/services/__tests__/airflowService.test.ts',
  'client/src/components/analysis-manager/__tests__/DAGGrid.test.tsx',
  'server/services/__tests__/airflowService.test.js',
  'server/controllers/__tests__/airflowController.test.js',
  'server/test/integration/airflow-integration.test.js'
];

async function validateTestFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Check for basic test structure
    const hasDescribe = content.includes('describe(');
    const hasIt = content.includes('it(') || content.includes('test(');
    const hasExpect = content.includes('expect(');
    
    if (!hasDescribe || !hasIt || !hasExpected) {
      throw new Error('Missing basic test structure (describe/it/expect)');
    }
    
    console.log(`✅ ${filePath} - Valid test structure`);
    return true;
  } catch (error) {
    console.log(`❌ ${filePath} - ${error.message}`);
    return false;
  }
}

async function validateAllTests() {
  console.log('🧪 Validating test file structure...\n');
  
  let validCount = 0;
  let totalCount = testFiles.length;
  
  for (const testFile of testFiles) {
    const isValid = await validateTestFile(testFile);
    if (isValid) validCount++;
  }
  
  console.log(`\n📊 Validation Results: ${validCount}/${totalCount} test files valid`);
  
  if (validCount === totalCount) {
    console.log('🎉 All test files have valid structure!');
    return true;
  } else {
    console.log('⚠️  Some test files need attention.');
    return false;
  }
}

// Run validation
validateAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});