#!/usr/bin/env node

import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { AirflowClient } from "./airflow-client.js";

// Parse command line arguments
const args = process.argv.slice(2);
const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000');

const server = new McpServer({
  name: "mcp-server-airflow",
  version: "1.0.0",
});

// Initialize Airflow client
const airflowClient = new AirflowClient();

// Register all tools (same as in index.ts)
server.tool(
  "airflow_list_dags",
  "List all DAGs in Airflow",
  {
    limit: z.number().default(100).optional().describe("Maximum number of DAGs to return"),
    offset: z.number().default(0).optional().describe("Number of DAGs to skip"),
    order_by: z.string().default("dag_id").optional().describe("Field to order by"),
  },
  async (args, _extra) => {
    return await airflowClient.listDags(args);
  }
);

server.tool(
  "airflow_get_dag",
  "Get details of a specific DAG",
  {
    dag_id: z.string().describe("The ID of the DAG"),
  },
  async (args, _extra) => {
    return await airflowClient.getDag(args.dag_id);
  }
);

server.tool(
  "airflow_trigger_dag",
  "Trigger a DAG run",
  {
    dag_id: z.string().describe("The ID of the DAG to trigger"),
    dag_run_id: z.string().optional().describe("Custom run ID (optional)"),
    conf: z.record(z.any()).optional().describe("Configuration parameters for the DAG run"),
  },
  async (args, _extra) => {
    return await airflowClient.triggerDag(args.dag_id, args.dag_run_id, args.conf);
  }
);

server.tool(
  "airflow_list_dag_runs",
  "List DAG runs for a specific DAG",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    limit: z.number().default(25).optional().describe("Maximum number of runs to return"),
    offset: z.number().default(0).optional().describe("Number of runs to skip"),
  },
  async (args, _extra) => {
    return await airflowClient.listDagRuns(args.dag_id, args);
  }
);

server.tool(
  "airflow_get_dag_run",
  "Get details of a specific DAG run",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    dag_run_id: z.string().describe("The ID of the DAG run"),
  },
  async (args, _extra) => {
    return await airflowClient.getDagRun(args.dag_id, args.dag_run_id);
  }
);

server.tool(
  "airflow_list_task_instances",
  "List task instances for a DAG run",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    dag_run_id: z.string().describe("The ID of the DAG run"),
  },
  async (args, _extra) => {
    return await airflowClient.listTaskInstances(args.dag_id, args.dag_run_id);
  }
);

server.tool(
  "airflow_get_task_instance",
  "Get details of a specific task instance",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    dag_run_id: z.string().describe("The ID of the DAG run"),
    task_id: z.string().describe("The ID of the task"),
  },
  async (args, _extra) => {
    return await airflowClient.getTaskInstance(args.dag_id, args.dag_run_id, args.task_id);
  }
);

server.tool(
  "airflow_pause_dag",
  "Pause a DAG",
  {
    dag_id: z.string().describe("The ID of the DAG to pause"),
  },
  async (args, _extra) => {
    return await airflowClient.pauseDag(args.dag_id);
  }
);

server.tool(
  "airflow_unpause_dag",
  "Unpause a DAG",
  {
    dag_id: z.string().describe("The ID of the DAG to unpause"),
  },
  async (args, _extra) => {
    return await airflowClient.unpauseDag(args.dag_id);
  }
);

server.tool(
  "airflow_get_task_logs",
  "Get logs for a specific task instance",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    dag_run_id: z.string().describe("The ID of the DAG run"),
    task_id: z.string().describe("The ID of the task"),
    task_try_number: z.number().default(1).optional().describe("The try number of the task (default: 1)"),
    full_content: z.boolean().default(true).optional().describe("Whether to get full log content (default: true)"),
  },
  async (args, _extra) => {
    return await airflowClient.getTaskLogs(
      args.dag_id, 
      args.dag_run_id, 
      args.task_id, 
      args.task_try_number, 
      args.full_content
    );
  }
);

server.tool(
  "airflow_get_dag_run_logs",
  "Get logs for all tasks in a DAG run",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    dag_run_id: z.string().describe("The ID of the DAG run"),
    limit: z.number().default(10).optional().describe("Maximum number of tasks to show logs for (default: 10)"),
  },
  async (args, _extra) => {
    return await airflowClient.getDagRunLogs(args.dag_id, args.dag_run_id, args.limit);
  }
);

server.tool(
  "airflow_tail_dag_run",
  "Tail/monitor a DAG run showing recent activity and logs",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    dag_run_id: z.string().describe("The ID of the DAG run"),
    max_lines: z.number().default(50).optional().describe("Maximum number of log lines to show per task (default: 50)"),
  },
  async (args, _extra) => {
    return await airflowClient.tailDagRun(args.dag_id, args.dag_run_id, args.max_lines);
  }
);

async function main() {
  // Create the HTTP transport with session support
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);

  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Handle health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', service: 'mcp-server-airflow' }));
      return;
    }

    // Parse request body for POST requests
    let body: any = undefined;
    if (req.method === 'POST') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      await new Promise((resolve) => req.on('end', resolve));
      const bodyText = Buffer.concat(chunks).toString();
      
      try {
        body = bodyText ? JSON.parse(bodyText) : undefined;
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
    }

    // Handle MCP requests
    try {
      await transport.handleRequest(req, res, body);
    } catch (error) {
      console.error('Error handling request:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  httpServer.listen(port, () => {
    console.error(`MCP Server for Airflow started on HTTP port ${port}`);
    console.error(`Health check: http://localhost:${port}/health`);
    console.error(`MCP endpoint: http://localhost:${port}/`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.error('Shutting down HTTP server...');
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error("HTTP server failed to start:", error);
  process.exit(1);
});