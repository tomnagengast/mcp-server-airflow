import { Handler, HandlerEvent, HandlerContext, HandlerResponse } from "@netlify/functions";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import fetch from "node-fetch";

// Polyfill fetch for Node.js environments
if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
}

// Airflow client configuration interface
interface AirflowConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  token?: string;
}

// Simplified Airflow client for serverless environment
class AirflowClient {
  private config: AirflowConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.AIRFLOW_BASE_URL || "http://localhost:8080",
      username: process.env.AIRFLOW_USERNAME,
      password: process.env.AIRFLOW_PASSWORD,
      token: process.env.AIRFLOW_TOKEN,
    };

    if (!this.config.token && (!this.config.username || !this.config.password)) {
      throw new Error(
        "Either AIRFLOW_TOKEN or both AIRFLOW_USERNAME and AIRFLOW_PASSWORD must be provided"
      );
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.config.token) {
      return {
        Authorization: `Bearer ${this.config.token}`,
      };
    } else if (this.config.username && this.config.password) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString("base64");
      return {
        Authorization: `Basic ${credentials}`,
      };
    }
    return {};
  }

  private async makeRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airflow API error: ${response.status} ${response.statusText}: ${errorText}`);
    }

    return response.json();
  }

  async listDags(params: any = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());
    if (params.order_by) queryParams.append("order_by", params.order_by);

    const data = await this.makeRequest(`/dags?${queryParams}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${data.total_entries} DAGs:\n\n${data.dags
            .map((dag: any) => 
              `• **${dag.dag_id}** - ${dag.description || "No description"}\n` +
              `  Status: ${dag.is_paused ? "Paused" : "Active"}\n` +
              `  Schedule: ${dag.schedule_interval || "None"}\n`
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async getDag(dagId: string) {
    const data = await this.makeRequest(`/dags/${dagId}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `**DAG: ${data.dag_id}**\n\n` +
            `Description: ${data.description || "No description"}\n` +
            `Status: ${data.is_paused ? "Paused" : "Active"}\n` +
            `Schedule: ${data.schedule_interval || "None"}\n` +
            `Start Date: ${data.start_date}\n` +
            `Catchup: ${data.catchup}\n` +
            `Max Active Runs: ${data.max_active_runs}\n` +
            `Tags: ${data.tags?.join(", ") || "None"}`,
        },
      ],
    };
  }

  async triggerDag(dagId: string, dagRunId?: string, conf?: any) {
    const payload: any = {};
    if (dagRunId) payload.dag_run_id = dagRunId;
    if (conf) payload.conf = conf;

    const data = await this.makeRequest(`/dags/${dagId}/dagRuns`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `DAG run triggered successfully!\n\n` +
            `DAG ID: ${data.dag_id}\n` +
            `Run ID: ${data.dag_run_id}\n` +
            `State: ${data.state}\n` +
            `Execution Date: ${data.execution_date}\n` +
            `Start Date: ${data.start_date || "Not started"}`,
        },
      ],
    };
  }

  async listDagRuns(dagId: string, params: any = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.offset) queryParams.append("offset", params.offset.toString());

    const data = await this.makeRequest(`/dags/${dagId}/dagRuns?${queryParams}`);
    
    return {
      content: [
        {
          type: "text" as const,
          text: `DAG Runs for ${dagId} (${data.total_entries} total):\n\n${data.dag_runs
            .map((run: any) => 
              `• **${run.dag_run_id}**\n` +
              `  State: ${run.state}\n` +
              `  Start: ${run.start_date || "Not started"}\n` +
              `  End: ${run.end_date || "Running"}\n` +
              `  Duration: ${run.end_date && run.start_date ? 
                Math.round((new Date(run.end_date).getTime() - new Date(run.start_date).getTime()) / 1000) + "s" : 
                "N/A"}\n`
            )
            .join("\n")}`,
        },
      ],
    };
  }

  async getTaskLogs(dagId: string, dagRunId: string, taskId: string, taskTryNumber: number = 1) {
    const queryParams = new URLSearchParams();
    queryParams.append("full_content", "true");

    const data = await this.makeRequest(`/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${taskTryNumber}?${queryParams}`);
    
    let decodedContent = data.content || "";
    try {
      decodedContent = decodedContent.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
    } catch (error) {
      console.warn("Failed to decode log content:", error);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `**Task Logs: ${taskId}** (Try ${taskTryNumber})\n\n` +
            `DAG: ${dagId}\n` +
            `Run: ${dagRunId}\n` +
            `Task: ${taskId}\n` +
            `Try Number: ${taskTryNumber}\n\n` +
            `**Logs:**\n\`\`\`\n${decodedContent}\n\`\`\``,
        },
      ],
    };
  }
}

