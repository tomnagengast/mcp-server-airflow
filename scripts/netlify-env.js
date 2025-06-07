#!/usr/bin/env node

import { execSync } from 'child_process';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function exec(command, options = {}) {
  try {
    return execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

async function listEnvironmentVariables() {
  console.log('📋 Current environment variables:');
  try {
    exec('netlify env:list');
  } catch (error) {
    console.log('❌ Failed to list environment variables. Make sure you\'re in a Netlify site directory and authenticated.');
  }
}

async function setEnvironmentVariables() {
  console.log('🔧 Setting up environment variables for MCP Server Airflow\n');
  
  const airflowBaseUrl = await question('Enter your Airflow base URL (e.g., https://your-airflow.com): ');
  
  if (!airflowBaseUrl.trim()) {
    console.log('❌ Airflow base URL is required');
    return;
  }

  console.log('\nChoose authentication method:');
  console.log('1. API Token (recommended)');
  console.log('2. Username/Password');
  
  const authChoice = await question('Enter choice (1 or 2): ');
  
  try {
    // Set the base URL
    console.log('\n🔐 Setting AIRFLOW_BASE_URL...');
    exec(`netlify env:set AIRFLOW_BASE_URL "${airflowBaseUrl}"`);
    
    if (authChoice === '1') {
      const airflowToken = await question('Enter your Airflow API token: ');
      if (!airflowToken.trim()) {
        console.log('❌ Airflow token is required');
        return;
      }
      
      console.log('🔐 Setting AIRFLOW_TOKEN...');
      exec(`netlify env:set AIRFLOW_TOKEN "${airflowToken}"`);
      
      // Remove username/password if they exist
      try {
        exec('netlify env:unset AIRFLOW_USERNAME', { stdio: 'pipe' });
        exec('netlify env:unset AIRFLOW_PASSWORD', { stdio: 'pipe' });
        console.log('🧹 Cleared any existing username/password variables');
      } catch (error) {
        // Variables didn't exist, which is fine
      }
      
    } else if (authChoice === '2') {
      const airflowUsername = await question('Enter your Airflow username: ');
      const airflowPassword = await question('Enter your Airflow password: ');
      
      if (!airflowUsername.trim() || !airflowPassword.trim()) {
        console.log('❌ Both username and password are required');
        return;
      }
      
      console.log('🔐 Setting AIRFLOW_USERNAME...');
      exec(`netlify env:set AIRFLOW_USERNAME "${airflowUsername}"`);
      
      console.log('🔐 Setting AIRFLOW_PASSWORD...');
      exec(`netlify env:set AIRFLOW_PASSWORD "${airflowPassword}"`);
      
      // Remove token if it exists
      try {
        exec('netlify env:unset AIRFLOW_TOKEN', { stdio: 'pipe' });
        console.log('🧹 Cleared any existing token variable');
      } catch (error) {
        // Variable didn't exist, which is fine
      }
      
    } else {
      console.log('❌ Invalid authentication choice');
      return;
    }
    
    console.log('\n✅ Environment variables configured successfully!');
    
    // Show final configuration
    console.log('\n📋 Final configuration:');
    await listEnvironmentVariables();
    
  } catch (error) {
    console.log('❌ Failed to set environment variables:', error.message);
    console.log('\n💡 Make sure you\'re authenticated with Netlify and in a site directory');
  }
}

async function deleteEnvironmentVariable() {
  console.log('🗑️  Delete environment variable\n');
  
  // First show current variables
  await listEnvironmentVariables();
  
  const varName = await question('\nEnter the name of the variable to delete: ');
  
  if (!varName.trim()) {
    console.log('❌ Variable name is required');
    return;
  }

  const confirm = await question(`Are you sure you want to delete ${varName}? (y/n): `);
  
  if (confirm.toLowerCase() === 'y') {
    try {
      exec(`netlify env:unset ${varName}`);
      console.log(`✅ Successfully deleted ${varName}`);
    } catch (error) {
      console.log(`❌ Failed to delete ${varName}:`, error.message);
    }
  } else {
    console.log('Cancelled deletion');
  }
}

async function main() {
  console.log('🔧 Netlify Environment Variables Manager for MCP Server Airflow\n');
  
  // Check if netlify CLI is installed and user is authenticated
  try {
    execSync('netlify --version', { stdio: 'pipe' });
  } catch (error) {
    console.log('❌ Netlify CLI not found. Please install it with:');
    console.log('npm install -g netlify-cli');
    rl.close();
    return;
  }

  try {
    execSync('netlify status', { stdio: 'pipe' });
  } catch (error) {
    console.log('❌ Not authenticated with Netlify. Please run:');
    console.log('netlify login');
    rl.close();
    return;
  }

  console.log('Choose an action:');
  console.log('1. Set up Airflow environment variables');
  console.log('2. List current environment variables');
  console.log('3. Delete an environment variable');
  console.log('4. Exit');
  
  const choice = await question('\nEnter your choice (1-4): ');
  
  switch (choice) {
    case '1':
      await setEnvironmentVariables();
      break;
    case '2':
      await listEnvironmentVariables();
      break;
    case '3':
      await deleteEnvironmentVariable();
      break;
    case '4':
      console.log('Goodbye!');
      break;
    default:
      console.log('Invalid choice. Please run the script again.');
  }
  
  rl.close();
}

main().catch(console.error);