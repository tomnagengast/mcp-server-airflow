#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AirflowClient } from "./airflow-client.js";

const server = new McpServer({
  name: "mcp-server-airflow",
  version: "1.0.0",
});

// Initialize Airflow client
const airflowClient = new AirflowClient();

// Register tools using the new MCP SDK approach
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server for Airflow started");
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});