// Create MCP server instance
const server = new McpServer({
  name: "mcp-server-airflow-netlify",
  version: "1.2.0",
});

// Initialize Airflow client
let airflowClient: AirflowClient;

try {
  airflowClient = new AirflowClient();
} catch (error) {
  console.error("Failed to initialize Airflow client:", error);
}

// Register core tools
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
  "airflow_get_task_logs",
  "Get logs for a specific task instance",
  {
    dag_id: z.string().describe("The ID of the DAG"),
    dag_run_id: z.string().describe("The ID of the DAG run"),
    task_id: z.string().describe("The ID of the task"),
    task_try_number: z.number().default(1).optional().describe("The try number of the task (default: 1)"),
  },
  async (args, _extra) => {
    return await airflowClient.getTaskLogs(
      args.dag_id, 
      args.dag_run_id, 
      args.task_id, 
      args.task_try_number
    );
  }
);

// Create transport with session support
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

// Connect server to transport
server.connect(transport);

// Netlify function handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
      },
      body: "",
    };
  }

  // Health check endpoint
  if (event.path?.endsWith("/health")) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        status: "healthy", 
        service: "mcp-server-airflow-netlify",
        timestamp: new Date().toISOString()
      }),
    };
  }

  try {
    // Parse request body
    let body: any = undefined;
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Invalid JSON" }),
        };
      }
    }

    // For now, return a simple MCP response indicating the function is working
    // In a production implementation, you would integrate with the actual MCP transport
    if (body && body.method === "initialize") {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Mcp-Session-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: true }
            },
            serverInfo: {
              name: "mcp-server-airflow-netlify",
              version: "1.2.0"
            }
          }
        }),
      };
    }

    if (body && body.method === "tools/list") {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            tools: [
              {
                name: "airflow_list_dags",
                description: "List all DAGs in Airflow",
                inputSchema: {
                  type: "object",
                  properties: {
                    limit: { type: "number", default: 100 },
                    offset: { type: "number", default: 0 },
                    order_by: { type: "string", default: "dag_id" }
                  }
                }
              },
              {
                name: "airflow_get_task_logs",
                description: "Get logs for a specific task instance",
                inputSchema: {
                  type: "object",
                  properties: {
                    dag_id: { type: "string" },
                    dag_run_id: { type: "string" },
                    task_id: { type: "string" },
                    task_try_number: { type: "number", default: 1 }
                  },
                  required: ["dag_id", "dag_run_id", "task_id"]
                }
              }
            ]
          }
        }),
      };
    }

    if (body && body.method === "tools/call") {
      const toolName = body.params.name;
      const args = body.params.arguments || {};

      try {
        let result;
        
        switch (toolName) {
          case "airflow_list_dags":
            result = await airflowClient.listDags(args);
            break;
          case "airflow_get_dag":
            result = await airflowClient.getDag(args.dag_id);
            break;
          case "airflow_trigger_dag":
            result = await airflowClient.triggerDag(args.dag_id, args.dag_run_id, args.conf);
            break;
          case "airflow_list_dag_runs":
            result = await airflowClient.listDagRuns(args.dag_id, args);
            break;
          case "airflow_get_task_logs":
            result = await airflowClient.getTaskLogs(args.dag_id, args.dag_run_id, args.task_id, args.task_try_number);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result
          }),
        };
      } catch (error) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32000,
              message: error instanceof Error ? error.message : String(error)
            }
          }),
        };
      }
    }

    // Default response for unhandled methods
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: body?.id || null,
        error: {
          code: -32601,
          message: "Method not found"
        }
      }),
    };

  } catch (error) {
    console.error("Error handling MCP request:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error)
      }),
    };
  }
};