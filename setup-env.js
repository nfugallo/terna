const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = `# OpenAI API Key
# Get your API key from https://platform.openai.com/api-keys
# Make sure it starts with "sk-" not "org-"
OPENAI_API_KEY=sk-your-api-key-here
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local file');
  console.log('📝 Please update OPENAI_API_KEY with your actual API key');
  console.log('🔑 Get your API key from: https://platform.openai.com/api-keys');
} else {
  console.log('ℹ️  .env.local already exists');
  console.log('📝 Make sure OPENAI_API_KEY is set correctly (should start with "sk-")');
} 