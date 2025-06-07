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

## Installation

### Via NPX (Recommended)

```bash
npx mcp-server-airflow
```

### From Source

```bash
git clone https://github.com/tomnagengast/mcp-server-airflow.git
cd mcp-server-airflow
npm install
npm run build
npm start
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

## Claude Desktop Integration

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