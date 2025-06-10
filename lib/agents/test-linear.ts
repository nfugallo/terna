import { LinearAPI } from './linear-client';

async function testLinearIntegration() {
  console.log('🔍 Testing Linear integration...');
  
  try {
    // Test 1: Get current user
    console.log('\n1. Testing getCurrentUser...');
    const user = await LinearAPI.getCurrentUser();
    console.log('✅ Current user:', user);

    // Test 2: Get teams
    console.log('\n2. Testing getTeams...');
    const teams = await LinearAPI.getTeams();
    console.log('✅ Teams found:', teams.length);
    teams.forEach(team => console.log(`  - ${team.name} (${team.key}) - ID: ${team.id}`));

    // Test 3: Search for projects
    console.log('\n3. Testing searchProjects...');
    const projects = await LinearAPI.searchProjects('');
    console.log('✅ Projects found:', projects.length);
    projects.slice(0, 3).forEach(project => console.log(`  - ${project.name} - ${project.url}`));

    // Test 4: Get Engineering team
    console.log('\n4. Testing getTeam for Engineering...');
    const engineeringTeam = await LinearAPI.getTeam('Engineering');
    console.log('✅ Engineering team:', engineeringTeam);

    if (engineeringTeam) {
      // Test 5: Get workflow states
      console.log('\n5. Testing getWorkflowStates...');
      const states = await LinearAPI.getWorkflowStates(engineeringTeam.id);
      console.log('✅ Workflow states:', states.length);
      states.slice(0, 5).forEach(state => console.log(`  - ${state.name} (${state.type})`));

      // Test 6: Get team labels
      console.log('\n6. Testing getTeamLabels...');
      const labels = await LinearAPI.getTeamLabels(engineeringTeam.id);
      console.log('✅ Team labels:', labels.length);
      labels.slice(0, 5).forEach(label => console.log(`  - ${label.name} (${label.color})`));
    }

    console.log('\n🎉 All Linear integration tests passed!');
    
  } catch (error) {
    console.error('❌ Linear integration test failed:', error);
    throw error;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testLinearIntegration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { testLinearIntegration }; 