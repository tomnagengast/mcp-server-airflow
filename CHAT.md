# Development Transcript


> I've built two mcp servers, one for salesforce (https://github.com/tomnagengast/mcp-server-salesforce) and one for hex (https://github.com/tomnagengast/mcp-server-hex), now want to build
  one for airflow. Reference the current mcp docs (https://github.com/modelcontextprotocol/typescript-sdk), airflow api docs
  (https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html) and build and mcp server that I can run with npx from Claude Desktop then create a new github repo. Remember
   to commit often so that you can understand what's happened so far and roll back to any points that you might need to.

> This should work with all popular hosted airflow instances (Astronomer, Google Cloud Composer, Amazon MWAA, etc)

> The current best practice is to host your MCP server for clients serving via streamable http. Add instructions on how to test this locally and how to deploy on GCP, AWS, Digital Ocean, etc.

> Add a utility script for users to deploy to their cloud provider of choice and add usage instructions

> Add tools to
  - Get logs for dags and tasks
  - Tail a DAG run
