import { LinearAPI } from './lib/agents/linear-client';
import { ternaSync } from './lib/agents/terna-sync';

async function testTernaSync() {
  try {
    console.log('Testing Terna sync functionality...\n');

    // 1. Create a test project in Linear
    console.log('1. Creating a test project in Linear...');
    const project = await LinearAPI.createProject({
      name: 'Test Terna Sync Project',
      description: 'This is a test project to demonstrate Terna sync',
      content: '## Overview\n\nThis project tests the synchronization between Linear and the local Terna folder structure.',
      targetDate: '2024-12-31',
      milestones: [
        {
          name: 'Setup Infrastructure',
          definitionOfDone: 'All infrastructure components are deployed and tested',
        },
        {
          name: 'Implement Core Features',
          definitionOfDone: 'Core features are implemented with tests',
        },
      ],
    });
    console.log(`✓ Project created: ${project.name} (${project.id})`);
    console.log(`  URL: ${project.url}`);

    // 2. Check the local Terna folder
    console.log('\n2. Checking local Terna folder...');
    const projectFolderName = ternaSync.getProjectFolderName(project.name);
    const projectExists = await ternaSync.projectExists(project.name);
    console.log(`✓ Project folder created: terna/projects/${projectFolderName}`);
    console.log(`  Exists: ${projectExists}`);

    // 3. Create some issues
    console.log('\n3. Creating issues in Linear...');
    
    // Get team info
    const teams = await LinearAPI.getTeams();
    const team = teams[0]; // Use first team
    
    // Create main issue
    const mainIssue = await LinearAPI.createIssue({
      title: 'Setup Database Schema',
      description: 'Create the necessary database tables and migrations',
      teamId: team.id,
      projectId: project.id,
      priority: 2, // High
      estimate: 5,
    });
    console.log(`✓ Main issue created: ${mainIssue.identifier} - ${mainIssue.title}`);

    // Create sub-issue
    const subIssue = await LinearAPI.createIssue({
      title: 'Create users table',
      description: 'Create the users table with proper indexes',
      teamId: team.id,
      projectId: project.id,
      parentId: mainIssue.id,
      priority: 3, // Normal
      estimate: 2,
    });
    console.log(`✓ Sub-issue created: ${subIssue.identifier} - ${subIssue.title}`);

    // 4. Load projects from Terna folder
    console.log('\n4. Loading projects from Terna folder...');
    const ternaProjects = await ternaSync.loadProjectsFromTerna();
    console.log(`✓ Found ${ternaProjects.length} projects in Terna folder`);
    ternaProjects.forEach(p => {
      console.log(`  - ${p.name} (${p.status})`);
    });

    // 5. Load issues from Terna folder
    console.log('\n5. Loading issues from Terna folder...');
    const ternaIssues = await ternaSync.loadIssuesFromTerna(projectFolderName);
    console.log(`✓ Found ${ternaIssues.length} issues in Terna folder`);
    ternaIssues.forEach(i => {
      console.log(`  - ${i.identifier}: ${i.title} (${i.status})`);
      if (i.parent) {
        console.log(`    Parent: ${i.parent}`);
      }
    });

    console.log('\n✅ Terna sync test completed successfully!');
    console.log('\nFolder structure created:');
    console.log('terna/');
    console.log('└── projects/');
    console.log(`    └── ${projectFolderName}/`);
    console.log('        ├── project.md');
    console.log('        └── issues/');
    console.log(`            └── ${mainIssue.identifier.toLowerCase()}-setup-database-schema/`);
    console.log('                ├── issue.md');
    console.log('                ├── attempts/');
    console.log('                └── sub-issues/');
    console.log(`                    └── ${subIssue.identifier.toLowerCase()}-create-users-table/`);
    console.log('                        └── issue.md');

  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testTernaSync(); 