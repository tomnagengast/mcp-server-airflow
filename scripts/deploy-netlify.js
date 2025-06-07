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
  console.log('You need to set these environment variables in your Netlify dashboard:');
  console.log('1. Go to your site settings in Netlify dashboard');
  console.log('2. Navigate to Environment Variables');
  console.log('3. Add the following variables:');
  console.log('');
  console.log('Required:');
  console.log('- AIRFLOW_BASE_URL: Your Airflow instance URL');
  console.log('');
  console.log('Authentication (choose one):');
  console.log('- AIRFLOW_TOKEN: Your Airflow API token');
  console.log('OR');
  console.log('- AIRFLOW_USERNAME and AIRFLOW_PASSWORD: Basic auth credentials');
  console.log('');

  const envConfigured = await question('Have you configured the environment variables? (y/n): ');
  
  if (envConfigured.toLowerCase() !== 'y') {
    console.log('\n⚠️  Please configure environment variables before deploying.');
    console.log('You can find the example in .env.netlify.example');
    rl.close();
    return;
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