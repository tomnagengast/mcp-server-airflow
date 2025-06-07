#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

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

async function deployToGCP() {
  console.log('\n🚀 Deploying to Google Cloud Platform (Cloud Run)...\n');
  
  const projectId = await question('Enter your GCP Project ID: ');
  const region = await question('Enter region (default: us-central1): ') || 'us-central1';
  const serviceName = await question('Enter service name (default: mcp-server-airflow): ') || 'mcp-server-airflow';
  
  console.log('\n📦 Building and pushing Docker image...');
  exec(`gcloud builds submit --tag gcr.io/${projectId}/${serviceName} .`, { cwd: projectRoot });
  
  console.log('\n🔐 Creating secrets...');
  const airflowBaseUrl = await question('Enter your Airflow base URL: ');
  const airflowToken = await question('Enter your Airflow token (or press enter to use username/password): ');
  
  try {
    exec(`gcloud secrets create airflow-base-url --data-file=-`, { 
      input: airflowBaseUrl,
      cwd: projectRoot 
    });
  } catch (error) {
    console.log('Secret may already exist, updating...');
    exec(`echo "${airflowBaseUrl}" | gcloud secrets versions add airflow-base-url --data-file=-`);
  }
  
  if (airflowToken) {
    try {
      exec(`echo "${airflowToken}" | gcloud secrets create airflow-token --data-file=-`);
    } catch (error) {
      console.log('Secret may already exist, updating...');
      exec(`echo "${airflowToken}" | gcloud secrets versions add airflow-token --data-file=-`);
    }
  } else {
    const username = await question('Enter Airflow username: ');
    const password = await question('Enter Airflow password: ');
    
    try {
      exec(`echo "${username}" | gcloud secrets create airflow-username --data-file=-`);
      exec(`echo "${password}" | gcloud secrets create airflow-password --data-file=-`);
    } catch (error) {
      console.log('Secrets may already exist, updating...');
      exec(`echo "${username}" | gcloud secrets versions add airflow-username --data-file=-`);
      exec(`echo "${password}" | gcloud secrets versions add airflow-password --data-file=-`);
    }
  }
  
  console.log('\n🚀 Deploying to Cloud Run...');
  let deployCmd = `gcloud run deploy ${serviceName} \\
    --image gcr.io/${projectId}/${serviceName} \\
    --platform managed \\
    --region ${region} \\
    --allow-unauthenticated \\
    --port 3000 \\
    --memory 512Mi \\
    --cpu 1 \\
    --max-instances 10 \\
    --set-env-vars AIRFLOW_BASE_URL="${airflowBaseUrl}"`;
  
  if (airflowToken) {
    deployCmd += ` --set-env-vars AIRFLOW_TOKEN="${airflowToken}"`;
  } else {
    deployCmd += ` --update-secrets AIRFLOW_USERNAME=airflow-username:latest,AIRFLOW_PASSWORD=airflow-password:latest`;
  }
  
  exec(deployCmd);
  
  console.log('\n✅ Deployment complete!');
  const serviceUrl = execSync(`gcloud run services describe ${serviceName} --region ${region} --format "value(status.url)"`, { encoding: 'utf8' }).trim();
  console.log(`🌐 Service URL: ${serviceUrl}`);
  console.log(`🏥 Health check: ${serviceUrl}/health`);
}

