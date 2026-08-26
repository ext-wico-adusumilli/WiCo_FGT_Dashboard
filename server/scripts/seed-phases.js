/**
 * Seed Phases Script
 * Populates the database with sample phases for testing
 */

import '../loadEnv.js';
import mongoose from 'mongoose';
import Phase from '../models/Phase.js';

const samplePhases = [
  {
    id: 'phase_2024_q1',
    name: 'Q1 2024 Flight Data',
    description: 'Flight data collected during Q1 2024 operations',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    dataPath: '/blob/2024/q1',
    fileCount: 450,
    sizeBytes: 1024 * 1024 * 750, // 750 MB
    tags: ['2024', 'Q1', 'production'],
    isActive: true
  },
  {
    id: 'phase_2024_q2',
    name: 'Q2 2024 Flight Data',
    description: 'Flight data collected during Q2 2024 operations',
    startDate: '2024-04-01',
    endDate: '2024-06-30',
    dataPath: '/blob/2024/q2',
    fileCount: 520,
    sizeBytes: 1024 * 1024 * 890, // 890 MB
    tags: ['2024', 'Q2', 'production'],
    isActive: true
  },
  {
    id: 'phase_2024_q3',
    name: 'Q3 2024 Flight Data',
    description: 'Flight data collected during Q3 2024 operations',
    startDate: '2024-07-01',
    endDate: '2024-09-30',
    dataPath: '/blob/2024/q3',
    fileCount: 610,
    sizeBytes: 1024 * 1024 * 1020, // 1020 MB
    tags: ['2024', 'Q3', 'production'],
    isActive: true
  },
  {
    id: 'phase_2024_q4',
    name: 'Q4 2024 Flight Data',
    description: 'Flight data collected during Q4 2024 operations',
    startDate: '2024-10-01',
    endDate: '2024-12-31',
    dataPath: '/blob/2024/q4',
    fileCount: 580,
    sizeBytes: 1024 * 1024 * 950, // 950 MB
    tags: ['2024', 'Q4', 'production'],
    isActive: true
  },
  {
    id: 'phase_test_2024',
    name: 'Test Flight Data 2024',
    description: 'Test and validation flights conducted in 2024',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    dataPath: '/blob/2024/test',
    fileCount: 125,
    sizeBytes: 1024 * 1024 * 200, // 200 MB
    tags: ['2024', 'test', 'validation'],
    isActive: true
  },
  {
    id: 'phase_2025_q1',
    name: 'Q1 2025 Flight Data',
    description: 'Flight data collected during Q1 2025 operations',
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    dataPath: '/blob/2025/q1',
    fileCount: 380,
    sizeBytes: 1024 * 1024 * 650, // 650 MB
    tags: ['2025', 'Q1', 'production'],
    isActive: true
  }
];

async function seedPhases() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing phases
    const deleteResult = await Phase.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing phases`);

    // Insert sample phases
    const insertedPhases = await Phase.insertMany(samplePhases);
    console.log(`✅ Inserted ${insertedPhases.length} sample phases`);

    // Display summary
    console.log('\n📊 Phase Summary:');
    insertedPhases.forEach(phase => {
      console.log(`  - ${phase.name} (${phase.id})`);
      console.log(`    Date Range: ${phase.startDate} to ${phase.endDate}`);
      console.log(`    Files: ${phase.fileCount}, Size: ${(phase.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`    Tags: ${phase.tags.join(', ')}`);
      console.log('');
    });

    console.log('✅ Phase seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding phases:', error);
    process.exit(1);
  }
}

// Run the seed function
seedPhases();
