// Load environment variables from .env.local
import { config } from 'dotenv';
import path from 'path';

// Load .env.local from project root
config({ path: path.join(process.cwd(), '.env.local') });

import { run } from '@openai/agents';
import { createLinearProjectPlannerAgent, createLinearIssuePlannerAgent } from './agents';
import { LinearAPI } from './linear-client';

async function testLinearAgents() {
  console.log('🔍 Testing Linear agents integration...');
  
  try {
    // Test 1: Verify Linear API connection
    console.log('\n1. Testing Linear API connection...');
    const user = await LinearAPI.getCurrentUser();
    console.log('✅ Linear API connected. Current user:', user);

    // Test 2: Create Linear Project Planner agent
    console.log('\n2. Creating Linear Project Planner agent...');
    const projectAgent = await createLinearProjectPlannerAgent();
    console.log('✅ Project Planner agent created:', projectAgent.name);
    console.log('   Available tools:', projectAgent.tools.map(t => t.name).join(', '));

    // Test 3: Create Linear Issue Planner agent
    console.log('\n3. Creating Linear Issue Planner agent...');
    const issueAgent = await createLinearIssuePlannerAgent();
    console.log('✅ Issue Planner agent created:', issueAgent.name);
    console.log('   Available tools:', issueAgent.tools.map(t => t.name).join(', '));

    // Test 4: Test project search with agent
    console.log('\n4. Testing project search with agent...');
    const searchResult = await run(projectAgent, 'Search for existing projects in Linear', {
      stream: false,
    });
    console.log('✅ Search completed');
    console.log('   Result:', searchResult.finalOutput);

    // Test 5: Test team listing with agent
    console.log('\n5. Testing team listing with agent...');
    const teamsResult = await run(projectAgent, 'List all teams in Linear', {
      stream: false,
    });
    console.log('✅ Teams listed');
    console.log('   Result:', teamsResult.finalOutput);

    console.log('\n🎉 All Linear agent tests passed!');
    
  } catch (error) {
    console.error('❌ Linear agent test failed:', error);
    throw error;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testLinearAgents()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { testLinearAgents }; 