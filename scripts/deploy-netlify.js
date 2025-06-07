#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
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

async function main() {
  console.log('🚀 Netlify Deployment for MCP Server Airflow\n');

  // Check if netlify CLI is installed
  try {
    execSync('netlify --version', { stdio: 'pipe' });
  } catch (error) {
    console.log('❌ Netlify CLI not found. Installing...');
    exec('npm install -g netlify-cli');
  }

  // Check if user is authenticated
  try {
    execSync('netlify status', { stdio: 'pipe' });
    console.log('✅ Netlify authentication confirmed');
  } catch (error) {
    console.log('🔐 Please authenticate with Netlify...');
    exec('netlify login');
  }

  // Build the project
  console.log('\n📦 Building project for Netlify...');
  exec('npm run build:netlify');

  // Check if site exists
  let siteExists = false;
  try {
    execSync('netlify status', { stdio: 'pipe' });
    siteExists = true;
    console.log('✅ Existing Netlify site found');
  } catch (error) {
    console.log('🆕 No existing site found, will create new one');
  }

  if (!siteExists) {
    const siteName = await question('Enter a site name (optional): ');
    const deployCmd = siteName 
      ? `netlify init --manual --name ${siteName}`
      : 'netlify init --manual';
    
    console.log('\n🌐 Creating new Netlify site...');
    exec(deployCmd);
  }

  // Configure environment variables
  console.log('\n🔧 Environment Variables Setup');
  
  const setupEnv = await question('Would you like to set up environment variables now? (y/n): ');
  
  if (setupEnv.toLowerCase() === 'y') {
    console.log('\n📝 Setting up Airflow connection...');
    
    const airflowBaseUrl = await question('Enter your Airflow base URL (e.g., https://your-airflow.com): ');
    
    if (!airflowBaseUrl.trim()) {
      console.log('❌ Airflow base URL is required');
      rl.close();
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
          rl.close();
          return;
        }
        
        console.log('🔐 Setting AIRFLOW_TOKEN...');
        exec(`netlify env:set AIRFLOW_TOKEN "${airflowToken}"`);
        
      } else if (authChoice === '2') {
        const airflowUsername = await question('Enter your Airflow username: ');
        const airflowPassword = await question('Enter your Airflow password: ');
        
        if (!airflowUsername.trim() || !airflowPassword.trim()) {
          console.log('❌ Both username and password are required');
          rl.close();
          return;
        }
        
        console.log('🔐 Setting AIRFLOW_USERNAME...');
        exec(`netlify env:set AIRFLOW_USERNAME "${airflowUsername}"`);
        
        console.log('🔐 Setting AIRFLOW_PASSWORD...');
        exec(`netlify env:set AIRFLOW_PASSWORD "${airflowPassword}"`);
        
      } else {
        console.log('❌ Invalid authentication choice');
        rl.close();
        return;
      }
      
      console.log('✅ Environment variables configured successfully!');
      
      // Verify environment variables
      console.log('\n📋 Verifying environment variables...');
      try {
        exec('netlify env:list');
      } catch (error) {
        console.log('⚠️  Could not list environment variables, but they should be set');
      }
      
    } catch (error) {
      console.log('❌ Failed to set environment variables:', error.message);
      console.log('\n💡 You can set them manually in the Netlify dashboard:');
      console.log('1. Go to your site settings');
      console.log('2. Navigate to Environment Variables');
      console.log('3. Add the variables listed in .env.netlify.example');
      
      const continueAnyway = await question('\nContinue with deployment? (y/n): ');
      if (continueAnyway.toLowerCase() !== 'y') {
        rl.close();
        return;
      }
    }
  } else {
    console.log('\n💡 You can set environment variables later using:');
    console.log('netlify env:set AIRFLOW_BASE_URL "https://your-airflow.com"');
    console.log('netlify env:set AIRFLOW_TOKEN "your_token"');
    console.log('');
    console.log('Or manually in the Netlify dashboard.');
    
    const continueAnyway = await question('\nContinue with deployment? (y/n): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      rl.close();
      return;
    }
  }

  // Deploy to production
  console.log('\n🚀 Deploying to production...');
  exec('netlify deploy --prod');

  // Get the site URL
  try {
    const siteInfo = execSync('netlify status --json', { encoding: 'utf8' });
    const site = JSON.parse(siteInfo);
    const siteUrl = site.site_url;
    
    console.log('\n✅ Deployment successful!');
    console.log(`🌐 Site URL: ${siteUrl}`);
    console.log(`🏥 Health check: ${siteUrl}/health`);
    console.log(`🔧 MCP endpoint: ${siteUrl}/mcp`);
    
    console.log('\n💡 Claude Desktop Configuration:');
    console.log('Add this to your Claude Desktop MCP settings:');
    console.log(`{
  "mcpServers": {
    "airflow": {
      "transport": {
        "type": "http",
        "url": "${siteUrl}/mcp"
      }
    }
  }
}`);
  } catch (error) {
    console.log('\n✅ Deployment completed! Check your Netlify dashboard for the site URL.');
  }

  rl.close();
}

main().catch(console.error);