async function deployToAWS() {
  console.log('\n🚀 Deploying to Amazon Web Services (ECS Fargate)...\n');
  
  const region = await question('Enter AWS region (default: us-east-1): ') || 'us-east-1';
  const accountId = await question('Enter your AWS Account ID: ');
  const clusterName = await question('Enter ECS cluster name (default: mcp-server-airflow): ') || 'mcp-server-airflow';
  
  console.log('\n📦 Creating ECR repository and building image...');
  try {
    exec(`aws ecr create-repository --repository-name mcp-server-airflow --region ${region}`);
  } catch (error) {
    console.log('Repository may already exist, continuing...');
  }
  
  exec(`aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${accountId}.dkr.ecr.${region}.amazonaws.com`);
  exec(`docker build -t mcp-server-airflow .`, { cwd: projectRoot });
  exec(`docker tag mcp-server-airflow:latest ${accountId}.dkr.ecr.${region}.amazonaws.com/mcp-server-airflow:latest`);
  exec(`docker push ${accountId}.dkr.ecr.${region}.amazonaws.com/mcp-server-airflow:latest`);
  
  console.log('\n🔐 Creating secrets in AWS Secrets Manager...');
  const airflowBaseUrl = await question('Enter your Airflow base URL: ');
  const airflowToken = await question('Enter your Airflow token (or press enter to use username/password): ');
  
  const secretValue = { base_url: airflowBaseUrl };
  if (airflowToken) {
    secretValue.token = airflowToken;
  } else {
    secretValue.username = await question('Enter Airflow username: ');
    secretValue.password = await question('Enter Airflow password: ');
  }
  
  try {
    exec(`aws secretsmanager create-secret --name airflow-config --secret-string '${JSON.stringify(secretValue)}' --region ${region}`);
  } catch (error) {
    console.log('Secret may already exist, updating...');
    exec(`aws secretsmanager update-secret --secret-id airflow-config --secret-string '${JSON.stringify(secretValue)}' --region ${region}`);
  }
  
  console.log('\n📝 Creating ECS task definition...');
  const taskDef = readFileSync(join(projectRoot, 'deploy/aws-ecs-fargate.json'), 'utf8')
    .replace(/YOUR_ACCOUNT_ID/g, accountId)
    .replace(/YOUR_REGION/g, region);
  
  writeFileSync('/tmp/task-definition.json', taskDef);
  exec(`aws ecs register-task-definition --cli-input-json file:///tmp/task-definition.json --region ${region}`);
  
  console.log('\n🏗️ Creating ECS cluster and service...');
  try {
    exec(`aws ecs create-cluster --cluster-name ${clusterName} --region ${region}`);
  } catch (error) {
    console.log('Cluster may already exist, continuing...');
  }
  
  // Note: This is a basic service creation. In production, you'd want to set up VPC, subnets, security groups, and load balancer
  console.log('\n⚠️  Note: You need to manually create an ECS service with proper VPC configuration, subnets, security groups, and load balancer.');
  console.log('Use the AWS Console or AWS CLI with proper networking configuration.');
  
  console.log('\n✅ Task definition registered!');
  console.log(`📋 Task Definition: mcp-server-airflow:latest`);
}

async function deployToDigitalOcean() {
  console.log('\n🚀 Deploying to DigitalOcean App Platform...\n');
  
  const repoUrl = await question('Enter your GitHub repository URL (e.g., https://github.com/username/repo): ');
  const branch = await question('Enter branch name (default: main): ') || 'main';
  
  console.log('\n📝 Creating app specification...');
  const appSpec = readFileSync(join(projectRoot, 'deploy/digitalocean-app.yaml'), 'utf8')
    .replace('YOUR_USERNAME/mcp-server-airflow', repoUrl.replace('https://github.com/', ''));
  
  writeFileSync('/tmp/digitalocean-app.yaml', appSpec);
  
  console.log('\n🔐 Setting up environment variables...');
  console.log('You need to set these environment variables in the DigitalOcean dashboard:');
  console.log('- AIRFLOW_BASE_URL');
  console.log('- AIRFLOW_TOKEN (or AIRFLOW_USERNAME and AIRFLOW_PASSWORD)');
  
  console.log('\n🚀 Creating app...');
  try {
    exec(`doctl apps create /tmp/digitalocean-app.yaml`);
    console.log('\n✅ App created! Check the DigitalOcean dashboard for deployment status.');
  } catch (error) {
    console.log('\n⚠️  Please install doctl CLI and authenticate, or use the DigitalOcean dashboard to deploy manually.');
    console.log('App specification saved to /tmp/digitalocean-app.yaml');
  }
}

async function main() {
  console.log('🌥️  MCP Server for Airflow - Cloud Deployment Tool\n');
  
  console.log('Select your deployment target:');
  console.log('1. Google Cloud Platform (Cloud Run)');
  console.log('2. Amazon Web Services (ECS Fargate)');
  console.log('3. DigitalOcean App Platform');
  console.log('4. Netlify (Serverless Functions)');
  console.log('5. Exit');
  
  const choice = await question('\nEnter your choice (1-5): ');
  
  switch (choice) {
    case '1':
      await deployToGCP();
      break;
    case '2':
      await deployToAWS();
      break;
    case '3':
      await deployToDigitalOcean();
      break;
    case '4':
      console.log('🚀 For Netlify deployment, please use:');
      console.log('   node scripts/deploy-netlify.js');
      console.log('   or npm run deploy:netlify');
      break;
    case '5':
      console.log('Goodbye!');
      break;
    default:
      console.log('Invalid choice. Please run the script again.');
  }
  
  rl.close();
}

main().catch(console.error);