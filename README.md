# MCP Server for Apache Airflow

A Model Context Protocol (MCP) server that provides comprehensive integration with Apache Airflow's REST API. This server allows AI assistants to interact with Airflow workflows, monitor DAG runs, and manage tasks programmatically.

## Features

- **DAG Management**: List, view details, pause, and unpause DAGs
- **DAG Run Operations**: Trigger new runs, list existing runs, and get detailed run information
- **Task Instance Monitoring**: View task instances and their execution details
- **Universal Compatibility**: Works with all popular Airflow hosting platforms:
  - [Astronomer](https://astronomer.io)
  - [Google Cloud Composer](https://cloud.google.com/composer)
  - [Amazon MWAA](https://aws.amazon.com/managed-workflows-for-apache-airflow/)
  - Self-hosted Airflow instances

## Available Tools

1. **airflow_list_dags** - List all DAGs with pagination and sorting
2. **airflow_get_dag** - Get detailed information about a specific DAG
3. **airflow_trigger_dag** - Trigger a new DAG run with optional configuration
4. **airflow_list_dag_runs** - List DAG runs for a specific DAG
5. **airflow_get_dag_run** - Get details of a specific DAG run
6. **airflow_list_task_instances** - List task instances for a DAG run
7. **airflow_get_task_instance** - Get detailed task instance information
8. **airflow_pause_dag** - Pause a DAG
9. **airflow_unpause_dag** - Unpause a DAG

## Installation & Deployment

### Local Development

#### Via NPX (Recommended for Claude Desktop)

```bash
npx mcp-server-airflow
```

#### HTTP Server (Recommended for Cloud Deployment)

```bash
npx mcp-server-airflow-http
```

#### From Source

```bash
git clone https://github.com/tomnagengast/mcp-server-airflow.git
cd mcp-server-airflow
npm install
npm run build

# For stdio mode (Claude Desktop)
npm start

# For HTTP mode (cloud deployment)
npm run start:http
```

### Cloud Deployment (Recommended)

This server supports streamable HTTP transport, which is the current best practice for MCP servers. Deploy to your preferred cloud platform:

#### Quick Deploy

```bash
npm run deploy
```

This interactive script will guide you through deploying to:
- Google Cloud Platform (Cloud Run)
- Amazon Web Services (ECS Fargate)
- DigitalOcean App Platform

#### Manual Deployment Options

<details>
<summary>🌐 Google Cloud Platform (Cloud Run)</summary>

```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/mcp-server-airflow

# Create secrets
echo "https://your-airflow-instance.com" | gcloud secrets create airflow-base-url --data-file=-
echo "your_token_here" | gcloud secrets create airflow-token --data-file=-

# Deploy to Cloud Run
gcloud run deploy mcp-server-airflow \
  --image gcr.io/YOUR_PROJECT_ID/mcp-server-airflow \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --set-secrets AIRFLOW_BASE_URL=airflow-base-url:latest,AIRFLOW_TOKEN=airflow-token:latest
```

</details>

<details>
<summary>☁️ Amazon Web Services (ECS Fargate)</summary>

```bash
# Create ECR repository
aws ecr create-repository --repository-name mcp-server-airflow

# Build and push image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker build -t mcp-server-airflow .
docker tag mcp-server-airflow:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-server-airflow:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-server-airflow:latest

# Create secrets in Secrets Manager
aws secretsmanager create-secret --name airflow-config --secret-string '{"base_url":"https://your-airflow-instance.com","token":"your_token_here"}'

# Register task definition and create service (use provided template)
aws ecs register-task-definition --cli-input-json file://deploy/aws-ecs-fargate.json
```

</details>

<details>
<summary>🌊 DigitalOcean App Platform</summary>

1. Fork this repository to your GitHub account
2. Create a new app in DigitalOcean App Platform
3. Connect your forked repository
4. Use the provided app spec: `deploy/digitalocean-app.yaml`
5. Set environment variables in the dashboard:
   - `AIRFLOW_BASE_URL`
   - `AIRFLOW_TOKEN` (or `AIRFLOW_USERNAME` and `AIRFLOW_PASSWORD`)

</details>

### Docker Deployment

```bash
# Build image
npm run docker:build

# Run with environment file
npm run docker:run

# Or with docker-compose
docker-compose up
```

## Configuration

The server requires authentication configuration through environment variables:

### Option 1: API Token (Recommended)

```bash
export AIRFLOW_BASE_URL="https://your-airflow-instance.com"
export AIRFLOW_TOKEN="your_api_token_here"
```

### Option 2: Basic Authentication

```bash
export AIRFLOW_BASE_URL="https://your-airflow-instance.com"
export AIRFLOW_USERNAME="your_username"
export AIRFLOW_PASSWORD="your_password"
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AIRFLOW_BASE_URL` | Yes | Base URL of your Airflow instance |
| `AIRFLOW_TOKEN` | No* | API token for authentication |
| `AIRFLOW_USERNAME` | No* | Username for basic auth |
| `AIRFLOW_PASSWORD` | No* | Password for basic auth |

*Either `AIRFLOW_TOKEN` or both `AIRFLOW_USERNAME` and `AIRFLOW_PASSWORD` must be provided.

## Platform-Specific Setup

### Astronomer

```bash
export AIRFLOW_BASE_URL="https://your-deployment.astronomer.io"
export AIRFLOW_TOKEN="your_astronomer_api_token"
```

### Google Cloud Composer

```bash
export AIRFLOW_BASE_URL="https://your-composer-environment-web-server-url"
export AIRFLOW_TOKEN="your_gcp_access_token"
```

### Amazon MWAA

```bash
export AIRFLOW_BASE_URL="https://your-environment-name.airflow.region.amazonaws.com"
# Use AWS credentials with appropriate IAM permissions
```

## Testing

### Local Testing

Test both stdio and HTTP modes:

```bash
# Set required environment variables
export AIRFLOW_BASE_URL="https://your-airflow-instance.com"
export AIRFLOW_TOKEN="your_api_token_here"

# Run comprehensive local tests
npm run test:local
```

### HTTP API Testing

Once deployed, test your HTTP endpoint:

```bash
# Health check
curl https://your-deployed-url/health

# MCP initialization
curl -X POST https://your-deployed-url/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}'

# List available tools
curl -X POST https://your-deployed-url/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}'
```

## Claude Desktop Integration

### Stdio Mode (Local Development)

Add this to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "airflow": {
      "command": "npx",
      "args": ["mcp-server-airflow"],
      "env": {
        "AIRFLOW_BASE_URL": "https://your-airflow-instance.com",
        "AIRFLOW_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

### HTTP Mode (Cloud Deployment)

For streamable HTTP transport, configure Claude to use your deployed endpoint:

```json
{
  "mcpServers": {
    "airflow": {
      "transport": {
        "type": "http",
        "url": "https://your-deployed-url"
      }
    }
  }
}
```

## Usage Examples

Once connected, you can use natural language to interact with Airflow:

- "List all my DAGs"
- "Show me the details of the data_pipeline DAG"
- "Trigger the daily_etl DAG with custom configuration"
- "What's the status of the latest run for my_workflow?"
- "Show me all failed task instances from the last run"
- "Pause the problematic_dag DAG"

## Authentication Requirements

This server uses Airflow's stable REST API (v1), which requires authentication. The API supports:

- **Bearer Token Authentication**: Most secure, recommended for production
- **Basic Authentication**: Username/password, useful for development
- **Session Authentication**: Handled automatically when using web-based tokens

## Security Considerations

- Store credentials securely and never commit them to version control
- Use environment variables or secure secret management systems
- For production deployments, prefer API tokens over username/password
- Ensure your Airflow instance has proper network security (TLS, VPC, etc.)
- Apply appropriate rate limiting and monitoring
- Use HTTPS endpoints for production deployments
- Implement proper authentication and authorization at the load balancer/gateway level

## Performance & Scaling

### HTTP Mode Benefits

- **Stateless**: Each request is independent, allowing horizontal scaling
- **Caching**: Responses can be cached at the CDN/proxy level
- **Load Balancing**: Multiple instances can handle requests
- **Monitoring**: Standard HTTP monitoring tools work out of the box
- **Debugging**: Easy to test and debug with standard HTTP tools

### Recommended Production Setup

- **Auto-scaling**: Configure your cloud platform to scale based on CPU/memory usage
- **Health Checks**: Use the `/health` endpoint for load balancer health checks
- **Monitoring**: Set up logging and metrics collection
- **Caching**: Consider caching frequently accessed DAG information
- **Rate Limiting**: Implement rate limiting to protect your Airflow instance

## API Compatibility

This server is compatible with Apache Airflow 2.x REST API. It has been tested with:

- Apache Airflow 2.7+
- Astronomer Software and Cloud
- Google Cloud Composer 2
- Amazon MWAA (all supported Airflow versions)

## Development

```bash
# Clone the repository
git clone https://github.com/tomnagengast/mcp-server-airflow.git
cd mcp-server-airflow

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [MCP Server for Salesforce](https://github.com/tomnagengast/mcp-server-salesforce)
- [MCP Server for Hex](https://github.com/tomnagengast/mcp-server-hex)
- [Model Context Protocol](https://github.com/modelcontextprotocol/typescript-sdk)